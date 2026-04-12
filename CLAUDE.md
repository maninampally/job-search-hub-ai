# Job Search Hub — Claude Code Project Brain

> Read this entire file before touching any code. This is the source of truth for architecture decisions, goals, and build order.

---

## 1. What this project is

**Job Search Hub** — a personal job search command center. Syncs Gmail, extracts job applications via AI (Gemini), tracks pipeline via kanban, manages contacts/resumes/outreach/reminders. Built as a monorepo: `client/` (React + Vite) and `server/` (Node.js + Express).

**Current state:** Core features exist but need security hardening, user tier system, UI polish, and advanced features. We are building this to production-quality standard.

---

## 2. Non-negotiable rules (always follow these)

- Never use `localStorage` for tokens. Access token lives in memory only. Refresh token in httpOnly cookie.
- Never remove or bypass auth middleware. Every protected route must pass `requireAuth()` + `requireTier()`.
- Never commit `.env` or `.env.docker`. Use `.env.example` as the template.
- All env vars must pass startup validation (fail fast if missing required vars).
- All user input must be validated with `zod` before touching business logic.
- All AI calls (Gemini) must go through `sanitizeEmailForAI()` before sending data.
- No `console.log` in production code — use the structured logger only.
- Every destructive action must be written to the audit log.
- Tests go in `server/tests/` and `client/src/__tests__/`. Write tests for anything you implement.
- No em dashes in any user-facing text or comments. Use regular dashes.

---

## 3. User tier hierarchy

Four tiers stored in `role` column on `app_users` table and embedded in JWT:

| Role | Value | Description |
|------|-------|-------------|
| Free | `"free"` | Default. 10 job max, no Gmail sync, no AI. |
| Pro | `"pro"` | $9/mo. Gmail sync, AI extraction, full kanban, analytics. |
| Elite | `"elite"` | $24/mo. Pro + AI cover letter, AI interview coach, multi-inbox. |
| Admin | `"admin"` | Internal only. Full user management, audit logs, system config. |

### JWT payload shape (always match this exactly)
```json
{
  "sub": "user_uuid",
  "role": "free|pro|elite|admin",
  "plan_expires": 1748822400,
  "email_verified": true,
  "mfa_passed": false,
  "iat": 1746230400,
  "exp": 1746316800
}
```

### Middleware to use on routes
```js
requireAuth()               // verifies JWT, attaches req.user
requireEmailVerified()      // checks email_verified: true
requireTier('pro')          // checks role + plan_expires
requireTier('elite')
requireAdmin()              // role === 'admin' + mfa_passed: true
```

When a user hits a tier-gated route without the right tier, return:
```json
{ "error": "upgrade_required", "min_tier": "pro", "feature": "gmail_sync" }
```
HTTP status: 402. The frontend will show an upgrade modal.

---

## 4. Authentication architecture

### Token strategy
- **Access token**: 15-min JWT. Issued in response body. Frontend stores in memory (JS variable). Never localStorage, never a cookie.
- **Refresh token**: 7-day opaque token. Sent as `httpOnly; Secure; SameSite=Strict` cookie. Stored **hashed** (bcrypt) in `user_sessions` table. Rotated on every use.

### Login flow (server/src/routes/authRoutes.js)
1. Rate limit: 5 attempts per 15 min per IP + per email
2. Verify password with bcrypt (cost 12), timing-safe
3. Check `email_verified = true` -- block if not
4. If MFA enrolled: issue short-lived pre-auth token (5 min), require TOTP
5. Issue access token (in body) + refresh token (httpOnly cookie)
6. Log session to `user_sessions` table with device fingerprint
7. Write to audit log

### Refresh token rotation (POST /auth/refresh)
- Read refresh token from httpOnly cookie
- Look up hashed version in `user_sessions`
- If found: delete old, issue new refresh token cookie + new access token
- If old token replayed after rotation: detected as theft -- delete ALL sessions for user, send security email

### OAuth (Google / Gmail)
- Use Pattern B (redirect-based) ONLY. Pattern A is deleted.
- Add PKCE: generate `code_verifier` + `code_challenge` on every OAuth init
- Store `state` in server session (not localStorage) for CSRF protection
- Enforce: Google account email MUST match app account email
- Request ONLY `gmail.readonly` scope -- never broader
- Store OAuth tokens encrypted (AES-256-GCM) per user in DB

### MFA (TOTP via speakeasy)
- Library: `speakeasy`
- Free: optional. Pro: encouraged. Elite: required after 30 days. Admin: required, always.
- Backup codes: 8 codes, generated at enrollment, stored hashed, shown once
- Admin re-auth MFA every 8 hours regardless of session activity

---

## 5. Database tables (Supabase / Postgres)

### Existing (do not break)
- `app_users` -- core user table
- `jobs` -- job applications
- `job_emails` -- emails linked to jobs
- `contacts` -- recruiter/network contacts
- `reminders` -- user reminders
- `outreach_log` -- outreach attempts
- `resumes` -- resume metadata

### New tables to add (migrations in docs/database/)
```sql
-- user_sessions: tracks refresh tokens + devices
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_plans: billing + tier info
CREATE TABLE user_plans (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_expires TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- mfa_config: TOTP secrets + backup codes
CREATE TABLE mfa_config (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT FALSE,
  backup_codes JSONB,
  enrolled_at TIMESTAMPTZ
);

-- audit_log: immutable record of all sensitive actions
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  admin_id UUID,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. API endpoint contract

### New endpoints to add

**Auth**
- `POST /auth/refresh` -- rotate refresh token, return new access token
- `POST /auth/logout` -- clear refresh cookie, delete session from DB
- `GET /auth/sessions` -- list active sessions for current user
- `DELETE /auth/sessions/:id` -- end a specific session
- `DELETE /auth/sessions` -- end all other sessions
- `POST /auth/mfa/setup` -- generate TOTP secret + QR code
- `POST /auth/mfa/verify` -- verify TOTP code to complete enrollment
- `POST /auth/mfa/disable` -- disable MFA (requires current TOTP)
- `POST /auth/mfa/challenge` -- verify TOTP during login pre-auth step

**Plans / billing**
- `GET /billing/plan` -- current plan + usage stats
- `POST /billing/checkout` -- create Stripe checkout session
- `POST /billing/webhook` -- Stripe webhook (subscription events)
- `GET /billing/portal` -- Stripe customer portal URL

**Admin** (all require `requireAdmin()`)
- `GET /admin/users` -- paginated user list with filters
- `PATCH /admin/users/:id/role` -- upgrade/downgrade tier
- `POST /admin/users/:id/suspend` -- suspend account
- `GET /admin/audit-log` -- paginated audit log
- `GET /admin/metrics` -- revenue, churn, AI usage stats

---

## 7. Frontend architecture rules

- Global state: use `zustand` stores (authStore, jobsStore, uiStore)
- Server state + caching: use `react-query` (TanStack Query)
- Forms: `react-hook-form` + `zod` resolver
- Drag-drop: `@hello-pangea/dnd` (React 18 compatible)
- Command palette: `cmdk`
- Token storage: access token in `authStore.accessToken` (memory). Never `localStorage`.
- Tier gating UI: when API returns `{ error: "upgrade_required" }`, show `<UpgradeModal />` component
- Silent refresh: axios interceptor catches 401, calls `/auth/refresh`, retries original request

### Component structure to follow
```
client/src/
  stores/
    authStore.js       -- user, accessToken, login(), logout()
    jobsStore.js       -- jobs list, filters, sync state
    uiStore.js         -- modals, notifications, command palette
  components/
    auth/
      MFASetupModal.jsx
      UpgradeModal.jsx
      SessionsPanel.jsx
    kanban/
      KanbanBoard.jsx  -- @hello-pangea/dnd board
      KanbanColumn.jsx
      JobCard.jsx
    layout/
      Sidebar.jsx
      TopBar.jsx
      CommandPalette.jsx  -- cmdk
    shared/
      EmptyState.jsx   -- reusable empty state with CTA
      TierBadge.jsx
      ActivityFeed.jsx
```

---

## 8. Build phases and current status

### Phase 1 -- Critical security fixes (do these first)
- [x] Delete OAuth Pattern A from authRoutes.js, keep only Pattern B
- [x] Add PKCE to OAuth Pattern B
- [x] Fix env var: standardize to SMTP_FROM_EMAIL everywhere, remove MAIL_FROM
- [x] Add startup env validator (server/src/config/validateEnv.js)
- [x] Remove unused `uuid` import from emailExtractionService.js
- [x] Add role + plan_expires + mfa_passed to JWT payload
- [x] Implement refresh token rotation (httpOnly cookie pattern)
- [x] Create new DB migration files for user_sessions, user_plans, mfa_config, audit_log
- [x] Add requireTier() middleware
- [x] Add requireAdmin() middleware with IP allowlist support

### Phase 2 -- Core UX (make it excellent)
- [x] Drag-and-drop Kanban (JobTrackerView.jsx with @hello-pangea/dnd)
- [x] Onboarding checklist widget on dashboard home (4 steps)
- [x] Design token system (client/src/styles/tokens.css)
- [x] Zustand stores replacing prop drilling
- [x] React Query for all server state
- [x] Activity feed on dashboard home
- [x] Empty states for all modules
- [x] Command palette (Cmd+K) with cmdk
- [x] Session management UI in Settings
- [x] MFA setup flow (3-step modal)
- [x] Analytics dashboard page (Recharts funnel + bar chart)
- [x] Mobile responsive layout (sidebar -> bottom tab bar)

### Phase 3 -- AI features + tier gating
- [x] AI cover letter generator (Elite only) -- Gemini prompt in server/src/services/coverLetterService.js
- [x] AI interview coach Q&A (Elite only) -- server/src/services/interviewCoachService.js
- [x] Smart follow-up nudges (Pro+) -- suggest follow-up if no status change in 7 days
- [x] AI usage quota tracking per user per day
- [x] Tier enforcement on all AI routes
- [x] Upgrade wall modal UI (client/src/components/auth/UpgradeModal.jsx)

### Phase 4 -- Admin panel + billing
- [x] Admin dashboard (/admin route, requireAdmin() guarded)
- [x] User management table with tier controls
- [x] Audit log viewer in admin panel
- [x] Stripe integration (checkout + webhook + portal)
- [x] Billing page for users
- [x] Notification system (in-app bell + email)

---

## 9. Key files to know

```
server/
  src/
    app.js                        -- express wiring
    config/env.js                 -- env vars (add validateEnv here)
    routes/authRoutes.js          -- auth endpoints (needs Phase 1 work)
    routes/jobRoutes.js           -- job CRUD + sync trigger
    services/jobExtractor.js      -- Gemini AI extraction
    services/emailExtractionService.js  -- has unused uuid import (fix it)
    integrations/gmailClient.js   -- Gmail API wrapper
    security/dlp.js               -- PII sanitization before AI
    store/supabaseStore.js        -- Supabase data access layer
    middleware/                   -- add requireTier(), requireAdmin() here

client/
  src/
    App.jsx                       -- router
    auth/AuthContext.jsx          -- replace with zustand authStore
    api/backend.js                -- API client (add axios interceptor for silent refresh)
    components/views/
      DashboardHomeView.jsx       -- add onboarding checklist + activity feed here
      JobTrackerView.jsx          -- add drag-drop kanban here
```

---

## 10. How to work with this project in Claude Code

**Start every session by saying:**
> "Read CLAUDE.md. I want to work on [specific task from Phase X]. The relevant files are [list them]. Do not modify files outside of those listed."

**Good task prompt examples:**
- "Read CLAUDE.md. Implement requireTier() middleware in server/src/middleware/tierMiddleware.js. Write a test in server/tests/tierMiddleware.test.js."
- "Read CLAUDE.md. Build the KanbanBoard.jsx component using @hello-pangea/dnd. Jobs come from the jobsStore. Status update calls PATCH /jobs/:id."
- "Read CLAUDE.md. Add the MFA setup modal to client/src/components/auth/MFASetupModal.jsx. It has 3 steps: show QR, enter 6-digit code, show backup codes."

**Never ask Claude Code to:**
- "Implement all of Phase 1" -- too broad, leads to half-done work
- "Refactor the whole auth system" -- scope creep, always scope to one file or one feature
- "Fix all the bugs" -- no. One bug at a time with reproduction steps.