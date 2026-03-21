# Deployment Guide

## Step 1 — Google Cloud (10 mins)
1. console.cloud.google.com > New Project "Job Search Hub"
2. APIs & Services > Enable Gmail API
3. Credentials > Create OAuth 2.0 Client ID > Web application
4. Authorized redirect URI: https://YOUR-RAILWAY-APP.up.railway.app/auth/callback
5. Copy Client ID and Client Secret
6. OAuth consent screen > Add your Gmail as test user

## Step 2 — Railway (5 mins)
1. railway.app > New Project > Empty Project
2. Add Service > Upload the repository
3. Set Start Command to: node server/index.js
4. Settings > Networking > Generate Domain
5. Copy your domain and update Google Cloud redirect URI

## Step 3 — Environment Variables in Railway
Add these in your Railway project > Variables tab:

  GOOGLE_CLIENT_ID     = from Google Cloud
  GOOGLE_CLIENT_SECRET = from Google Cloud
  REDIRECT_URI         = https://YOUR-APP.railway.app/auth/callback
  ANTHROPIC_API_KEY    = from console.anthropic.com
  FRONTEND_URL         = your frontend URL
  PORT                 = 3001

## Step 4 — Update Frontend
Set your frontend backend URL to the Railway API domain (for example with VITE_BACKEND_URL).

## Step 5 — Connect Gmail
1. Open the Job Search Hub app
2. Dashboard > Gmail Auto Sync > Connect Gmail
3. Authorize read-only access on Google login page
4. Redirected back — "Gmail connected!" appears
5. Emails now sync automatically every 5 minutes

## Verify It Works
Visit https://YOUR-APP.railway.app/health
Expected response: {"status":"ok","version":"1.0.0"}
