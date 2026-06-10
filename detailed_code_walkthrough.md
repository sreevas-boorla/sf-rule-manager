# Salesforce Rule Manager — Detailed Code Walkthrough

This document provides a line-by-line and section-by-section breakdown of the 10 core files in the project. It explains the design choices, what each block of code does, and why it is written that way.

---

## 1. `server/config/salesforce.js`
This file sanitizes your credentials and builds the authorize URL for Salesforce login.

```javascript
const sanitizeEnvVar = (val) => {
  if (!val) return val;
  return val.replace(/['"\\]/g, '').trim();
};
```
* **Explanation**: Accidental quotes (`"`, `'`) or backslashes (`\`) pasted into environment variables (like on Render's UI) will cause URL encoding errors or mismatch errors. This utility function uses regex to strip them out and trims any spaces or newlines.

```javascript
const sfConfig = {
  clientId: sanitizeEnvVar(process.env.SF_CLIENT_ID),
  clientSecret: sanitizeEnvVar(process.env.SF_CLIENT_SECRET),
  callbackUrl: sanitizeEnvVar(process.env.SF_CALLBACK_URL) || 'http://localhost:3001/api/auth/callback',
  loginUrl: sanitizeEnvVar(process.env.SF_LOGIN_URL) || 'https://login.salesforce.com',
  apiVersion: 'v59.0',
};
```
* **Explanation**: Creates a configuration object. If `SF_CALLBACK_URL` or `SF_LOGIN_URL` are missing in the environment, it falls back to standard developer defaults.

```javascript
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
```
* **Explanation**: Generates the redirection URL. It accepts the PKCE `codeChallenge` and the dynamic `loginUrl` (sandbox vs production) and appends them to the OAuth authorization query.

---

## 2. `server/services/sfAuth.js`
Handles server-to-server OAuth requests directly to Salesforce.

```javascript
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
```
* **Explanation**: This exchanges the temporary authorization code for real access and refresh tokens. It sends a POST request with the PKCE `code_verifier`. It returns the access token, the refresh token, the instance URL (the customer's Salesforce pod), and the identity URL.

```javascript
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
```
* **Explanation**: If an access token expires (typically after 2 hours), this function sends a refresh token request to retrieve a new active access token silently, avoiding forcing the user to log in again.

---

## 3. `server/services/sfTooling.js`
Fetches rules from Salesforce using the Tooling API.

```javascript
export async function getValidationRules(instanceUrl, accessToken) {
  const query = "SELECT Id, ValidationName, Active, Description, ErrorMessage, EntityDefinition.QualifiedApiName FROM ValidationRule WHERE EntityDefinition.QualifiedApiName = 'Account'";
  const resp = await axios.get(`${instanceUrl}/services/data/v59.0/tooling/query`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q: query },
  });
  return resp.data.records;
}
```
* **Explanation**: Executes a SOQL query against the `ValidationRule` metadata table via the Tooling API. The query filters rules where the parent entity is `'Account'`. It passes the `accessToken` in the `Authorization` header.

```javascript
export async function getValidationRuleDetails(instanceUrl, accessToken, ruleId) {
  const resp = await axios.get(`${instanceUrl}/services/data/v59.0/tooling/sobjects/ValidationRule/${ruleId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return resp.data;
}
```
* **Explanation**: Tooling API query lists don't include full XML metadata (like formulas or advanced parameters). This function queries the specific validation rule by its ID to get its complete detailed metadata (which is required before redeploying it).

---

## 4. `server/services/sfMetadata.js`
This is the core deployment engine. It builds XML files, compresses them in memory, and deploys them to the Metadata API.

```javascript
const packageXml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Account</members>
        <name>CustomObject</name>
    </types>
    <version>59.0</version>
</Package>`;
```
* **Explanation**: Standard Salesforce manifest file declaring that we are deploying changes to a `CustomObject` named `Account`.

```javascript
function compileRuleXml(ruleDetails, isActive) {
  const metadata = ruleDetails.Metadata;
  const description = metadata.description ? `<description>${escapeXml(metadata.description)}</description>` : '';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <validationRules>
        <fullName>${ruleDetails.ValidationName}</fullName>
        <active>${isActive}</active>
        ${description}
        <errorConditionFormula>${escapeXml(metadata.errorConditionFormula)}</errorConditionFormula>
        <errorMessage>${escapeXml(metadata.errorMessage)}</errorMessage>
    </validationRules>
</CustomObject>`;
}
```
* **Explanation**: Compiles the validation rule metadata back into Salesforce's native XML file layout, setting the `<active>` flag to `true` or `false` dynamically. We use `escapeXml` to escape symbols like `<`, `>`, or `&` inside formulas so they don't break the XML parser.

```javascript
export async function deployRuleToggle(instanceUrl, accessToken, ruleDetails, isActive) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const zipChunks = [];
  
  archive.on('data', chunk => zipChunks.push(chunk));
```
* **Explanation**: Initializes the `archiver` zip engine with maximum compression (level 9). It creates an array `zipChunks` to capture the output stream as chunks in memory, avoiding saving files to the hard drive.

```javascript
  archive.append(packageXml, { name: 'package.xml' });
  archive.append(ruleXml, { name: `objects/Account.object` });
  await archive.finalize();
  
  const zipBuffer = Buffer.concat(zipChunks);
```
* **Explanation**: Appends our `package.xml` and our dynamic `objects/Account.object` XML file containing the toggled validation rule to the ZIP. `archive.finalize()` tells the archiver we are done, and `Buffer.concat` merges the array of buffers into a single binary block.

```javascript
  const formData = new FormData();
  formData.append('file', zipBuffer, { filename: 'package.zip', contentType: 'application/zip' });
  
  const resp = await axios.post(`${instanceUrl}/services/data/v59.0/metadata/deploy`, formData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...formData.getHeaders(),
    },
  });
  return resp.data;
}
```
* **Explanation**: Creates a multipart form-data payload containing the binary ZIP buffer and sends it to the Metadata REST deployment endpoint. It returns a `deployId` which we can poll.

---

## 5. `server/routes/auth.js`
Handles login, logout, and token session persistence.

```javascript
router.get('/login', (req, res) => {
  const env = req.query.env;
  const loginUrl = env === 'sandbox' ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
  const state = crypto.randomBytes(16).toString('hex');
```
* **Explanation**: Reads the sandbox parameter. Generates a random `state` parameter to prevent CSRF attacks.

```javascript
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
```
* **Explanation**: Implements PKCE. Generates a random cryptographically secure string (the verifier), and hashes it using SHA256 (the challenge) encoded in URL-safe base64.

```javascript
  req.session.oauthState = state;
  req.session.codeVerifier = codeVerifier;
  req.session.loginUrl = loginUrl;

  req.session.save((err) => {
    ...
    res.redirect(buildAuthorizeUrl(state, codeChallenge, loginUrl));
  });
});
```
* **Explanation**: Saves variables to the session store. `req.session.save()` is called manually to ensure the session is completely written to the store *before* the redirect headers are sent to the browser, avoiding a session write race condition.

---

## 6. `server/routes/rules.js`
Handles listing, toggling, and checking status.

```javascript
function normalizeRule(record) {
  return {
    id: record.Id,
    name: record.ValidationName,
    fullName: record.ValidationName,
    active: record.Active,
    description: record.Description || null,
    errorMessage: record.ErrorMessage || null,
    objectName: record.EntityDefinition?.QualifiedApiName || 'Account',
  };
}
```
* **Explanation**: This is an adapter. Salesforce returned fields have uppercase keys. The adapter normalizes them to camelCase properties so the React frontend is decoupled from the exact database column names of the Salesforce Tooling API.

```javascript
router.put('/:fullName/toggle', async (req, res) => {
  const { accessToken, instanceUrl } = req.session.sf;
  const { fullName } = req.params;
  try {
    const records = await getValidationRules(instanceUrl, accessToken);
    const rule = records.find((r) => r.ValidationName === fullName);
    ...
    const details = await getValidationRuleDetails(instanceUrl, accessToken, rule.Id);
    const newState = !details.Metadata?.active;
    
    const deployResult = await deployRuleToggle(instanceUrl, accessToken, details, newState);
    res.json({
      message: `Deploy started`,
      deployId: deployResult.id,
    });
  }
  ...
```
* **Explanation**: Toggles a validation rule. It fetches rules, finds the requested rule, queries its detailed formula/metadata, flips the active boolean flag, calls the metadata ZIP deploy function, and returns the `deployId`.

---

## 7. `client/src/services/api.js`
Communicates with the backend and handles cross-domain hostname resolution.

```javascript
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const apiBase = isLocal ? 'http://localhost:3001' : 'https://sf-rule-manager-backend.onrender.com'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || apiBase,
  withCredentials: true,
})
```
* **Explanation**: Dynamically checks the browser hostname. If running on Vercel, it routes all API requests to the Render backend domain. If running locally, it defaults to port 3001. `withCredentials: true` tells the browser to include session cookies in cross-origin HTTP requests.

---

## 8. `client/src/hooks/useAuth.js`
A custom hook that coordinates user sessions.

```javascript
export default function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function checkSession() {
      try {
        const data = await getMe()
        if (!cancelled) setUser(data.user)
      } catch (err) {
        ...
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    checkSession()
    return () => { cancelled = true }
  }, [])
```
* **Explanation**: Checks the session on component mount. It calls `/api/auth/me` to see if the user is authenticated. If the response returns the user object, it sets the `user` state. `cancelled = true` on unmount prevents memory leak state updates if the page is changed mid-request.

---

## 9. `client/src/pages/Login.jsx`
The entry landing page component.

```javascript
export default function Login() {
  const { isLoggedIn, loading, login } = useAuth()
  const [env, setEnv] = useState('production')
  const [searchParams, setSearchParams] = useSearchParams()
  const errorMsg = searchParams.get('error')
```
* **Explanation**: Reads current authentication state. Defines state for the dynamic login environment (`production` vs `sandbox`). Checks for an `error` query param in the redirect URL to capture callback failures.

```jsx
  return (
    ...
    {errorMsg && (
      <ErrorBanner
        message={decodeURIComponent(errorMsg)}
        onDismiss={() => setSearchParams({}, { replace: true })}
      />
    )}
    ...
    <select value={env} onChange={(e) => setEnv(e.target.value)}>
      <option value="production">Production / Developer Org</option>
      <option value="sandbox">Sandbox</option>
    </select>
    ...
    <button className="login-btn" onClick={() => login(env)}>
      Login with Salesforce
    </button>
  )
}
```
* **Explanation**: Renders the login card. It displays the `ErrorBanner` if an error occurs, renders the environment selector dropdown, and triggers `login(env)` on click to pass the selection to the backend redirect.

---

## 10. `client/src/pages/Dashboard.jsx`
Main page managing grid loads, toggle states, and recursive polling.

```javascript
  async function pollDeploy(deployId, fullName) {
    try {
      const status = await getDeployStatus(deployId)
      if (status.done) {
        setDeployingRules(prev => {
          const next = { ...prev }
          delete next[fullName]
          return next
        })
        if (status.success) {
          showToast(`Rule "${fullName}" updated successfully`)
          fetchRules()
        } else {
          showToast(status.error || 'Deployment failed', 'error')
          fetchRules()
        }
        return
      }
      pollTimers.current[fullName] = setTimeout(() => pollDeploy(deployId, fullName), 2500)
    }
    ...
```
* **Explanation**: Recursively polls deploy status. If the status returns `done = false`, it registers a new timeout check in `2.5 seconds`. Once `done = true`, it cleans up the card's deploying state, triggers a data reload, and shows a toast notification.

```javascript
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearTimeout)
    }
  }, [])
```
* **Explanation**: Essential cleanup function. When the user navigates away or logs out, this hook clears all active `setTimeout` timers to prevent background memory leaks.
