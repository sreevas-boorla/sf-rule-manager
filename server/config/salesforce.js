const sanitizeEnvVar = (val) => {
  if (!val) return val;
  // Strip single/double quotes and trim any spaces/newlines
  return val.replace(/['"\\]/g, '').trim();
};

const sfConfig = {
  clientId: sanitizeEnvVar(process.env.SF_CLIENT_ID),
  clientSecret: sanitizeEnvVar(process.env.SF_CLIENT_SECRET),
  callbackUrl: sanitizeEnvVar(process.env.SF_CALLBACK_URL) || 'http://localhost:3001/api/auth/callback',
  loginUrl: sanitizeEnvVar(process.env.SF_LOGIN_URL) || 'https://login.salesforce.com',
  apiVersion: 'v59.0',
};

export function buildAuthorizeUrl(state, codeChallenge, loginUrl) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: sfConfig.clientId,
    redirect_uri: sfConfig.callbackUrl,
    state: state || '',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  const url = loginUrl || sfConfig.loginUrl;
  return `${url}/services/oauth2/authorize?${params.toString()}`;
}


export default sfConfig;

