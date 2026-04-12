# Job Search Hub

A personal job search command center that syncs your Gmail, extracts job applications using AI, and tracks your entire pipeline from Applied to Offer.

Built by **Manikanth Nampally** - Data Engineer, FAU MS 2026.

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Setup and Installation](#setup-and-installation)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Running the App](#running-the-app)
8. [Features](#features)
9. [API Endpoints](#api-endpoints)
10. [Architecture Flow](#architecture-flow)
11. [LLM Model Strategy](#llm-model-strategy)
12. [User Tiers](#user-tiers)
13. [Security](#security)

---

## How It Works

```
Gmail Inbox --> OAuth Sync --> AI Extraction --> Job Tracker --> Dashboard
```

1. You connect your Gmail account via Google OAuth
2. The app fetches job-related emails (confirmations, rejections, interviews, offers)
3. Gemini AI reads each email and extracts: company, role, status, recruiter info
4. Jobs are created or updated in your tracker automatically
5. You see everything on a dashboard with stats, charts, and a daily sync report

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| AI (Primary) | Google Gemini 2.0 Flash (free) |
| AI (Backup) | OpenAI gpt-4o-mini |
| Gmail | Google OAuth2 + Gmail API |
| Email | Resend SMTP |
| Auth | JWT (access token in memory) + httpOnly refresh cookie |
| Containerization | Docker + Docker Compose |

---

## Project Structure

```
job-search-hub/
|
|-- client/                     # React frontend (Vite)
|   |-- src/
|   |   |-- api/
|   |   |   |-- backend.js              # API client (axios, silent refresh, all REST calls)
|   |   |   |-- emailExtraction.js      # Gmail extraction verification API
|   |   |
|   |   |-- auth/
|   |   |   |-- AuthContext.jsx          # React auth context (login state, token refresh)
|   |   |
|   |   |-- components/
|   |   |   |-- admin/
|   |   |   |   |-- AdminDashboard.jsx   # Admin panel (users, audit log, metrics)
|   |   |   |
|   |   |   |-- auth/
|   |   |   |   |-- MFASetupModal.jsx    # TOTP MFA enrollment (3-step)
|   |   |   |   |-- SessionsPanel.jsx    # Active session management
|   |   |   |   |-- UpgradeModal.jsx     # Tier upgrade prompt
|   |   |   |
|   |   |   |-- kanban/
|   |   |   |   |-- JobDetailDrawer.jsx  # Job detail side panel + unified timeline
|   |   |   |
|   |   |   |-- layout/
|   |   |   |   |-- CommandPalette.jsx   # Cmd+K search palette
|   |   |   |   |-- MobileTabBar.jsx     # Mobile bottom navigation
|   |   |   |
|   |   |   |-- shared/
|   |   |   |   |-- ErrorBoundary.jsx    # React error boundary
|   |   |   |   |-- FormInput.jsx        # Reusable form field with validation
|   |   |   |   |-- SkeletonLoader.jsx   # Loading skeleton components
|   |   |   |   |-- TierBadge.jsx        # User tier display badge
|   |   |   |   |-- Toast.jsx            # Global toast notifications
|   |   |   |
|   |   |   |-- views/
|   |   |   |   |-- BillingPage.jsx      # Stripe billing + plan management
|   |   |   |   |-- ContactsView.jsx     # Recruiter/network contacts
|   |   |   |   |-- DashboardHomeView.jsx # Home: stats, charts, daily report
|   |   |   |   |-- InterviewPrepView.jsx # AI interview Q&A practice
|   |   |   |   |-- JobTrackerView.jsx   # Job list + email log + timeline tabs
|   |   |   |   |-- OutreachView.jsx     # Outreach tracking
|   |   |   |   |-- RemindersView.jsx    # Follow-up reminders
|   |   |   |   |-- SettingsPage.jsx     # Account, Gmail, extraction settings
|   |   |   |   |-- TemplatesView.jsx    # Outreach message templates
|   |   |   |
|   |   |   |-- EmailExtractionVerification.jsx  # Gmail extraction setup wizard
|   |   |   |-- EmailLogTab.jsx          # Email log for a job
|   |   |   |-- JobListView.jsx          # Expandable job list table
|   |   |   |-- ResumesManager.jsx       # Resume upload/management
|   |   |   |-- TimelineTab.jsx          # Job status timeline
|   |   |
|   |   |-- hooks/
|   |   |   |-- useJobActions.js         # Job CRUD hook
|   |   |   |-- useContactActions.js     # Contact CRUD hook
|   |   |   |-- useOutreachActions.js    # Outreach CRUD hook
|   |   |   |-- useReminderActions.js    # Reminder CRUD hook
|   |   |   |-- useTemplateActions.js    # Template actions hook
|   |   |   |-- useQueries.js           # React Query hooks (billing, admin)
|   |   |
|   |   |-- pages/
|   |   |   |-- Dashboard.jsx           # Main app shell (sidebar, routing, data loading)
|   |   |   |-- DashboardWrapper.jsx    # Auth gate for dashboard
|   |   |   |-- LandingPage.jsx         # Marketing landing page
|   |   |   |-- LoginPage.jsx           # Login + registration
|   |   |   |-- ProfilePage.jsx         # User profile + sessions + MFA
|   |   |   |-- ConfirmEmailPage.jsx    # Email verification
|   |   |   |-- VerifyEmailPage.jsx     # Email verify token handler
|   |   |   |-- PrivacyPage.jsx         # Privacy policy
|   |   |   |-- TermsPage.jsx           # Terms of service
|   |   |
|   |   |-- stores/
|   |   |   |-- authStore.js            # Zustand: access token + user state
|   |   |   |-- jobsStore.js            # Zustand: jobs list + filters
|   |   |   |-- uiStore.js             # Zustand: modals, sidebar, toasts
|   |   |
|   |   |-- styles/
|   |   |   |-- tokens.css             # Design tokens (colors, spacing, radii)
|   |   |   |-- app.css                # Global styles
|   |   |
|   |   |-- utils/
|   |   |   |-- validationSchemas.js    # Zod form validation schemas
|   |   |   |-- emailUtils.js          # Email display helpers
|   |   |   |-- fileValidation.js      # File upload validation
|   |   |
|   |   |-- App.jsx                    # Router + route guards
|   |   |-- main.jsx                   # React entry point
|
|-- server/                     # Node.js + Express backend
|   |-- src/
|   |   |-- config/
|   |   |   |-- env.js                  # Environment variable loader
|   |   |   |-- validateEnv.js          # Startup validation (fail fast)
|   |   |   |-- constants.js            # Job statuses, email type enums
|   |   |
|   |   |-- integrations/
|   |   |   |-- gmail.js                # Google OAuth client + Gmail API wrapper
|   |   |
|   |   |-- middleware/
|   |   |   |-- requireUserAuth.js      # JWT verification middleware
|   |   |   |-- requireTier.js          # Tier gating (free/pro/elite)
|   |   |   |-- requireAdmin.js         # Admin-only access
|   |   |   |-- rateLimitAuth.js        # Auth endpoint rate limiting
|   |   |   |-- validate.js             # Zod request validation middleware
|   |   |
|   |   |-- routes/
|   |   |   |-- authRoutes.js           # Login, register, OAuth, MFA, sessions
|   |   |   |-- jobRoutes.js            # Jobs CRUD, sync, timeline, daily report
|   |   |   |-- healthRoutes.js         # Health check endpoint
|   |   |   |-- aiRoutes.js             # Cover letter, interview coach, follow-ups
|   |   |   |-- adminRoutes.js          # User management, audit log, metrics
|   |   |   |-- billingRoutes.js        # Stripe checkout, webhook, portal
|   |   |   |-- contactRoutes.js        # Contacts CRUD
|   |   |   |-- reminderRoutes.js       # Reminders CRUD
|   |   |   |-- outreachRoutes.js       # Outreach log CRUD
|   |   |   |-- resumeRoutes.js         # Resume upload/management
|   |   |   |-- templateRoutes.js       # Outreach templates
|   |   |   |-- notificationRoutes.js   # In-app notifications
|   |   |   |-- emailExtractionRoutes.js # Gmail extraction setup
|   |   |   |-- mcpRoutes.js            # MCP integration endpoints
|   |   |
|   |   |-- services/
|   |   |   |-- jobExtractor.js         # AI email extraction (Gemini/OpenAI/Anthropic)
|   |   |   |-- jobSync.js             # Gmail sync pipeline + job matching
|   |   |   |-- llmSelector.js          # LLM provider configuration + validation
|   |   |   |-- dbAdapter.js            # Supabase query helper
|   |   |   |-- syncState.js            # Sync lock management
|   |   |   |-- emailExtractionService.js # Extraction orchestration
|   |   |   |-- coverLetterService.js   # AI cover letter generation
|   |   |   |-- interviewCoachService.js # AI interview Q&A
|   |   |   |-- followUpService.js      # Smart follow-up suggestions
|   |   |   |-- mfaService.js           # TOTP MFA (speakeasy)
|   |   |   |-- auditService.js         # Audit log writes
|   |   |   |-- notificationService.js  # Notification management
|   |   |
|   |   |-- security/
|   |   |   |-- dlp.js                  # PII sanitization before AI calls
|   |   |   |-- rateLimiter.js          # Sync rate limits per tier
|   |   |   |-- auditLogger.js          # Sync audit logging
|   |   |
|   |   |-- store/
|   |   |   |-- dataStore.js            # Supabase data access layer (jobs, emails, etc.)
|   |   |   |-- userStore.js            # User + session data access
|   |   |   |-- aiUsageStore.js         # AI quota tracking per user
|   |   |
|   |   |-- utils/
|   |   |   |-- logger.js              # Structured logging
|   |   |   |-- encryption.js          # AES-256-GCM token encryption
|   |   |   |-- sessionToken.js        # JWT + refresh cookie helpers
|   |   |   |-- password.js            # bcrypt password hashing
|   |   |   |-- emailSender.js         # SMTP email sending
|   |   |   |-- asyncTools.js          # retry() and withTimeout() utilities
|   |   |   |-- sanitize.js            # HTML/text sanitization
|   |   |   |-- requestUtils.js        # IP/User-Agent extraction
|   |   |   |-- emailExtractionUtils.js # Extraction helper functions
|   |   |
|   |   |-- schemas/
|   |   |   |-- jobSyncSchemas.js       # Zod schema for sync API validation
|   |   |
|   |   |-- scheduler/
|   |   |   |-- syncScheduler.js        # Cron-based automatic sync
|   |   |
|   |   |-- scripts/
|   |   |   |-- runMigrations.js        # Database migration runner
|   |   |   |-- resetAndResync.js       # Dev tool: reset data + re-sync
|   |   |
|   |   |-- app.js                     # Express app setup + route mounting
|   |
|   |-- index.js                       # Server entry point
|   |-- integration-tests.js           # Manual HTTP integration tests
|
|-- docs/
|   |-- database/                      # SQL migration files (001-014)
|   |   |-- schema.sql                 # Base schema
|   |-- template-data/                 # Outreach message templates (35 files)
|   |-- DEPLOYMENT.md                  # Local dev setup guide
|   |-- ARCHITECTURE.md               # System architecture docs
|   |-- pricing-and-infra-cost-estimate.md
|
|-- docker-compose.yml                 # Dev Docker setup
|-- docker-compose.prod.yml            # Production Docker setup
|-- Dockerfile.backend                 # Backend container
|-- Dockerfile.frontend                # Frontend container (multi-stage build)
|-- .env.example                       # Environment variable template
|-- .github/workflows/ci.yml           # GitHub Actions CI
```

---

## Setup and Installation

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for containerized setup)
- A Supabase project (free tier works)
- A Google Cloud project with Gmail API enabled
- A Gemini API key (free from Google AI Studio)

### Step 1: Clone and configure

```bash
git clone https://github.com/maninampally/job-search-hub-ai.git
cd job-search-hub-ai
cp .env.example .env.docker
```

Edit `.env.docker` with your actual keys (see [Environment Variables](#environment-variables)).

### Step 2: Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project, enable the Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Set authorized redirect URI to `http://localhost:3001/auth/callback`
5. Copy Client ID and Client Secret to your `.env.docker`

### Step 3: Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor, run `docs/database/schema.sql`
3. Run each migration file in `docs/database/` in order (002 through 014)
4. Copy your project URL and service role key to `.env.docker`

### Step 4: Get a Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key (free)
3. Add it to `.env.docker` as `GEMINI_API_KEY`

---

## Environment Variables

Create `.env.docker` from `.env.example`. Required variables:

| Variable | Description |
|----------|------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `REDIRECT_URI` | OAuth callback URL (`http://localhost:3001/auth/callback`) |
| `GEMINI_API_KEY` | Google Gemini API key (free) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `AUTH_TOKEN_SECRET` | Random 64-char hex string for JWT signing |
| `TOKEN_ENCRYPTION_KEY` | Random 64-char hex string for AES encryption |
| `SESSION_SECRET` | Random string for Express sessions |

Optional but recommended:

| Variable | Default | Description |
|----------|---------|------------|
| `GEMINI_MODEL` | `gemini-2.0-flash` | Which Gemini model to use |
| `OPENAI_API_KEY` | - | Backup LLM (used only when Gemini is down) |
| `SMTP_HOST` | - | SMTP server for email verification |
| `SYNC_CRON` | `0 21 * * *` | Auto-sync schedule (default: 9 PM daily) |
| `INITIAL_SYNC_LOOKBACK_DAYS` | `30` | How far back to search on first sync |
| `SYNC_PROCESSING_CONCURRENCY` | `6` | Parallel email processing |

---

## Database Setup

The database uses Supabase (PostgreSQL). Core tables:

| Table | Purpose |
|-------|---------|
| `app_users` | User accounts (email, password, role, profile) |
| `jobs` | Job applications (company, role, status, dates) |
| `job_emails` | Emails linked to jobs |
| `job_status_timeline` | Status change history per job |
| `oauth_tokens` | Gmail OAuth tokens (encrypted, per user) |
| `processed_emails` | Tracks which Gmail messages have been processed |
| `contacts` | Recruiter and network contacts |
| `reminders` | Follow-up reminders |
| `outreach_log` | Outreach attempts |
| `resumes` | Resume metadata |
| `user_sessions` | Refresh tokens + device tracking |
| `user_plans` | Billing and subscription info |
| `mfa_config` | TOTP MFA secrets + backup codes |
| `audit_log` | Immutable record of sensitive actions |
| `ai_usage` | AI call quotas per user per day |
| `notifications` | In-app notification queue |

Run migrations in order:

```bash
npm run db:migrate
```

Or manually run each SQL file in `docs/database/` via the Supabase SQL Editor.

---

## Running the App

### With Docker (recommended)

```bash
docker compose up --build -d
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

To stop:

```bash
docker compose down
```

### Without Docker (local dev)

Terminal 1 - Backend:

```bash
npm install
cp .env.example .env    # fill in your keys
npm run dev:server
```

Terminal 2 - Frontend:

```bash
cd client
npm install
npm run dev
```

---

## Features

### Gmail Sync
- Connect Gmail via Google OAuth
- Auto-sync every day at 9 PM (configurable)
- Manual sync with preset windows: 1D, 3D, 1W, 1M, 3M, 6M
- AI extracts company, role, status, recruiter, and dates from each email
- Smart job matching - follow-up emails update existing jobs instead of creating duplicates

### Job Tracker
- Full job list with expandable detail rows
- Email log tab showing all emails linked to a job
- Timeline tab showing status changes with dates
- CSV export of all job data

### Daily Sync Report
- Shows on dashboard home page
- Configurable time window (12h, 24h, 48h, 3 days, 7 days)
- Displays: emails processed, jobs created, status changes
- Breakdown by email type (Application, Interview, Rejection, etc.)
- Expandable list of all recent emails

### AI Features (Pro/Elite tiers)
- Cover letter generator - AI writes cover letters based on job + resume
- Interview coach - practice Q&A with AI feedback
- Smart follow-up nudges - suggests follow-ups for stale applications

### Outreach Templates
- 35 pre-built templates across 4 use cases
- Email, LinkedIn (300 chars + full), WhatsApp formats
- Templates for: initial outreach, post-application, cold outreach, follow-ups

### Contact Manager
- Track recruiters and network contacts
- Link contacts to companies
- Log outreach attempts

### Reminders
- Set follow-up reminders for any job
- Overdue alerts on dashboard

### Admin Panel
- User management with tier controls
- Audit log viewer
- Revenue and usage metrics

### Billing
- Stripe integration for paid tiers
- Checkout, customer portal, webhook handling

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login (returns JWT) |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | End session |
| GET | `/auth/status` | Auth state + Gmail connection |
| GET | `/auth/callback` | Google OAuth callback |
| GET | `/auth/sessions` | List active sessions |
| DELETE | `/auth/sessions/:id` | End a session |
| POST | `/auth/mfa/setup` | Start MFA enrollment |
| POST | `/auth/mfa/verify` | Complete MFA enrollment |

### Jobs
| Method | Path | Description |
|--------|------|------------|
| GET | `/jobs` | List all jobs |
| POST | `/jobs` | Create a job |
| PATCH | `/jobs/:id` | Update a job |
| DELETE | `/jobs/:id` | Delete a job |
| POST | `/jobs/sync` | Trigger Gmail sync |
| GET | `/jobs/timeline/:id` | Unified timeline (status + emails) |
| GET | `/jobs/daily-report` | Daily sync activity report |
| GET | `/jobs/analytics/weekly` | Weekly analytics |
| GET | `/jobs/export/csv` | Export jobs as CSV |

### AI (tier-gated)
| Method | Path | Tier | Description |
|--------|------|------|------------|
| POST | `/ai/cover-letter` | Elite | Generate cover letter |
| POST | `/ai/interview-coach` | Elite | Interview Q&A |
| GET | `/ai/follow-up-nudges` | Pro | Smart follow-up suggestions |

### Admin
| Method | Path | Description |
|--------|------|------------|
| GET | `/admin/users` | Paginated user list |
| PATCH | `/admin/users/:id/role` | Change user tier |
| GET | `/admin/audit-log` | View audit log |
| GET | `/admin/metrics` | System metrics |

### Health
| Method | Path | Description |
|--------|------|------------|
| GET | `/health` | Backend health check |

---

## Architecture Flow

### Gmail Sync Pipeline

```
User clicks "Run Sync"
       |
       v
POST /jobs/sync { lookbackDays: 30 }
       |
       v
jobRoutes.js validates request (Zod schema)
       |
       v
jobSync.js fetchJobEmails()
       |
       |--> Builds Gmail query (newer_than:Xd, job-related keywords)
       |--> Fetches messages via Gmail API (paginated)
       |--> For each email:
       |       |
       |       v
       |    processEmail()
       |       |
       |       |--> Check if already processed (processed_emails table)
       |       |--> Send to jobExtractor.js extractJobInfo()
       |       |       |
       |       |       |--> Gemini 2.0 Flash (primary, free)
       |       |       |--> OpenAI gpt-4o-mini (backup)
       |       |       |--> Rule-based fallback (if all LLMs down)
       |       |       |
       |       |       v
       |       |    Returns: { company, role, status, isJobRelated, ... }
       |       |
       |       |--> If not job-related: skip
       |       |--> If job-related: findMatchingJob()
       |       |       |
       |       |       |--> Tier 1: exact company + role match
       |       |       |--> Tier 2: fuzzy company + role match
       |       |       |--> Tier 3: company-only match (if unique)
       |       |       |--> Tier 4: sender domain match
       |       |       |
       |       |       v
       |       |    Match found? --> Update existing job status
       |       |    No match?   --> Create new job
       |       |
       |       |--> Record in processed_emails
       |       |--> Link email to job (job_emails table)
       |       |--> Write status change (job_status_timeline)
       |
       v
Return sync stats { processed, created, updated, skipped }
```

### Auth Flow

```
Register --> Verify Email --> Login --> JWT (15 min)
                                         |
                                         |--> Access token: in memory (JS variable)
                                         |--> Refresh token: httpOnly cookie (7 days)
                                         |
                                   Token expires?
                                         |
                                         v
                              POST /auth/refresh
                                         |
                                         |--> Old refresh token deleted
                                         |--> New refresh token + new access token
                                         |--> (Token rotation for security)
```

### Frontend Data Flow

```
App.jsx (router)
  |
  |--> AuthContext.jsx (auth state, token refresh)
  |
  |--> DashboardWrapper.jsx (auth gate)
        |
        |--> Dashboard.jsx (data loading, sidebar, routing)
              |
              |--> DashboardHomeView (stats, charts, daily report)
              |--> JobTrackerView (job list, email log, timeline)
              |--> ContactsView, RemindersView, OutreachView...
              |--> SettingsPage (Gmail, extraction, account)
```

---

## LLM Model Strategy

The app uses a cost-optimized model cascade:

| Priority | Model | Cost | When Used |
|----------|-------|------|-----------|
| 1st | Gemini 2.0 Flash | Free | Every sync (all windows) |
| 2nd | OpenAI gpt-4o-mini | ~$0.15/1M tokens | Only if Gemini hits rate limits |
| 3rd | Anthropic Sonnet | $3/1M tokens | Disabled by default, opt-in via env |
| Fallback | Rule-based regex | Free | If all LLMs are down |

Gemini 2.0 Flash is the primary model because:
- Free tier: 1500 requests/day
- Fast: sub-second responses
- Native JSON mode: forces valid JSON output
- Accurate enough for structured email extraction

To enable Anthropic as a last resort (costs money):

```
USE_SONNET_FOR_INITIAL_SYNC=true
ANTHROPIC_API_KEY=your-key
ANTHROPIC_MODEL=claude-sonnet-4-6
```

---

## User Tiers

| Tier | Price | Features |
|------|-------|---------|
| Free | $0 | 10 job limit, no Gmail sync, no AI |
| Pro | $9/mo | Gmail sync, AI extraction, full tracker, analytics |
| Elite | $24/mo | Pro + AI cover letter, interview coach, multi-inbox |
| Admin | Internal | Full user management, audit logs, system config |

Tier is stored in `app_users.role` and embedded in the JWT. Routes are gated with `requireTier('pro')` middleware. When a free user hits a gated route, the API returns HTTP 402 with `{ error: "upgrade_required" }` and the frontend shows an upgrade modal.

---

## Security

- **Tokens**: Access token in memory only (never localStorage). Refresh token in httpOnly cookie with rotation.
- **PII**: All email content is sanitized (credit cards, SSN, phone numbers removed) before being sent to AI.
- **OAuth**: PKCE enabled, state verification, email must match app account.
- **MFA**: TOTP via speakeasy with backup codes.
- **Rate Limiting**: Per-tier sync limits, auth rate limiting (5 attempts/15 min).
- **Audit Log**: All sensitive actions (login, role changes, data deletion) are logged.
- **Encryption**: OAuth tokens stored encrypted (AES-256-GCM) in the database.

---

## Documentation

- `docs/DEPLOYMENT.md` - Local development setup with step-by-step OAuth config
- `docs/ARCHITECTURE.md` - System architecture and design decisions
- `docs/pricing-and-infra-cost-estimate.md` - Infrastructure cost estimates
- `PROJECT_DOCUMENTATION.md` - Complete technical documentation
- `BACKEND_AUDIT.md` - Backend security and code audit
