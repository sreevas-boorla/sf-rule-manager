# SF Rule Manager

A web app that connects to any Salesforce org via OAuth 2.0 and lets admins view, enable, and disable validation rules on the Account object — without navigating Salesforce Setup.

## What It Does

1. **Login with Salesforce** — OAuth 2.0 Web Server flow. Supports any Developer/Production org.
2. **View Validation Rules** — Fetches all Account validation rules via the Tooling API.
3. **Toggle Rules** — Flip rules active/inactive. Changes are deployed back to the org using the Metadata API.
4. **See Deploy Status** — Real-time polling shows deployment progress.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Styling | Vanilla CSS |
| HTTP | Axios |
| Salesforce | OAuth 2.0, Tooling API, Metadata API (REST) |

## Project Structure

```
sf-rule-manager/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # Header, RuleCard, Loader, ErrorBanner
│   │   ├── pages/           # Login, Dashboard, NotFound
│   │   ├── hooks/           # useAuth
│   │   └── services/        # api.js (Axios wrapper)
│   └── vite.config.js       # Dev proxy to backend
├── server/                  # Express backend
│   ├── config/              # Salesforce connection config
│   ├── routes/              # auth.js, rules.js
│   ├── services/            # sfAuth, sfTooling, sfMetadata
│   └── middleware/          # authCheck
└── .env.example             # Required environment variables
```

## Prerequisites

- Node.js 18+
- A Salesforce Developer Org ([sign up free](https://developer.salesforce.com/signup))
- A Connected App in Salesforce (see setup below)
- At least 2-3 validation rules on the Account object

## Salesforce Setup

### 1. Create a Connected App

1. In Salesforce Setup, search for **App Manager**
2. Click **New Connected App**
3. Fill in:
   - **Connected App Name**: SF Rule Manager
   - **API Name**: SF_Rule_Manager
   - **Contact Email**: your email
4. Check **Enable OAuth Settings**
5. **Callback URL**: `http://localhost:3001/api/auth/callback`
6. **Selected OAuth Scopes**:
   - `Access the identity URL service (id, profile, email, address, phone)`
   - `Manage user data via APIs (api)`
   - `Perform requests at any time (refresh_token, offline_access)`
7. Save and wait ~10 minutes for it to activate
8. Note your **Consumer Key** and **Consumer Secret**

### 2. Create Validation Rules

Go to **Setup → Object Manager → Account → Validation Rules** and create a few test rules. Example:

- **Rule 1**: `Account_Name_Required` — `ISBLANK(Name)` — "Account name is required"
- **Rule 2**: `Phone_Format_Check` — `NOT(REGEX(Phone, "\\d{10}"))` — "Phone must be 10 digits"
- **Rule 3**: `Rating_When_Hot` — `ISPICKVAL(Rating, 'Hot') && ISBLANK(Description)` — "Hot accounts need a description"

## Local Development

### 1. Clone and install

```bash
git clone <your-repo-url>
cd sf-rule-manager

cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
# In the project root
cp .env.example .env
```

Edit `.env` with your Connected App credentials:

```
SF_CLIENT_ID=your_consumer_key
SF_CLIENT_SECRET=your_consumer_secret
SF_CALLBACK_URL=http://localhost:3001/api/auth/callback
SF_LOGIN_URL=https://login.salesforce.com
SESSION_SECRET=any-random-string-here
CLIENT_URL=http://localhost:5173
```

### 3. Start both servers

Terminal 1 — backend:
```bash
cd server
npm run dev
```

Terminal 2 — frontend:
```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

## How the OAuth Flow Works

1. User clicks "Login with Salesforce" → redirected to Salesforce login page
2. User authenticates → Salesforce redirects back with an authorization code
3. Backend exchanges the code for access/refresh tokens (server-to-server)
4. Tokens are stored in a server-side session (never exposed to the browser)
5. Frontend receives a session cookie and can make authenticated API calls

## How Rule Toggling Works

Toggling a rule is not a simple PATCH — Salesforce requires a full metadata deployment:

1. Backend fetches the complete rule metadata (formula, error message, etc.) via Tooling API
2. Builds an XML metadata package with the updated `active` flag
3. Zips the package and sends it to the Metadata API deploy endpoint
4. Polls the deployment status until it completes
5. Frontend shows real-time deploy progress

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set root directory to `client`
4. Add env var: `VITE_API_URL=https://your-backend.onrender.com`

### Backend → Render

1. Create a new Web Service on Render
2. Set root directory to `server`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all env vars from `.env`
6. Update `SF_CALLBACK_URL` to `https://your-backend.onrender.com/api/auth/callback`
7. Update `CLIENT_URL` to your Vercel frontend URL

Don't forget to update the Connected App's callback URL in Salesforce to match your deployed backend URL.

## Security Notes

- OAuth tokens are stored server-side only (httpOnly session cookie)
- Client secret never leaves the backend
- CSRF protection via OAuth state parameter
- CORS restricted to the frontend origin
- Session cookies are `secure` in production (requires HTTPS)

## License

MIT
