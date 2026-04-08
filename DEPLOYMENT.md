# Job Search Hub - Production Deployment Guide

**Status: 🎉 PRODUCTION READY - Security Hardened & All Vulnerabilities Fixed**

This guide covers deploying the Job Search Hub application to production with complete security hardening.

## Pre-Deployment Checklist

- ✅ All code changes committed
- ✅ All npm audit vulnerabilities fixed (0 vulnerabilities)
- ✅ Security hardening implemented (4 security modules)
- ✅ PII masking before Claude API calls
- ✅ OAuth token encryption (AES-256-GCM)
- ✅ Rate limiting (3 syncs/user/hour)
- ✅ Audit logging enabled
- ✅ Environment variables configured

## Quick Start for Production

### Step 1: Generate Security Keys

```bash
# Generate 32-byte encryption key (hex format, 64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate strong secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 2: Create Production .env File

Copy `.env.example` to `.env` and fill in production values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
REDIRECT_URI=https://yourdomain.com/auth/callback

# Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Security Keys (generate with commands above)
AUTH_TOKEN_SECRET=your_auth_token_secret
TOKEN_ENCRYPTION_KEY=your_32_byte_hex_encryption_key
SESSION_SECRET=your_session_secret

# Frontend & CORS
FRONTEND_URL=https://yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# Feature Flags
RATE_LIMIT_SYNC_PER_HOUR=3
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90

# SMTP (for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=noreply@yourdomain.com
```

### Step 3: Update Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "Credentials" → OAuth 2.0 Client IDs
4. Edit your app and add authorized redirect URIs:
   - `https://yourdomain.com/auth/callback`
   - Keep development URIs if needed: `http://localhost:3001/auth/callback`

### Step 4: Build Docker Images

```bash
docker compose build --no-cache
```

Verify builds:

```bash
docker images | grep job-search-hub
```

### Step 5: Run Locally with Docker

```bash
# Ensure .env exists at project root
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop containers
docker compose down
```

Verify it's running:
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","version":"1.0.0"}
```

## Local Development URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Production Deployment Notes

### 1. Data Loss Prevention (DLP)
- Email bodies sanitized before Claude API calls
- Masks: SSN, credit cards, passwords, API keys, passport numbers
- Prevents accidental PII exposure to third-party AI service

### 2. Token Encryption
- OAuth tokens encrypted with AES-256-GCM before Supabase storage
- Decrypted only during sync operations
- Encryption key rotatable via TOKEN_ENCRYPTION_KEY env var

### 3. Rate Limiting
- Max 3 email syncs per user per hour
- Prevents API credit abuse
- Configurable via RATE_LIMIT_SYNC_PER_HOUR

### 4. Audit Logging
- Logs all auth events (login, register, OAuth)
- Logs all sync operations (sync start, completion, errors)
- Logs security events (rate limit exceeded)
- Daily audit log files in `server/data/audit-logs/`
- 90-day retention by default
- Configurable  via AUDIT_LOG_RETENTION_DAYS

## Post-Deployment Tasks

### 1. Enable HTTPS/TLS

- Use Let's Encrypt for free SSL certificates
- Railway, Render, and DigitalOcean auto-enable HTTPS
- For VPS: Use certbot with nginx/apache

### 2. Configure Backups

- Enable Supabase automated backups
- Set up daily database backups
- Backup user data to secure storage

### 3. Monitor Audit Logs

```bash
# View today's audit logs
cat server/data/audit-logs/audit-$(date +%Y-%m-%d).log | jq .

# Monitor sync errors
grep "SYNC_ERROR" server/data/audit-logs/audit-*.log

## Security Features

The application includes several built-in security features:

### 1. Email Verification
- New users must verify email before accessing dashboard
- Google OAuth auto-verifies email (Google already verified it)
- Verification tokens expire after 24 hours

### 2. Environment Variables
- All secrets stored in `.env` (never committed to Git)
- API keys: Anthropic, Google OAuth, Supabase
- Session secrets for authentication

### 3. Password Security
- Passwords hashed with bcrypt
- Minimum 8 characters required
- Password confirmation on registration

### 4. OAuth Token Management
- Google tokens stored securely in Supabase
- Encrypted before storage for sensitive data
- Only accessible to authenticated users

## Development Notes

- Logs available via `docker compose logs backend`
- Data persisted in Docker volumes
- Supabase provides cloud database backup
- All authentication events logged

## Common Commands

```bash
# Start everything
docker compose up -d

# View backend logs
docker compose logs -f backend

# View frontend logs
docker compose logs -f frontend

# Stop all services
docker compose down

# Clean up volumes (resets data)
docker compose down -v
```

## Troubleshooting

### Google OAuth Not Working
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
- Ensure `REDIRECT_URI=http://localhost:3001/auth/callback` matches Google Console

### Email Not Sending
- Check `SMTP_HOST` and `SMTP_PORT` configuration
- Verify Resend API key is valid
- Check backend logs: `docker compose logs backend | grep -i email`

### Frontend Not Loading
- Ensure frontend is running: `docker compose ps`
- Check `VITE_BACKEND_URL` is set correctly
- Clear browser cache and hard refresh

## Next Steps

- Run `docker compose up --build` to start development
- Visit http://localhost:5173 to access the app
- See docs/DEPLOYMENT.md for Google OAuth setup instructions

---

**Last Updated**: 2026-04-07
**Version**: 1.0.0 (Local Development)
