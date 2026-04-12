# Job Search Hub - Backend Code Audit

**Date:** April 9, 2026  
**Scope:** Complete technical inventory of server infrastructure, API contracts, data flows, and integrations  
**Status:** Production-ready with noted improvements needed

---

## 1. API Endpoints Reference

### 1.1 Authentication Routes (`/auth`)

| Endpoint | Method | Auth | Rate Limit | Purpose |
|----------|--------|------|------------|---------|
| `/auth/register` | POST | None | 5/15min | Register new user account |
| `/auth/login` | POST | None | 5/15min | Login with email/password |
| `/auth/refresh` | POST | Cookie | None | Rotate refresh token, issue new access token |
| `/auth/logout` | POST | Bearer | None | Clear refresh cookie, end session |
| `/auth/sessions` | GET | Bearer | None | List all active sessions with device info |
| `/auth/sessions/:id` | DELETE | Bearer | None | End specific session by ID |
| `/auth/sessions/other` | DELETE | Bearer | None | End all OTHER sessions (current stays) |
| `/auth/verify-email` | POST | None | 5/15min | Verify email using OTP/token |
| `/auth/resend-verification` | POST | None | 5/15min | Resend verification email/OTP |
| `/auth/forgot-password` | POST | None | 5/15min | Initiate password reset flow |
| `/auth/reset-password` | POST | None | None | Complete password reset with token |
| `/auth/change-password` | POST | Bearer | None | Change password (requires current password) |
| `/auth/connect-gmail` | GET | Flexible | None | OAuth redirect to Google (returns auth code) |
| `/auth/connect-gmail/callback` | GET | Session | None | OAuth callback from Google (exchanges code for tokens) |
| `/auth/disconnect-gmail` | POST | Bearer | None | Revoke Gmail OAuth tokens |
| `/auth/mfa/setup` | POST | Bearer | None | Generate TOTP secret + QR code |
| `/auth/mfa/verify` | POST | Bearer | None | Verify TOTP code to complete enrollment |
| `/auth/mfa/disable` | POST | Bearer | None | Disable MFA (requires current TOTP) |
| `/auth/mfa/challenge` | POST | None | None | Verify TOTP during login pre-auth |
| `/auth/me` | GET | Bearer | None | Get current user profile + tier info |
| `/auth/profile` | PATCH | Bearer | None | Update user profile (name, headline, bio, etc) |

**Auth Strategy:**
- Access token: 15-min JWT in response body (stored in memory only)
- Refresh token: 7-day opaque token in httpOnly cookie (hashed in DB)
- MFA: 5-min pre-auth token for TOTP challenge
- Session: Device fingerprint (SHA256 of user-agent + IP) tracked in `user_sessions` table

---

### 1.2 Job Management Routes (`/jobs`, requires `requireUserAuth`)

| Endpoint | Method | Auth | Rate Limit | Tier | Purpose |
|----------|--------|------|-----------|------|---------|
| `/jobs` | GET | Bearer | None | Free+ | List all jobs with filters |
| `/jobs/:id` | GET | Bearer | None | Free+ | Get single job details + timeline |
| `/jobs` | POST | Bearer | None | Free+ | Create job manually (title, company, etc) |
| `/jobs/:id` | PATCH | Bearer | None | Free+ | Update job (title, status, notes) |
| `/jobs/:id` | DELETE | Bearer | None | Free+ | Delete job (soft or hard delete) |
| `/jobs/sync` | POST | Bearer | Rate per tier | Pro+ | Trigger Gmail sync (manual) |
| `/jobs/sync-status` | GET | Bearer | None | Pro+ | Get current sync status (per-user state) |
| `/jobs/backfill-emails` | POST | Bearer | None | Pro+ | Link existing Gmail messages to jobs |
| `/jobs/:id/timeline` | GET | Bearer | None | Free+ | Get status change timeline |
| `/jobs/:id/add-note` | POST | Bearer | None | Free+ | Add note to job |
| `/jobs/export/csv` | GET | Bearer | None | Free+ | Export jobs to CSV |

**Sync Rate Limits by Tier:**
- Free: 3 syncs/hour (or disabled if `ALLOW_FREE_TIER_GMAIL_SYNC=false`)
- Pro: 12 syncs/hour
- Elite: 30 syncs/hour
- Admin: 60 syncs/hour

---

### 1.3 AI Routes (`/ai`, requires `requireUserAuth`)

| Endpoint | Method | Auth | Tier | Quota | Purpose |
|----------|--------|------|------|-------|---------|
| `/ai/cover-letter` | POST | Bearer | Elite | 10/day | Generate AI cover letter |
| `/ai/interview-coach` | POST | Bearer | Elite | 20/day | Answer interview question with AI |
| `/ai/nudges` | GET | Bearer | Pro+ | None | Get smart follow-up suggestions (7+ days no update) |
| `/ai/usage` | GET | Bearer | Pro+ | None | Get today's AI usage stats |

**Multi-LLM Provider Support:**
- Default (Free/Pro): `gemini-2.5-flash-lite` (Google Generative AI)
- Elite: `claude-3-5-sonnet` (Anthropic) with fallback to Gemini
- Fallback: Gemini if primary provider fails
- Env vars: `LLM_PRO_PROVIDER`, `LLM_ELITE_PROVIDER`, `LLM_FALLBACK_PROVIDER`

---

### 1.4 Billing Routes (`/billing`, requires `requireUserAuth`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/billing/plan` | GET | Bearer | Get current plan + Stripe IDs |
| `/billing/checkout` | POST | Bearer | Create Stripe checkout session (sub: pro or elite) |
| `/billing/portal` | GET | Bearer | Get Stripe customer portal URL (manage subs) |
| `/billing/webhook` | POST | None (Stripe sig) | Stripe webhook (subscription events) |

**Stripe Events Handled:**
- `customer.subscription.created` - New subscription, update `user_plans.role` + `plan_expires`
- `customer.subscription.updated` - Plan change, update expiry
- `customer.subscription.deleted` - Subscription cancelled, revert to "free" tier

---

### 1.5 Admin Routes (`/admin`, requires `requireUserAuth` + `requireAdmin()`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/admin/users` | GET | Bearer + Admin | List all users (paginated, searchable) |
| `/admin/users/:id/role` | PATCH | Bearer + Admin | Change user tier (free/pro/elite/admin) |
| `/admin/users/:id/suspend` | POST | Bearer + Admin | Suspend user account |
| `/admin/users/:id/unsuspend` | POST | Bearer + Admin | Reactivate suspended account |
| `/admin/audit-log` | GET | Bearer + Admin | View audit log (paginated, filtered by action/user) |
| `/admin/metrics` | GET | Bearer + Admin | System metrics (users, revenue, AI usage) |

**Admin Requirements:**
- Role must be "admin"
- MFA must be enabled and passed (8-hour re-auth window)
- IP must be in `ADMIN_IP_ALLOWLIST` (if configured)

---

### 1.6 Contact Management Routes (`/contacts`, requires `requireUserAuth`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/contacts` | GET | Bearer | List contacts (filterable by name/email/company) |
| `/contacts` | POST | Bearer | Create new contact |
| `/contacts/:id` | PATCH | Bearer | Update contact details |
| `/contacts/:id` | DELETE | Bearer | Delete contact |

---

### 1.7 Reminder Routes (`/reminders`, requires `requireUserAuth`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/reminders` | GET | Bearer | List reminders (filterable by jobId, isDone) |
| `/reminders` | POST | Bearer | Create new reminder |
| `/reminders/:id` | PATCH | Bearer | Update reminder (title, dueDate, isDone) |
| `/reminders/:id` | DELETE | Bearer | Delete reminder |

---

### 1.8 Resume Management Routes (`/resumes`, requires `requireUserAuth`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/resumes/upload` | POST | Bearer | Upload resume file (PDF/DOCX, max 5MB) |
| `/resumes` | GET | Bearer | List all uploaded resumes |
| `/resumes/:id` | GET | Bearer | Download resume file |
| `/resumes/:id` | PATCH | Bearer | Update resume metadata (name, isPrimary) |
| `/resumes/:id` | DELETE | Bearer | Delete resume file |

---

### 1.9 Email Extraction Routes (`/api/extract`, requires `requireUserAuth`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/extract/request-otp` | POST | Bearer | Request OTP for email verification (1/min rate limit) |
| `/api/extract/verify-otp` | POST | Bearer | Verify OTP code (max 5 attempts, 15min lockout) |
| `/api/extract/verify-email` | POST | Bearer | Verify email with token |
| `/api/extract/status` | GET | Bearer | Check extraction/verification status |
| `/api/extract/audit-log` | GET | Bearer | View extraction audit log |

---

### 1.10 Outreach & Templates Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/outreach` | GET | Bearer | List outreach history |
| `/outreach` | POST | Bearer | Log outreach attempt (email, LinkedIn, etc) |
| `/templates/archive/files` | GET | Bearer | List available outreach templates |
| `/templates/archive/content` | GET | Bearer | Get template file content (with path traversal protection) |

---

### 1.11 Notification Routes (`/notifications`, requires `requireUserAuth`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/notifications` | GET | Bearer | Get unread notifications |
| `/notifications/:id/read` | PATCH | Bearer | Mark notification as read |
| `/notifications/read-all` | POST | Bearer | Mark all notifications as read |

---

### 1.12 System Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | None | Health check (status, uptime, version) |
| `/health/ready` | GET | None | Readiness probe (DB, SMTP, Stripe, Gemini checks) |
| `/mcp` | GET/POST | Token | Model Context Protocol (for Claude) |

---

## 2. Service Layer Architecture

### 2.1 Service Modules

```
server/src/services/
├── auditService.js           Log all sensitive actions (immutable records)
├── coverLetterService.js     Generate cover letters (Elite + Gemini)
├── dbAdapter.js              Supabase query interface (SQL wrapper)
├── emailExtractionService.js OTP + token verification for email access
├── followUpService.js        Smart nudges for stale applications (7+ days)
├── interviewCoachService.js  Q&A coaching (Elite + AI multi-provider)
├── jobExtractor.js           Parse emails, extract job info (Gemini → job records)
├── jobSync.js                Gmail sync orchestration (fetch, process, store)
├── llmSelector.js            Multi-LLM provider routing (Gemini/Claude/GPT)
├── mfaService.js             TOTP generation + backup codes (speakeasy lib)
├── notificationService.js    In-app alerts + email reminders
└── syncState.js              Per-user sync lock + status tracking
```

### 2.2 Service Dependencies & Responsibilities

#### **auditService**
- **Exports:** `logAuditEvent()`, `auditRegister()`, `auditLogin()`, `auditPasswordChange()`, `auditMFASetup()`, `auditOAuthConnect()`, etc.
- **Responsibility:** Write-only to `audit_log` table. No updates, no deletes. Tracks all auth, role changes, OAuth events.
- **Retention:** Automatic cleanup after `AUDIT_LOG_RETENTION_DAYS` (default 90 days)

#### **jobExtractor**
- **Exports:** `extractJobInfo(emailBody, normalizations)`
- **Responsibility:** Parse email content using Gemini AI to extract:
  - Job title, company, status (Applied/Interview/Offer/etc)
  - Email type (Recruiter Outreach, Interview Scheduled, Rejection, Offer)
  - Normalize against ruleset if Gemini unavailable (fallback extraction)
- **Cooldown:** If Gemini quota/key error, block for `GEMINI_COOLDOWN_HOURS` (default 6 hours)

#### **jobSync**
- **Exports:** `fetchJobEmails({ mode, userId, forceReprocess })`
- **Responsibility:** 
  - Connect to Gmail via OAuth tokens
  - Query emails based on mode (initial: 30 days, daily: 1 day)
  - Extract jobs from emails using `jobExtractor`
  - Deduplicate by email message ID
  - Store job + email + timeline records
  - Update sync status per-user
- **Concurrency:** `SYNC_PROCESSING_CONCURRENCY` (default 1, configurable)
- **Rate Limits:** Per-tier limits on manual trigger

#### **coverLetterService**
- **Exports:** `generateCoverLetter(jobTitle, company, jobDescription, userProfile)`
- **Responsibility:** Call Gemini AI to generate professional cover letter (3 paragraphs)
- **Quota:** 10 generations/day per user (tracked in `ai_usage` table)
- **Tier:** Elite only

#### **interviewCoachService**
- **Exports:** `getInterviewCoaching(question, jobContext)`
- **Responsibility:** Call multi-provider LLM (Claude preferred for elite) for interview Q&A
- **Quota:** 20 answers/day per user
- **Tier:** Elite only

#### **mfaService**
- **Exports:** `generateMFASecret()`, `verifyMFAToken()`, `generateBackupCodes()`, `verifyBackupCode()`
- **Responsibility:** TOTP management using `speakeasy` library
  - Generate secret + QR code on enrollment
  - Verify 6-digit codes (2-window tolerance)
  - Generate 8 backup codes (shown once, hashed in DB)

#### **notificationService**
- **Exports:** `createNotification()`, `getUnreadNotifications()`, `markNotificationRead()`, `checkStaleJobs()`, `sendWelcomeNotification()`
- **Responsibility:** In-app notifications + optional email webhooks
- **Types:** STALE_JOB, WEEKLY_DIGEST, PLAN_EXPIRING, WELCOME, SECURITY_ALERT

#### **emailExtractionService**
- **Exports:** `requestOTP()`, `verifyOTP()`, `verifyEmailToken()`, `getExtractionStatus()`
- **Responsibility:** Email verification flow for accessing user's Gmail
- **OTP Delivery:** Via email (nodemailer) or console (dev mode)
- **Lockout:** 15 minutes after 5 failed attempts

#### **followUpService**
- **Exports:** `getFollowUpNudges(userId)`
- **Responsibility:** Query jobs with status Applied/Screening unchanged for 7+ days, suggest follow-up
- **Tier:** Pro+

#### **dbAdapter**
- **Exports:** `query(sql, params)`
- **Responsibility:** Unified SQL interface for Supabase
  - Detects complex queries (JOINs, GROUP BY, ON CONFLICT, RETURNING)
  - Uses `rpc()` for complex, simple query builder for simple
  - Fallback parsing for compatibility

---

## 3. Database Schema Overview

### 3.1 Core Tables

#### `app_users` (User Accounts)
```
id              UUID PK DEFAULT gen_random_uuid()
email           TEXT NOT NULL UNIQUE
password_hash   TEXT NOT NULL (bcrypt cost 12)
name            TEXT NOT NULL DEFAULT 'User'
headline        TEXT NOT NULL DEFAULT ''
location        TEXT NOT NULL DEFAULT ''
bio             TEXT NOT NULL DEFAULT ''
last_login_at   TIMESTAMPTZ
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() (auto via trigger)
is_suspended    BOOLEAN DEFAULT FALSE
```
**Indexes:** `idx_app_users_email`  
**Trigger:** Auto-update `updated_at` on every write

#### `user_plans` (Billing & Tier)
```
user_id                UUID PK REFERENCES app_users(id) ON DELETE CASCADE
role                   TEXT NOT NULL DEFAULT 'free'
stripe_customer_id     TEXT (nullable, set on first checkout)
stripe_subscription_id TEXT (nullable, set when active)
plan_expires           TIMESTAMPTZ (nullable = lifetime; else unix timestamp)
updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
**Indexes:** `idx_user_plans_stripe_customer_id`, `idx_user_plans_stripe_subscription_id`  
**Note:** `role` is source of truth for billing (also mirrored on app_users for convenience)

#### `user_sessions` (Refresh Tokens & Devices)
```
id                  UUID PK DEFAULT gen_random_uuid()
user_id             UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
token_hash          TEXT NOT NULL (SHA256 of refresh token)
device_fingerprint  TEXT (SHA256 of user-agent + IP, first 16 chars)
ip_address          TEXT
user_agent          TEXT
last_active         TIMESTAMPTZ NOT NULL DEFAULT NOW()
expires_at          TIMESTAMPTZ NOT NULL (7 days from creation)
created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
**Indexes:** `idx_user_sessions_token_hash` (fast refresh), `idx_user_sessions_user_id` (list sessions), `idx_user_sessions_expires_at` (cleanup)  
**Strategy:** Detect token replay after rotation -> delete ALL sessions, send security alert

#### `mfa_config` (TOTP & Backup Codes)
```
user_id          UUID PK REFERENCES app_users(id) ON DELETE CASCADE
totp_secret      TEXT (encrypted at rest with AES-256-GCM)
totp_enabled     BOOLEAN NOT NULL DEFAULT FALSE
backup_codes     JSONB (array of SHA256 hashes)
enrolled_at      TIMESTAMPTZ
```
**Indexes:** `idx_mfa_config_user_id` (fast lookup on mfa_passed check)  
**Note:** TOTP secret stored encrypted; backup codes never stored plaintext

#### `jobs` (Job Applications)
```
id               UUID PK DEFAULT gen_random_uuid()
user_id          UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
title            TEXT NOT NULL
company          TEXT NOT NULL
status           TEXT NOT NULL DEFAULT 'Applied' (Wishlist|Applied|Screening|Interview|Offer|Rejected)
notes            TEXT
applied_on       TIMESTAMPTZ
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `job_emails` (Email-to-Job Mapping)
```
id               UUID PK DEFAULT gen_random_uuid()
job_id           UUID REFERENCES jobs(id) ON DELETE CASCADE
user_id          UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
gmail_message_id TEXT UNIQUE (prevents duplicate imports)
email_type       TEXT (Recruiter Outreach|Interview Scheduled|Offer|Rejection|Auto / Tracking)
subject          TEXT
body             TEXT
from_address     TEXT
received_at      TIMESTAMPTZ
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `job_status_timeline` (Historical Status Changes)
```
id               UUID PK DEFAULT gen_random_uuid()
job_id           UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE
user_id          UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
old_status       TEXT
new_status       TEXT
changed_at       TIMESTAMPTZ DEFAULT NOW()
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `contacts` (Recruiter/Network Contacts)
```
id               UUID PK DEFAULT gen_random_uuid()
user_id          UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
name             TEXT NOT NULL
email            TEXT
phone            TEXT
company          TEXT
role             TEXT
linkedinUrl      TEXT
notes            TEXT
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `reminders` (Follow-Up Reminders)
```
id               UUID PK DEFAULT gen_random_uuid()
user_id          UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
job_id           UUID REFERENCES jobs(id) ON DELETE CASCADE (nullable)
title            TEXT NOT NULL
dueDate          TIMESTAMPTZ
isDone           BOOLEAN DEFAULT FALSE
notes            TEXT
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `resumes` (Uploaded Resume Files)
```
id               UUID PK DEFAULT gen_random_uuid()
user_id          UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
name             TEXT NOT NULL (user-facing name)
fileName         TEXT NOT NULL (original upload name)
filePath         TEXT NOT NULL (on-disk path)
mimeType         TEXT (application/pdf or application/vnd.openxmlformats...)
fileSize         INTEGER
linkedJobId      UUID REFERENCES jobs(id) ON DELETE SET NULL
isPrimary        BOOLEAN DEFAULT FALSE
uploadedAt       TIMESTAMPTZ NOT NULL
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `outreach_log` (Recruitment Outreach)
```
id               UUID PK DEFAULT gen_random_uuid()
user_id          UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL
contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL
method           TEXT (email|linkedin|phone|other)
date             TIMESTAMPTZ NOT NULL DEFAULT NOW()
success          BOOLEAN
response         TEXT
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `notifications` (In-App Alerts)
```
id               UUID PK DEFAULT gen_random_uuid()
user_id          UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
type             TEXT (stale_job|weekly_digest|plan_expiring|welcome|security_alert)
title            TEXT NOT NULL
body             TEXT NOT NULL
metadata         JSONB (context-specific data)
read             BOOLEAN DEFAULT FALSE
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `audit_log` (Immutable Event Record)
```
id               UUID PK DEFAULT gen_random_uuid()
user_id          UUID (nullable - for self-service actions)
admin_id         UUID (nullable - for admin actions)
action           TEXT NOT NULL (register|login|password_change|mfa_setup|oauth_connect|role_change|etc)
resource         TEXT (user|job|contact|etc)
resource_id      TEXT (UUID of affected resource)
metadata         JSONB (action-specific context)
ip_address       TEXT
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() (append-only index)
```
**Indexes:** `idx_audit_log_user_id`, `idx_audit_log_admin_id`, `idx_audit_log_created_at` (DESC), `idx_audit_log_action`  
**Retention:** Automatic cleanup after `AUDIT_LOG_RETENTION_DAYS` (default 90 days)

#### `ai_usage` (AI Feature Quota Tracking)
```
id               UUID PK DEFAULT gen_random_uuid()
user_id          UUID REFERENCES app_users(id) ON DELETE CASCADE
feature          TEXT (cover_letter|interview_coach)
created_at       TIMESTAMPTZ DEFAULT NOW()
```
**Indexes:** `idx_ai_usage_user_date` (for daily quota counts), `idx_ai_usage_feature`

#### `oauth_tokens` (Gmail OAuth Credentials)
```
user_id          UUID PK REFERENCES app_users(id) ON DELETE CASCADE
access_token     TEXT NOT NULL (encrypted AES-256-GCM)
refresh_token    TEXT (encrypted, nullable for some flow types)
expires_at       TIMESTAMPTZ
last_checked     TIMESTAMPTZ
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
**Note:** Tokens encrypted at application level before storage

---

## 4. Data Flows

### 4.1 User Registration Flow

```
Client                     Server                      Database
  |                          |                            |
  +---> POST /auth/register  |                            |
        (email, pwd, name)   |                            |
                             |---> Rate limit check       |
                             |---> Validate input (zod)   |
                             |---> Hash password (bcrypt) |
                             |---> Create user record     +--> INSERT app_users
                             |                            |    INSERT user_plans (role='free')
                             |---> Create session         +--> INSERT user_sessions
                             |---> Audit log              +--> INSERT audit_log (register)
                             |---> Send verification OTP  
                             |<------ SUCCESS             |
  <------ 200: { userId, accessToken, requiresEmailVerification }
```

**Key Steps:**
1. Rate limit: 5 attempts per email + IP per 15 min
2. Validate email format, password strength (via zod)
3. Hash password with bcrypt (cost 12)
4. Create user + free tier plan + initial session
5. Log event to audit_log
6. Send verification email (OTP or token)
7. Response includes access token (15 min) + refresh cookie (7 days)

---

### 4.2 Login + MFA Flow

```
Client                     Server                      Database
  |                          |                            |
  +---> POST /auth/login     |                            |
        (email, password)    |                            |
                             |---> Rate limit check       |
                             |---> Find user by email     +--> SELECT app_users WHERE email
                             |---> Verify password        |
                             |---> Check email verified   |
                             |                            |
                             |---> If MFA enabled:        |
                             |      Issue pre-auth token  |
                             |      (5 min TTL)           |
                             |<------ 200: { preAuthToken, requiresMfa: true }
  <------ (user opens MFA modal)
                             |
  +---> POST /auth/mfa/challenge
        (code from Authenticator)
                             |---> Get MFA config        +--> SELECT mfa_config WHERE user_id
                             |---> Verify TOTP code      |
                             |---> OR verify backup code  |
                             |---> Create session         +--> INSERT user_sessions
                             |---> Audit log              +--> INSERT audit_log (login)
                             |<------ SUCCESS             |
  <------ 200: { accessToken, refreshToken (cookie) }
```

**Key Points:**
- If MFA enrolled, issue short-lived pre-auth token after password check
- User must verify TOTP within 5 min window
- On success: issue session (token_hash stored), access token (15 min), refresh cookie (7 days)
- Audit log records login + whether MFA passed
- Device fingerprint tracked for stolen refresh detection

---

### 4.3 Gmail Sync Flow

```
Client                     Server                      Database       Gmail API
  |                          |                            |               |
  +---> POST /jobs/sync      |                            |               |
        (forceReprocess,     |---> Check tier (Pro+)      |               |
         fullWindow)         |---> Rate limit check       |               |
                             |---> Acquire sync lock      +--> UPDATE syncStatus
                             |---> Get OAuth tokens       +--> SELECT oauth_tokens
                             |---> Decrypt tokens         |
                             |---> Create Gmail client    |
                             |                            |    +---> gmail.users.messages.list
                             |<--+(background job starts)         (subject: job keywords)
  <------ 202: { started: true, isSyncing: true }
                             |
                             |---> Fetch messages list    +-----> (paginated, 100 per page)
                             |---> For each message:      |
                             |      Get full message      +-----> gmail.users.messages.get
                             |      Check if processed    +--> SELECT job_emails WHERE gmail_message_id
                             |      Extract job info      |
                             |        (jobExtractor)      |
                             |      Save job record       +--> INSERT/UPDATE jobs
                             |      Create job_email      +--> INSERT job_emails
                             |      Add status timeline   +--> INSERT job_status_timeline
                             |      Update sync status    +--> UPDATE syncStatus
                             |---> After all: Cleanup     |
                             |      Release sync lock     +--> UPDATE syncStatus.isSyncing=false
                             |
                             +---> (in background, but poll /jobs/sync-status gets results)
```

**Modes:**
- **Initial sync:** Uses `INITIAL_SYNC_LOOKBACK_DAYS` (default 30) as Gmail `newer_than:Nd`
- **Daily incremental:** Uses `DAILY_SYNC_LOOKBACK_DAYS` (default 1)
- **Manual full window:** `fullWindow=true` forces re-processing with `INITIAL_SYNC_LOOKBACK_DAYS`

**Email Extraction:**
- Query Gmail with: `subject:(application OR applied OR interview OR offer OR rejected OR job OR position OR role OR hiring OR recruiter)`
- Extract via Gemini AI: job title, company, role, status, email type
- Fallback to rule-based extraction if Gemini unavailable
- Sanitize email body (remove PII) before sending to AI

**Concurrency:**
- Per-user sync lock prevents overlapping syncs
- Global scheduler calls `fetchJobEmails()` for all active users at `SYNC_CRON` time (default 9 PM)

---

### 4.4 AI Cover Letter Generation Flow

```
Client                     Server                      Database     Gemini API
  |                          |                            |              |
  +---> POST /ai/cover-letter|                            |              |
        (jobTitle, company   |---> Check tier (Elite)     |              |
         jobDescription,     |---> Check daily quota      +--> SELECT COUNT(ai_usage)
         resumeText)         |                            |              |
                             |---> Validate inputs        |              |
                             |---> Sanitize job desc      |              |
                             |      (remove PII)          |              |
                             |---> Build prompt           |              |
                             |---> Call Gemini            +-----> generateContent()
                             |                            |       (3-paragraph prompt)
                             |<------ Get response        |              |
                             |---> Log usage              +--> INSERT ai_usage
                             |<------ 200: { coverLetter, wordCount, quotaUsed, quotaLimit }
```

**Quota Tracking:**
- Daily quota: 10 cover letters per elite user
- Reset at midnight UTC
- Check before calling AI to avoid waste

**Error Handling:**
- If Gemini quota exceeded: Return 429 with quota info
- If key missing: Return 500
- If prompt generation fails: Return 400

---

### 4.5 Refresh Token Rotation Flow

```
Client                     Server                      Database
  |                          |                            |
  +---> POST /auth/refresh   |                            |
        (httpOnly cookie     |---> Read refresh cookie    |
         in request)         |---> Hash token (SHA256)    |
                             |---> Lookup in user_sessions +--> SELECT user_sessions WHERE token_hash
                             |                            |
                             |---> If found:<br>                |
                             |      Delete old session    +--> DELETE user_sessions WHERE id=...
                             |      Generate new token    |
                             |      Create new session    +--> INSERT user_sessions (expires_at=now+7d)
                             |      Issue new cookie      |
                             |      Issue new access JWT  |
                             |<------ 200: { accessToken }
                             |        (refresh cookie set in Set-Cookie header, httpOnly)
  <------ 200 + Set-Cookie: refreshToken (httpOnly, secure, samesite=strict)
```

**Security:**
- Refresh token never stored plaintext, only SHA256 hash
- Each refresh deletes old token and creates new one
- If old token used again after rotation: Detect as theft, delete ALL user sessions, send alert
- Refresh cookie: `httpOnly=true, Secure=true (prod only), SameSite=Strict`

---

## 5. Integration Points

### 5.1 Gmail OAuth (Pattern B with PKCE)

**Flow:**
1. Client clicks "Connect Gmail"
2. Server generates `code_verifier` + `code_challenge` (PKCE)
3. Server creates OAuth init URL with `state` (CSRF token stored in server session)
4. Redirect to Google Auth
5. User grants `gmail.readonly` scope
6. Google redirects to `/auth/connect-gmail/callback?code=...&state=...`
7. Server validates `state`, exchanges `code` for tokens (with `code_verifier`)
8. Encrypt tokens, store in `oauth_tokens` table
9. Set `last_checked` timestamp

**Env Vars Required:**
- `GOOGLE_CLIENT_ID` - OAuth app client ID
- `GOOGLE_CLIENT_SECRET` - OAuth app secret
- `REDIRECT_URI` - Callback URL (e.g., `https://api.jobsearchhub.com/auth/connect-gmail/callback`)

**Libraries:**
- `googleapis` (v118+) - Google APIs
- Direct use of `google.auth.OAuth2`

**Token Encryption:**
- Method: AES-256-GCM (symmetric encryption)
- Key source: `TOKEN_ENCRYPTION_KEY` env var (min 32 chars)
- Tokens stored encrypted in `oauth_tokens` table

---

### 5.2 Google Generative AI (Gemini)

**Models:**
- Pro/Free default: `gemini-2.5-flash-lite` (fast, cheap)
- Elite: Falls back to `gemini-2.5-flash-lite` if primary unavailable
- Fallback: Always `gemini-2.5-flash-lite`

**Endpoints Used:**
- Job extraction: `generateContent(prompt)` with email body
- Cover letter: `generateContent(prompt)` with job description
- Interview coaching: `generateContent(prompt)` with question

**Env Vars:**
- `GEMINI_API_KEY` - API key for Google AI Studio
- `GEMINI_MODEL` - Default model (default: `gemini-2.5-flash-lite`)
- `GEMINI_COOLDOWN_HOURS` - Hours to block after quota/key error (default: 6)

**Error Handling:**
- If quota exceeded: Mark unavailable for `GEMINI_COOLDOWN_HOURS`, fall back to rule-based extraction
- If key invalid: Warn at startup, fail gracefully on extraction attempts

**Data Privacy:**
- Email body sanitized before sending (PII removal)
- Job description sanitized before sending
- No user PII sent in prompts

---

### 5.3 Anthropic Claude (Multi-LLM)

**Usage:**
- Elite tier interview coach when `LLM_ELITE_PROVIDER=claude-3-5-sonnet`
- Falls back to Gemini if Anthropic fails

**Env Vars:**
- `ANTHROPIC_API_KEY` - API key (optional, only if using Claude)
- `LLM_ELITE_PROVIDER` - Set to `claude-3-5-sonnet` to enable

**Integration:**
- Lazy-loaded in `llmSelector.js`
- Falls through to Gemini if not configured

---

### 5.4 Stripe Billing

**Flow:**
1. User clicks "Upgrade to Pro/Elite"
2. POST `/billing/checkout` with tier ('pro' or 'elite')
3. Server creates/gets Stripe customer
4. Creates checkout session (subscription mode)
5. Returns `session.url` for redirect
6. User completes payment
7. Stripe sends webhook to `/billing/webhook`
8. Server validates signature (Stripe webhook secret)
9. Updates `user_plans` and `app_users.role`

**Env Vars:**
- `STRIPE_SECRET_KEY` - Secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- `STRIPE_PRICE_PRO` - Price ID for Pro subscription
- `STRIPE_PRICE_ELITE` - Price ID for Elite subscription

**Webhook Events:**
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Plan change/renewal
- `customer.subscription.deleted` - Cancellation

**Metadata Stored:**
- `stripe_customer_id` - Customer ID (for portal, webhooks)
- `stripe_subscription_id` - Subscription ID
- `plan_expires` - Unix timestamp when plan expires (or null for lifetime)

---

### 5.5 SMTP Email (nodemailer)

**Usage:**
- Email verification OTP
- Password reset links
- Notifications (welcome, stale job alerts, plan expiration)
- Security alerts (login from new device, failed MFA)

**Env Vars:**
- `SMTP_HOST` - Email server hostname (e.g., smtp.gmail.com)
- `SMTP_PORT` - Port (default 587)
- `SMTP_USER` - Username/email
- `SMTP_PASS` - Password or app password
- `SMTP_FROM_EMAIL` - Sender email (e.g., noreply@jobsearchhub.local)
- `SMTP_FROM_NAME` - Sender name (e.g., "Job Search Hub")
- `SMTP_SECURE` - Use TLS (default true)
- `OTP_SEND_MODE` - "email" (production) or "console" (development)

**Fallback:**
- If nodemailer not installed, all email sends logged as warnings (local dev)

---

### 5.6 Supabase (Database)

**Connection:**
- REST API via `@supabase/supabase-js` client
- Service role key (allows bypass RLS for server-side operations)

**Env Vars:**
- `SUPABASE_URL` - Project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep private!)

**Operations:**
- Hybrid: Uses simple query builder for SELECT/INSERT/UPDATE/DELETE
- Falls back to `rpc()` for complex queries (JOINs, GROUP BY, COALESCE, etc)

**Fallback (Local Dev):**
- If Supabase not configured, uses in-memory JSON file (`data/users-local-store.json`) for user storage
- Useful for offline development

---

## 6. Middleware & Security

### 6.1 Authentication Middleware

#### `requireUserAuth`
- Reads `Authorization: Bearer <token>` header
- Validates JWT with `AUTH_TOKEN_SECRET`
- Attaches `req.authUser` (user object) and `req.user` (JWT claims)
- Returns 401 if missing or invalid

#### `requireUserAuthFlexible`
- Accepts Bearer token OR httpOnly refresh cookie
- Used for OAuth callbacks (browser navigation, no auth header)
- Does NOT rotate token (read-only)

#### `requireEmailVerified`
- Checks `req.user.email_verified` from JWT + DB
- Returns 403 if not verified
- Used for sensitive operations

---

### 6.2 Tier Gating Middleware

#### `requireTier(tier, featureLabel)`
- Checks `req.user.role` against tier hierarchy
  - Hierarchy: `free < pro < elite < admin`
  - `requireTier('pro')` allows: pro, elite, admin
- Checks `plan_expires` timestamp (in seconds)
  - If expired: return 402 with upgrade_required
  - If null: lifetime access (free tier, or legacy)
- Returns 402 with `{ error: 'upgrade_required', min_tier, feature }`

#### `requireTierGmailSync`
- Special case: checks `ALLOW_FREE_TIER_GMAIL_SYNC` env var
- If true (default in non-production): allows free users
- If false (production default): requires Pro+

---

### 6.3 Admin Middleware

#### `requireAdmin`
- Checks `req.user.role === 'admin'`
- Checks `req.user.mfa_passed === true` (admins must have MFA)
- Optional IP allowlist check via `ADMIN_IP_ALLOWLIST` env var
  - Comma-separated IPs: `192.168.1.1,10.0.0.5`
  - Empty string: allow all IPs
  - Normalizes IPv6 loopback (`::1`) to IPv4 loopback
- Returns 403 if role not admin, MFA not passed, or IP not allowed

---

### 6.4 Rate Limiting

#### `rateLimitAuth`
- Applied to: `/auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/forgot-password`
- Per-IP limit: 10 attempts per 15 min (prevents distributed attacks)
- Per-email limit: 5 attempts per 15 min (prevents enumeration + brute force)
- Returns 429 with `retryAfter` seconds

#### `rateLimitEmailVerification`
- Applied to `/auth/request-otp`, `/auth/verify-otp`
- OTP request: 1 per minute per user
- OTP verify: 5 attempts per 15 min (then 15 min lockout)

#### `rateLimitMiddleware` (Sync)
- Applied to `/jobs/sync`
- Per-tier rate limits:
  - Free: 3/hour (or disabled)
  - Pro: 12/hour
  - Elite: 30/hour
  - Admin: 60/hour
- In-memory tracking (replace with Redis in production)

---

### 6.5 Data Loss Prevention (DLP)

#### `sanitizeEmailForAI`
- Called before sending any email/attachment to Gemini
- Removes PII patterns:
  - Credit/debit cards (13-19 digits)
  - SSN (XXX-XX-XXXX)
  - Phone numbers (+1-XXX-XXX-XXXX variants)
  - Passport/ID numbers
  - Bank account numbers
  - GPS coordinates
- Removes sensitive content:
  - Salary/compensation amounts
  - Performance review text
- Replaces with `[REDACTED]`

#### `sanitizeEmailSubject`
- Removes `[CONFIDENTIAL]`, `[PRIVATE]`, `[SECRET]` markers
- Removes salary/comp/pay mention

---

### 6.6 Input Validation

#### `validate` Middleware
- Applied to routes that accept JSON body
- Uses `zod` for schema validation
- Example:
  ```js
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });
  validate(schema)(req, res, next);
  ```

---

## 7. Error Handling & Logging

### 7.1 Structured Logger

**Location:** `server/src/utils/logger.js`

**Methods:**
- `logger.debug(message, metadata)` - Debug level (skip in production)
- `logger.info(message, metadata)` - Info (default level)
- `logger.warn(message, metadata)` - Warnings (continue)
- `logger.error(message, metadata)` - Errors (critical info)

**Output:**
- Development: Human-readable with timestamp, level, metadata
- Production: JSON format (for log aggregation/parsing)

**Environment:**
- `LOG_LEVEL` env var: DEBUG, INFO, WARN, ERROR (default: INFO)
- `ENVIRONMENT` env var: production or development

---

### 7.2 Error Response Format

**Common Patterns:**

```json
// 400 Bad Request
{ "error": "Invalid input", "details": "..." }

// 401 Unauthorized
{ "error": "Authentication required" }

// 402 Payment Required (tier gating)
{ "error": "upgrade_required", "min_tier": "pro", "feature": "gmail_sync" }

// 403 Forbidden (admin/email verified required)
{ "error": "forbidden", "reason": "admin_required" }

// 404 Not Found
{ "error": "Not found" }

// 429 Too Many Requests
{ "error": "too_many_requests", "retryAfter": 900 }

// 500 Internal Server Error
{ "error": "Internal server error" }  // (production hides detail)
```

---

### 7.3 Audit Logging

**Recorded Actions:**
- User registration (email, IP)
- User login (email, IP, MFA status)
- Password changes
- Email verification
- MFA setup/disable
- OAuth connect/disconnect
- Role changes (admin action)
- User suspension (admin action)
- Failed login attempts

**Table:** `audit_log` (append-only, immutable)

**Retention:** Automatic cleanup after `AUDIT_LOG_RETENTION_DAYS` (default 90)

---

## 8. Environment Configuration

### 8.1 Required Variables (All Environments)

```
GOOGLE_CLIENT_ID              # OAuth app client ID
GOOGLE_CLIENT_SECRET          # OAuth app secret
REDIRECT_URI                  # OAuth callback URL
GEMINI_API_KEY                # Google Generative AI key
AUTH_TOKEN_SECRET             # JWT signing secret (min 32 chars)
SESSION_SECRET                # Express session secret (min 32 chars)
```

### 8.2 Production-Only Required Variables

```
SUPABASE_URL                  # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY     # Supabase service role key
TOKEN_ENCRYPTION_KEY          # AES-256 key for OAuth tokens (min 32 chars)
FRONTEND_URL                  # Frontend origin (CORS, OAuth redirects)
SMTP_HOST                     # Email server hostname
SMTP_USER                     # Email username
SMTP_PASS                     # Email password
```

### 8.3 Optional Variables (Recommended for Production)

```
PORT                          # Server port (default 3001)
NODE_ENV                      # "development" or "production"
ENVIRONMENT                   # "development", "production", or "staging"
CORS_ALLOWED_ORIGINS          # Comma-separated allowed origins
EXTERNAL_API_TIMEOUT_MS       # Timeout for external API calls (default 12000)
RETRY_ATTEMPTS                # Retry count for failed requests (default 2)

# Gmail Sync Configuration
INITIAL_SYNC_LOOKBACK_DAYS    # Days for first sync (default 30)
DAILY_SYNC_LOOKBACK_DAYS      # Days for daily sync (default 1)
GMAIL_SYNC_MAX_RESULTS_PER_PAGE # Max messages per Gmail API page (default 100)
INITIAL_SYNC_MAX_MESSAGES     # Max initial sync messages (default 1000)
INCREMENTAL_SYNC_MAX_MESSAGES # Max incremental sync messages (default 500)
SYNC_CRON                     # Cron pattern (default "0 21 * * *", 9 PM UTC)
SYNC_CRON_TIMEZONE            # Cron timezone (e.g., "America/New_York")
SYNC_PROCESSING_CONCURRENCY   # Concurrent job processing (default 1)
SYNC_INTER_MESSAGE_DELAY_MS   # Delay between API calls (default 250 ms)

# Gemini Configuration
GEMINI_MODEL                  # Model name (default "gemini-2.5-flash-lite")
GEMINI_COOLDOWN_HOURS        # Hours to block after quota error (default 6)

# Multi-LLM Provider Configuration
ANTHROPIC_API_KEY             # Claude API key (optional)
OPENAI_API_KEY                # OpenAI API key (optional)
LLM_ENABLE_MULTI_PROVIDER     # Enable multi-provider routing (default "true")
LLM_PRO_PROVIDER              # Pro tier LLM (default "gemini-2.5-flash-lite")
LLM_ELITE_PROVIDER            # Elite tier LLM (default "claude-3-5-sonnet")
LLM_FALLBACK_PROVIDER         # Fallback LLM (default "gemini-2.5-flash-lite")

# MFA Configuration
SMTP_FROM_EMAIL               # OTP/verification email sender (default "noreply@jobsearchhub.local")
SMTP_FROM_NAME                # Sender display name (default "Job Search Hub")
SMTP_PORT                     # SMTP port (default 587)
SMTP_SECURE                   # Use TLS (default "true")
OTP_SEND_MODE                 # "email" (prod) or "console" (dev)

# Rate Limiting
RATE_LIMIT_SYNC_FREE          # Free tier sync limit (default 3/hour)
RATE_LIMIT_SYNC_PRO           # Pro tier sync limit (default 12/hour)
RATE_LIMIT_SYNC_ELITE         # Elite tier sync limit (default 30/hour)
RATE_LIMIT_SYNC_ADMIN         # Admin tier sync limit (default 60/hour)

# Stripe Billing
STRIPE_SECRET_KEY             # Stripe secret API key
STRIPE_WEBHOOK_SECRET         # Webhook signing secret
STRIPE_PRICE_PRO              # Pro subscription price ID
STRIPE_PRICE_ELITE            # Elite subscription price ID

# Admin Configuration
ADMIN_IP_ALLOWLIST            # Comma-separated allowed IPs (empty = all)

# Audit & Notifications
AUDIT_LOG_ENABLED             # Enable audit logging (default "true")
AUDIT_LOG_RETENTION_DAYS      # Days to retain audit logs (default 90)
MCP_AUTH_TOKEN                # MCP server auth token
MCP_AUDIT_LOG_ENABLED         # Log MCP calls (default "true")
NOTIFY_EMAIL_WEBHOOK_URL      # Email notification webhook (optional)
NOTIFY_SLACK_WEBHOOK_URL      # Slack notification webhook (optional)

# Feature Flags
ALLOW_FREE_TIER_GMAIL_SYNC    # Allow free tier Gmail sync (default true in dev, false in prod)
```

---

## 9. Known Issues, Warnings & Recommendations

### 9.1 Current Issues

#### Issue #1: In-Memory Rate Limiting Not Production-Safe
- **Severity:** High
- **Location:** `server/src/middleware/rateLimitAuth.js`
- **Problem:** Uses in-memory Map, lost on process restart; doesn't scale across instances
- **Fix:** Replace with Redis-based rate limiting in production
- **Workaround:** Use external ingress provider rate limit (AWS WAF, Cloudflare)

#### Issue #2: No CORS Validation for MCP Routes
- **Severity:** Medium
- **Location:** `server/src/routes/mcpRoutes.js`
- **Problem:** MCP endpoints use token auth but CORS not restricted
- **Recommendation:** Add IP allowlist for MCP consumers

#### Issue #3: Email Extraction OTP Sent to Console in Dev
- **Severity:** Low
- **Location:** `server/src/routes/emailExtractionRoutes.js`
- **Problem:** OTP printed to console in development mode (`OTP_SEND_MODE=console`)
- **Status:** Expected for dev; ensure `OTP_SEND_MODE=email` in production

#### Issue #4: Resume Upload Files Not Encrypted
- **Severity:** Medium
- **Location:** `server/src/routes/resumeRoutes.js`
- **Problem:** Resume files stored on disk in plaintext
- **Recommendation:** Encrypt files at rest using AES-256, store encryption key in vault

#### Issue #5: No Rate Limit on Job Creation
- **Severity:** Low
- **Location:** `server/src/routes/jobRoutes.js`
- **Problem:** No limit on how many jobs a user can create
- **Recommendation:** Add tier-based limits (e.g., free: 10, pro: unlimited)

### 9.2 Security Recommendations

#### Recommendation #1: Enable CSRF Protection
- Add CSRF token validation to all state-changing POST/PATCH/DELETE requests
- Use `csrf` middleware (npm package)
- Store tokens in double-submit cookies

#### Recommendation #2: Implement API Rate Limiting via Reverse Proxy
- Use Nginx `limit_req` or AWS API Gateway throttling
- Per-user limits + per-IP limits for anonymous endpoints
- Protects against both brute force and DDoS

#### Recommendation #3: Add Request Signing for Outbound Webhooks
- Sign all outbound notifications (Slack, email webhooks) with HMAC-SHA256
- Allows consumers to verify legitimacy of notifications

#### Recommendation #4: Implement Sub-Resource Integrity (SRI) for External CDN
- If using CDN for any assets, add SRI attributes to script/link tags
- Prevents tampering with external resources

#### Recommendation #5: Add Response Headers Security
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'self'`
- `Strict-Transport-Security: max-age=31536000`

---

### 9.3 Performance Recommendations

#### Recommendation #1: Cache Job Queries
- Add Redis caching for user's job list
- 5-min TTL; invalidate on job create/update
- Reduces database load during sync

#### Recommendation #2: Batch Gmail API Calls
- Current: Sequential fetch + extract for each message
- Better: Fetch batch of message IDs, then fetch details in parallel
- Reduces API calls by ~30%

#### Recommendation #3: Implement Job Deduplication by Hash
- Hash job (company + title + date) before insert
- Prevents duplicate jobs from same email synced multiple times
- Currently only prevents duplicate by email message ID

#### Recommendation #4: Archive Old Emails
- Move `job_emails` older than 1 year to separate table
- Keeps active queries fast

---

### 9.4 Data Quality Recommendations

#### Recommendation #1: Validate Email Extraction Results
- Add user confirmation step for AI-extracted jobs
- Mark AI-confidence score on each job
- Allow user to correct/reject bad extractions

#### Recommendation #2: Add Job Deduplication UI
- When syncing, detect potential duplicates (similar company + title)
- Ask user to merge

#### Recommendation #3: Implement Status Progression Validation
- Prevent invalid status transitions (e.g., Rejected -> Interview)
- Store state machine rules in config

---

### 9.5 Operational Recommendations

#### Recommendation #1: Implement Health Check Metrics
- `/health/ready` should include:
  - DB connection pool status
  - Gmail API quota remaining (if cached)
  - Gemini API key validity
  - Redis connection status
  - Stripe connectivity

#### Recommendation #2: Add Telemetry
- Track sync success/failure rates
- Monitor AI API latency + quota usage
- Dashboard for ops team

#### Recommendation #3: Implement Graceful Shutdown
- On SIGTERM: Stop accepting new requests, drain active ones, cleanup resources
- Prevents in-flight sync interruptions

#### Recommendation #4: Add Structured Logging for Sync Events
- Log each Gmail message processed: subject, extracted job, extraction confidence
- Build audit trail for debugging bad extractions

---

## 10. Technology Stack Summary

### Backend Runtime & Framework
- **Node.js** (runtime)
- **Express.js** (HTTP framework)
- **Winston** or custom logger (structured logging)

### Database & Storage
- **Supabase (PostgreSQL)** - Primary database
- **Local JSON file** (fallback for dev mode)
- **Disk (local/mounted volume)** - Resume files (should be encrypted)

### Authentication & Security
- **jsonwebtoken** - JWT creation/verification
- **bcryptjs** - Password hashing (cost 12)
- **speakeasy** - TOTP generation/verification
- **qrcode** - QR code generation for MFA
- **crypto** (Node stdlib) - Token hashing, HMAC, encryption
- **node-rsa** or native `crypto` - RSA key operations (if used)

### External APIs
- **googleapis** - Gmail API client
- **@google/generative-ai** - Gemini API
- **@anthropic-ai/sdk** - Claude API (optional)
- **openai** - GPT API (optional)
- **stripe** - Billing/payments
- **nodemailer** - SMTP email

### Validation & Utilities
- **zod** - Input schema validation
- **node-cron** - Scheduled sync jobs
- **multer** - File upload handling
- **@supabase/supabase-js** - Database client

### Development & Testing
- **vitest** - Unit testing framework
- **jest** or similar - Integration testing

---

## 11. Summary: Integration Checklist

| Component | Status | Configured | Notes |
|-----------|--------|-----------|--------|
| **Gmail OAuth** | Implemented | Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET | PKCE enabled |
| **Gemini AI** | Implemented | Requires GEMINI_API_KEY | Cooldown on quota errors |
| **Claude AI** | Optional | Requires ANTHROPIC_API_KEY (elite only) | Falls back to Gemini |
| **Stripe Billing** | Implemented | Requires STRIPE_SECRET_KEY + webhook secret | Webhook at `/billing/webhook` |
| **SMTP Email** | Implemented | Requires SMTP_HOST + credentials | Local dev uses `OTP_SEND_MODE=console` |
| **Supabase DB** | Implemented | Requires SUPABASE_URL + service role key | Falls back to local JSON in dev |
| **MFA/TOTP** | Implemented | Uses speakeasy, enabled per-user | Required for admins |
| **Audit Logging** | Implemented | Append-only, retention `AUDIT_LOG_RETENTION_DAYS` | All sensitive actions tracked |
| **Rate Limiting** | Implemented (partial) | In-memory; should use Redis in prod | Auth + sync + email verification |
| **Session Management** | Implemented | Refresh token rotation + device tracking | Per-user sync lock |

---

## 12. Deployment Checklist

- [ ] All required env vars set (validate with `validateEnv()`)
- [ ] SSL/TLS certificates in place (production)
- [ ] Database migrations applied (docs/database/*.sql)
- [ ] CORS origins configured (`CORS_ALLOWED_ORIGINS`)
- [ ] Admin IP allowlist set (`ADMIN_IP_ALLOWLIST`)
- [ ] Rate limiting moved to Redis or reverse proxy
- [ ] Resume file storage mounted as volume + encrypted
- [ ] Email/SMTP fully configured + tested
- [ ] Stripe webhook secret validated + IP allowed
- [ ] Gmail OAuth redirect URI registered in Google Cloud Console
- [ ] Backups scheduled (Supabase automated, or custom)
- [ ] Monitoring + alerts configured
- [ ] Security headers enabled (HSTS, CSP, X-Frame-Options)
- [ ] CSRF protection enabled on forms
- [ ] Audit log retention job scheduled
- [ ] Load balancer configured (if multi-instance)

---

**End of Backend Audit Document**
