const sfConfig = {
  clientId: process.env.SF_CLIENT_ID,
  clientSecret: process.env.SF_CLIENT_SECRET,
  callbackUrl: process.env.SF_CALLBACK_URL || 'http://localhost:3001/api/auth/callback',
  loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
  apiVersion: 'v59.0',
};

export function buildAuthorizeUrl(state, codeChallenge) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: sfConfig.clientId,
    redirect_uri: sfConfig.callbackUrl,
    state: state || '',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${sfConfig.loginUrl}/services/oauth2/authorize?${params.toString()}`;
}

export default sfConfig;
