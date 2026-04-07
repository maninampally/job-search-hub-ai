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

### Step 5: Deploy to Production

Choose your deployment platform:

#### Option A: Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

#### Option B: Deploy to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Create new Web Service
4. Connect your GitHub repo
5. Set environment variables
6. Deploy

#### Option C: Deploy to DigitalOcean App Platform

1. Push to GitHub
2. Go to DigitalOcean → Apps
3. Click "Create App"
4. Connect GitHub repo
5. Add environment variables
6. Deploy

#### Option D: Deploy to VPS (self-hosted)

```bash
# SSH into your server
ssh user@your-server.com

# Clone repo
git clone <your-repo-url>
cd job-search-hub

# Copy .env
cp .env.production .env

# Build and run with Docker
docker compose up -d

# Or with systemd
sudo systemctl start job-search-hub
```

### Step 6: Verify Production Deployment

```bash
# Health check
curl https://yourdomain.com/health

# Check API response
curl https://yourdomain.com/api/jobs

# View audit logs
ssh user@your-server.com
tail -f server/data/audit-logs/audit-*.log
```

## Security Features Enabled in Production

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

# Watch rate limit breaches
grep "RATE_LIMIT" server/data/audit-logs/audit-*.log
```

### 4. Test Email Sync

1. Log in to production app
2. Create a test Gmail account
3. Connect Gmail via OAuth
4. Trigger sync manually
5. Verify 3-sync/hour rate limit works
6. Check audit logs

### 5. Set Up Monitoring

- Enable error tracking (Sentry, Rollbar)
- Set up performance monitoring (New Relic, DataDog)
- Monitor API response times
- Alert on rate limit breaches

### 6. First-Time Setup

1. Create admin user account
2. Configure SMTP for email notifications
3. Test backup/restore process
4. Document operational procedures

## Rollback Procedure

If deployment fails:

```bash
# Docker
docker compose down
docker compose up -d  # Previous version

# Railway
railway rollback

# Render
Go to Deployments → Previous deployment → Activate
```

## Troubleshooting

### Sync Not Working

```bash
# Check oauth_tokens table
SELECT * FROM oauth_tokens WHERE owner_user_id = 'user_id';

# Check token is encrypted
SELECT content->'tokens'->0->>'access_token' from oauth_tokens;
# Should show {iv, encryptedData, authTag} not plaintext

# Check rate limit
curl -X POST https://yourdomain.com/jobs/sync \
  -H "Authorization: Bearer token"
# Should return rate limit headers in response
```

### SSL Certificate Issues

```bash
# Renew Let's Encrypt certificate
sudo certbot renew --force-renewal

# Check certificate expiry
openssl s_client -connect yourdomain.com:443 -dates
```

### High Memory Usage

Check for sync hanging:

```bash
grep "SYNC" server/data/audit-logs/audit-*.log | grep -v "SYNC_COMPLETED"
# Kill stuck process and restart
docker compose restart api
```

## Security Considerations

1. **NEVER commit .env file** — .env is in .gitignore for safety
2. **Use strong passwords** — All secrets should be 32+ bytes
3. **Rotate keys periodically** — TOKEN_ENCRYPTION_KEY should be rotated quarterly
4. **Monitor audit logs** — Review for suspicious activity daily
5. **Keep deps updated** — Run `npm audit` monthly
6. **Use VPN for admin access** — Restrict admin panel access to known IPs
7. **Enable 2FA** — Use 2FA for Google OAuth and database access

## Performance Optimization

- Email sync runs at 9 AM UTC daily (configurable via SYNC_CRON)
- Max 3 syncs/user/hour to prevent API throttling
- Claude API calls include retry logic with exponential backoff
- Database uses connection pooling for optimal performance

## Support & Documentation

- **Bug Reports**: Create issue on GitHub
- **Security Issues**: Email security@yourdomain.com (don't use GitHub issues)
- **API Docs**: See `server/src/routes/` for endpoint documentation
- **Database Schema**: See `docs/database/schema.sql`

---

**Last Updated**: 2026-04-05
**Version**: 1.0.0 (Production Ready)
**Security Status**: ✅ Fully Hardened
