# Local Development Setup Guide

## Step 1 — Google Cloud OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: "Job Search Hub"
3. Enable these APIs:
   - Gmail API
   - Google+ API
4. Go to **Credentials > Create OAuth 2.0 Client ID > Web application**
5. Add Authorized redirect URI: `http://localhost:3001/auth/callback`
6. Copy the **Client ID** and **Client Secret**
7. Go to **OAuth consent screen** and add your Gmail as a test user

## Step 2 — Anthropic API Key

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create an API key for Claude AI
3. Copy the key

## Step 3 — Environment Variables

Create a `.env` file at the project root:

```bash
cp .env.example .env
```

Fill in the required variables:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
REDIRECT_URI=http://localhost:3001/auth/callback
ANTHROPIC_API_KEY=your_anthropic_api_key
FRONTEND_URL=http://localhost:5173
PORT=3001
```

Optional but recommended:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=your_resend_api_key
MAIL_FROM=noreply@yourdomain.com
```

## Step 4 — Run Locally with Docker

```bash
cd job-search-hub
docker compose up --build
```

App URLs:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Step 5 — Connect Gmail (First Login)

1. Open http://localhost:5173
2. Click "🔐 Continue with Google"
3. Authorize the app to access your Gmail
4. Email automatically verified by Google
5. Dashboard available immediately

## Step 6 — Stop Development Server

```bash
docker compose down
```

## Verify It Works

```bash
# Health check
curl http://localhost:3001/health

# API status
curl http://localhost:3001/auth/status
```

Expected responses:
- `/health`: `{"status":"ok","version":"1.0.0"}`
- `/auth/status`: User authentication status
