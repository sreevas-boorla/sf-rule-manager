import { Router } from 'express';
import crypto from 'crypto';
import { buildAuthorizeUrl } from '../config/salesforce.js';
import { exchangeCodeForTokens, getUserInfo, revokeToken } from '../services/sfAuth.js';
import { getOrgName } from '../services/sfTooling.js';
import authCheck from '../middleware/authCheck.js';

const router = Router();

router.get('/debug', (req, res) => {
  res.json({
    secure: req.secure,
    protocol: req.protocol,
    ip: req.ip,
    ips: req.ips,
    headers: req.headers,
    session: req.session || null,
  });
});


router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');

  // PKCE: generate a random verifier, hash it for the challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  req.session.oauthState = state;
  req.session.codeVerifier = codeVerifier;

  req.session.save((err) => {
    if (err) {
      console.error('Session save error during login:', err);
      return res.status(500).json({ error: 'Failed to initialize session' });
    }
    res.redirect(buildAuthorizeUrl(state, codeChallenge));
  });
});


router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Salesforce sends error params if the user denied access or something else went wrong
  if (error) {
    console.error('OAuth error from Salesforce:', error, error_description);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${clientUrl}/?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    console.error('Callback hit without code. Query params:', req.query);
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  // CSRF check
  if (state !== req.session.oauthState) {
    return res.status(403).json({ error: 'State mismatch — possible CSRF' });
  }
  const codeVerifier = req.session.codeVerifier;
  delete req.session.oauthState;
  delete req.session.codeVerifier;

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const userInfo = await getUserInfo(tokens.instanceUrl, tokens.accessToken);

    // Grab the org name so we can show it on the dashboard
    let orgName = 'Salesforce Org';
    try {
      orgName = await getOrgName(tokens.instanceUrl, tokens.accessToken);
    } catch (_) {
      // non-critical, just fall back to default
    }

    req.session.sf = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      instanceUrl: tokens.instanceUrl,
    };
    req.session.user = {
      id: userInfo.user_id,
      name: userInfo.name,
      email: userInfo.email,
      picture: userInfo.picture,
      orgName,
    };

    req.session.save((err) => {
      if (err) {
        console.error('Session save error during callback:', err);
        return res.status(500).json({ error: 'Failed to save session credentials' });
      }
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${clientUrl}/dashboard`);
    });
  } catch (err) {

    console.error('OAuth callback failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Authentication failed — could not exchange code for tokens' });
  }
});

router.get('/me', authCheck, (req, res) => {
  res.json({ user: req.session.user });
});

router.post('/logout', authCheck, async (req, res) => {
  await revokeToken(req.session.sf.accessToken);
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.json({ message: 'Logged out' });
  });
});

export default router;
