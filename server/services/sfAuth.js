import axios from 'axios';
import sfConfig from '../config/salesforce.js';

export async function exchangeCodeForTokens(code, codeVerifier, loginUrl) {
  const url = loginUrl || sfConfig.loginUrl;
  const resp = await axios.post(`${url}/services/oauth2/token`, null, {
    params: {
      grant_type: 'authorization_code',
      code,
      client_id: sfConfig.clientId,
      client_secret: sfConfig.clientSecret,
      redirect_uri: sfConfig.callbackUrl,
      code_verifier: codeVerifier,
    },
  });

  const { access_token, refresh_token, instance_url, id } = resp.data;
  return { accessToken: access_token, refreshToken: refresh_token, instanceUrl: instance_url, idUrl: id };
}


export async function refreshAccessToken(refreshToken, loginUrl) {
  const url = loginUrl || sfConfig.loginUrl;
  const resp = await axios.post(`${url}/services/oauth2/token`, null, {
    params: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: sfConfig.clientId,
      client_secret: sfConfig.clientSecret,
    },
  });

  return {
    accessToken: resp.data.access_token,
    instanceUrl: resp.data.instance_url,
  };
}


export async function getUserInfo(instanceUrl, accessToken) {
  const resp = await axios.get(`${instanceUrl}/services/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return resp.data;
}

export async function revokeToken(token, loginUrl) {
  try {
    const url = loginUrl || sfConfig.loginUrl;
    await axios.post(`${url}/services/oauth2/revoke`, null, {
      params: { token },
    });
  } catch (err) {
    // SF might reject already-expired tokens, that's fine
    console.error('Token revocation failed (might be already expired):', err.message);
  }
}

