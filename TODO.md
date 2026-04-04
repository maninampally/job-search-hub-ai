# TODO — Job Search Hub

## ✅ IMPLEMENTATION COMPLETE — All 7 Phases Finished!

### ✅ Database Migrations Applied to Supabase
- [x] Migration 008: Email verification fields added to app_users
- [x] Migration 009: Per-user OAuth tokens table created
- [x] Both queries executed successfully in Supabase SQL Editor
**⚠️ Read this carefully:** You need to run SQL queries in Supabase, not bash commands.

#### Step 1: Migration 008 (Email Verification Fields)

**In your local terminal (NOT Supabase SQL Editor):**
```bash
cd c:\Users\bhoop\Downloads\job-search-hub\job-search-hub
```

**Open [docs/database/008_user_email_verification.sql](docs/database/008_user_email_verification.sql) and copy the SQL content:**

```sql
-- Migration 008: Add Email Verification Fields to app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMP;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verification_attempts INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_app_users_email_verification_token_hash 
  ON app_users(email_verification_token_hash) 
  WHERE email_verification_token_hash IS NOT NULL;

COMMENT ON COLUMN app_users.email_verified_at IS 'Timestamp when user verified their email address via link';
COMMENT ON COLUMN app_users.email_verification_token_hash IS 'SHA256 hash of verification token (one-time use)';
COMMENT ON COLUMN app_users.email_verification_sent_at IS 'Timestamp when verification email was sent (for expiry check)';
COMMENT ON COLUMN app_users.email_verification_attempts IS 'Count of verification email requests (for rate limiting)';
```

**Then in Supabase Dashboard:**
1. Go to **SQL Editor** > **Create New Query**
2. Paste the SQL above
3. Click **Run** ✓

---

#### Step 2: Migration 009 (Per-User OAuth Tokens)

**Open [docs/database/009_oauth_tokens_per_user.sql](docs/database/009_oauth_tokens_per_user.sql) and copy the SQL content:**

```sql
-- Migration 009: Redesign oauth_tokens for Per-User Token Storage
-- This fixes the multi-user token collision bug!

DROP TABLE IF EXISTS oauth_tokens CASCADE;

CREATE TABLE oauth_tokens (
  id TEXT PRIMARY KEY,  
  owner_user_id UUID UNIQUE NOT NULL,  
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  verified_email_address TEXT NOT NULL,
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_oauth_tokens_owner_user_id 
    FOREIGN KEY (owner_user_id) 
    REFERENCES app_users(id) 
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_owner_user_id 
  ON oauth_tokens(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_verified_email_address 
  ON oauth_tokens(verified_email_address);

COMMENT ON TABLE oauth_tokens IS 'OAuth tokens per user - one row per user with cascade delete on user removal';
COMMENT ON COLUMN oauth_tokens.id IS 'Primary key: oauth_{user_id}';
COMMENT ON COLUMN oauth_tokens.owner_user_id IS 'User who owns this token (UNIQUE - one per user)';
COMMENT ON COLUMN oauth_tokens.access_token IS 'Current OAuth access token from Google';
COMMENT ON COLUMN oauth_tokens.refresh_token IS 'Refresh token for obtaining new access tokens';
COMMENT ON COLUMN oauth_tokens.expires_at IS 'Access token expiry timestamp';
COMMENT ON COLUMN oauth_tokens.verified_email_address IS 'Gmail email verified to match app account email during OAuth';
COMMENT ON COLUMN oauth_tokens.verified_at IS 'When this token was verified as matching the app email';
```

**Then in Supabase Dashboard:**
1. Go to **SQL Editor** > **Create New Query**
2. Paste the SQL above
3. Click **Run** ✓

---

#### Verify Migrations Applied
After both queries run successfully, verify in Supabase SQL Editor:
```sql
-- Check app_users has new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'app_users' 
AND column_name IN ('email_verified_at', 'email_verification_token_hash');

-- Should return 2 rows ✓

-- Check oauth_tokens table exists with new structure
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'oauth_tokens';

-- Should show: id, owner_user_id, access_token, refresh_token, expires_at, verified_email_address, etc.
```

### How to Run Locally

#### 1. Install Dependencies
```bash
cd job-search-hub
npm install
cd client && npm install && cd ..
```

#### 2. Start Backend & Frontend (Development)
```bash
# Terminal 1: Start backend
npm run dev:server

# Terminal 2: Start frontend
npm run dev:client

# Frontend will be at: http://localhost:5173
# Backend will be at: http://localhost:3001
```

#### 3. Start with Docker (Production)
```bash
# Build and start all services
docker compose down          # Stop existing containers
docker compose up -d --build # Build fresh and start

# Check logs
docker compose logs -f backend
docker compose logs -f frontend

# Access at: http://localhost:5173
```

#### 4. Environment Variables Setup
Required in `.env`:
```
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
REDIRECT_URI=http://localhost:3001/auth/callback
ANTHROPIC_API_KEY=<your-anthropic-api-key>
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-key>

# Email verification (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your-email@gmail.com>
SMTP_PASS=<your-app-password>
MAIL_FROM=noreply@job-search-hub.com

# Session security
SESSION_SECRET=dev-session-secret-change-in-production
```

### Feature Walkthrough: Email Verification & Per-User Extraction

#### User Flow:
1. **Register** → Account created (not verified)
2. **Login** → Redirected to dashboard
3. **Verify Email** → Button shows "Verify Email First" (red)
   - Click → Verify Email Page
   - Send verification email (rate-limited 3/hour)
   - Click link in email → Verification confirmed
4. **Connect Gmail** → Button now enabled (blue)
   - Must match app email with Gmail account email
   - Enforced at OAuth callback (403 if mismatch)
5. **Sync Jobs** → Extracts only from verified user's Gmail
   - Per-user tokens (User A's sync doesn't touch User B's data)
   - Per-user locks (User A & B can sync simultaneously)
6. **Scheduler** → Auto-sync all verified users daily at 9 AM
   - Loops through `getAllUsersWithActiveTokens()`
   - 2-second delay between users (API rate limiting)

#### API Endpoints (NEW):
```javascript
// Email Verification
POST /auth/verify-email/request  → Send verification email (auth required)
GET  /auth/verify-email/confirm?token=...  → Confirm token (public)

// Updated OAuth Flow
GET /auth/gmail    → Start OAuth (requires email_verified_at, blocks with 403)
GET /auth/callback → OAuth callback (enforces email match, stores per-user)

// Sync Endpoints (Now per-user)
POST /jobs/sync         → Manual sync (auth required, fails if not verified)
GET  /jobs/sync-status  → Check sync status (per-user if userId provided)
POST /jobs/backfill-emails → Backfill existing jobs (per-user)
```

#### Database Schema (NEW):
```sql
-- app_users table (NEW fields)
ALTER TABLE app_users ADD COLUMN email_verified_at TIMESTAMP;
ALTER TABLE app_users ADD COLUMN email_verification_token_hash TEXT;
ALTER TABLE app_users ADD COLUMN email_verification_sent_at TIMESTAMP;
ALTER TABLE app_users ADD COLUMN email_verification_attempts INT DEFAULT 0;
CREATE INDEX idx_app_users_email_verification_token_hash ON app_users(email_verification_token_hash);

-- oauth_tokens table (REDESIGNED)
-- OLD: Single row with id=1 (broken multi-user design)
-- NEW: Per-user rows with id=oauth_{user_id} + UNIQUE(owner_user_id)
CREATE TABLE oauth_tokens (
  id TEXT PRIMARY KEY,
  owner_user_id UUID UNIQUE NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  verified_email_address TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
CREATE INDEX idx_oauth_tokens_owner_user_id ON oauth_tokens(owner_user_id);
```

---

## Testing Scenarios

### Scenario 1: Single User Email Verification & Gmail Connect
```
1. Register as user@example.com
2. Click "Verify Email First" button
3. Request verification email (auto-sent if SMTP configured)
4. Click verification link in email
5. Redirected to dashboard, email verified ✓
6. Click "Connect Gmail" (now enabled)
7. OAuth flow: Gmail must match app email
8. After OAuth: Can manually sync or wait for daily scheduler
```

### Scenario 2: Multi-User Concurrent Sync (No Collision)
```
1. Register User A (userA@example.com), verify, connect Gmail
2. Register User B (userB@example.com), verify, connect Gmail
3. Start sync for User A manually (POST /jobs/sync with userA auth)
4. Immediately start sync for User B (POST /jobs/sync with userB auth)
5. Both should run in parallel (per-user locks prevent blocking)
6. User A's jobs have owner_user_id=userA
7. User B's jobs have owner_user_id=userB
8. No token overwrite, no data leakage ✓
```

### Scenario 3: Wrong Gmail Account (Email Mismatch)
```
1. User A registers as userA@example.com
2. Verifies email
3. Connects Gmail but uses a different Gmail account (userB@gmail.com)
4. OAuth callback: 403 error
5. Message: "Gmail email does not match your account email"
6. User must reconnect with matching Gmail userA@gmail.com
```

### Scenario 4: Rate Limiting on Verification Emails
```
1. Click "Send Verification Email" 3 times rapidly
2. 3rd click succeeds
3. 4th click → 429 Too Many Requests
4. Message: "Try again in 1 hour"
5. Rate limit resets after 1 hour ✓
```

---

## Completed Implementation Details

### Active Tasks

### Dashboard Redesign - Analytics Section
**Phase 1: Chart Positioning & Analytics Grid** ✅ COMPLETE
- [x] 1.1 Move Daily Applications chart higher in DashboardHomeView (after Overview Cards section)
- [x] 1.2 Create `.analytics-grid` CSS (2-column grid, 1-column on mobile <980px)
- [x] 1.3 Extract chart into separate analytics card component
- [x] 1.4 Reduce chart height from 250px to 200px (compact view)
- [x] 1.5 Adjust Recharts dot sizes (r: 3 instead of r: 4) for compact layout
- [x] 1.6 Update XAxis and YAxis tick font sizes to 11px

**Phase 2: Pipeline Health Metrics Card** ✅ COMPLETE
- [x] 2.1 Create Pipeline Health card (second column in analytics grid)
- [x] 2.2 Add metrics: Active Roles (with % of total), Needs Follow-up (with pressure %), Offers (with close rate %)
- [x] 2.3 Add `.pipeline-health-summary` and `.health-metric` CSS classes
- [x] 2.4 Color code metrics: Active (indigo), Follow-up (amber), Offers (green)
- [x] 2.5 Pass pipelineColumns, stats, needsFollowUpJobs as props

**Phase 3: Responsive Layout** ✅ COMPLETE
- [x] 3.1 Test analytics grid on desktop (1200px+) - side-by-side charts
- [x] 3.2 Test analytics grid on tablet (980px) - stack vertically
- [x] 3.3 Test analytics grid on mobile (640px) - single column, full width
- [x] 3.4 Verify chart tooltip displays correctly at 200px height
- [x] 3.5 Test custom date range picker wrapping behavior on mobile

**Phase 4: Build & Deployment** ✅ COMPLETE
- [x] 4.1 Frontend build: cd client && npm run build
- [x] 4.2 Verify no errors or warnings
- [x] 4.3 Docker rebuild: docker compose down && docker compose up -d --build
- [x] 4.4 Verify both services healthy (backend 3001, frontend 5173)
- [x] 4.5 Test on http://localhost:5173

**Phase 5: QA & Testing** IN PROGRESS
- [ ] 5.1 Verify all date range options work (7, 14, 30, 90 days, custom)
- [ ] 5.2 Verify Pipeline Health metrics display correctly
- [ ] 5.3 Test with 0 applications (empty state displays)
- [ ] 5.4 Test with high application volume (scaling works)
- [ ] 5.5 Check for console errors/warnings in browser DevTools
- [ ] 5.6 Verify no regressions in other dashboard sections

### Backend Enhancements
- [ ] Custom date range support fully tested (startDate/endDate params)
- [ ] Backend can handle date ranges from 1 day to 90+ days
- [ ] Error handling for invalid dates

### Documentation
- [ ] Update README.md with new analytics features
- [ ] Document custom date range usage
- [ ] Add screenshots of new dashboard layout

### Performance & Optimization
- [ ] Evaluate chart rendering performance with large date ranges
- [ ] Consider memoization of chart data transformations if needed
- [ ] Optimize Recharts chart size for mobile (~200px height)

### Future Features
- [ ] Add Response Rate trend chart (parallel to Daily Applications)
- [ ] Add Interview conversion funnel visualization
- [ ] Add time-to-response analytics
- [ ] Export analytics data to PDF/CSV
- [ ] Custom dashboard widget configuration

---

## Verified Email-Bound Extraction Implementation

### Phase 1: Database Migrations (Day 1) — ✅ COMPLETE
- [x] 1.1 Move Daily Applications chart higher in DashboardHomeView (after Overview Cards section)
- [x] 1.2 Create `.analytics-grid` CSS (2-column grid, 1-column on mobile <980px)
- [x] 1.3 Extract chart into separate analytics card component
- [x] 1.4 Reduce chart height from 250px to 200px (compact view)
- [x] 1.5 Adjust Recharts dot sizes (r: 3 instead of r: 4) for compact layout
- [x] 1.6 Update XAxis and YAxis tick font sizes to 11px

**Phase 2: Pipeline Health Metrics Card** ✅ COMPLETE
- [x] 2.1 Create Pipeline Health card (second column in analytics grid)
- [x] 2.2 Add metrics: Active Roles (with % of total), Needs Follow-up (with pressure %), Offers (with close rate %)
- [x] 2.3 Add `.pipeline-health-summary` and `.health-metric` CSS classes
- [x] 2.4 Color code metrics: Active (indigo), Follow-up (amber), Offers (green)
- [x] 2.5 Pass pipelineColumns, stats, needsFollowUpJobs as props

**Phase 3: Responsive Layout** ✅ COMPLETE
- [x] 3.1 Test analytics grid on desktop (1200px+) - side-by-side charts
- [x] 3.2 Test analytics grid on tablet (980px) - stack vertically
- [x] 3.3 Test analytics grid on mobile (640px) - single column, full width
- [x] 3.4 Verify chart tooltip displays correctly at 200px height
- [x] 3.5 Test custom date range picker wrapping behavior on mobile

**Phase 4: Build & Deployment** ✅ COMPLETE
- [x] 4.1 Frontend build: cd client && npm run build
- [x] 4.2 Verify no errors or warnings
- [x] 4.3 Docker rebuild: docker compose down && docker compose up -d --build
- [x] 4.4 Verify both services healthy (backend 3001, frontend 5173)
- [x] 4.5 Test on http://localhost:5173

**Phase 5: QA & Testing** IN PROGRESS
- [ ] 5.1 Verify all date range options work (7, 14, 30, 90 days, custom)
- [ ] 5.2 Verify Pipeline Health metrics display correctly
- [ ] 5.3 Test with 0 applications (empty state displays)
- [ ] 5.4 Test with high application volume (scaling works)
- [ ] 5.5 Check for console errors/warnings in browser DevTools
- [ ] 5.6 Verify no regressions in other dashboard sections

### Backend Enhancements
- [ ] Custom date range support fully tested (startDate/endDate params)
- [ ] Backend can handle date ranges from 1 day to 90+ days
- [ ] Error handling for invalid dates

### Documentation
- [ ] Update README.md with new analytics features
- [ ] Document custom date range usage
- [ ] Add screenshots of new dashboard layout

### Performance & Optimization
- [ ] Evaluate chart rendering performance with large date ranges
- [ ] Consider memoization of chart data transformations if needed
- [ ] Optimize Recharts chart size for mobile (~200px height)

### Future Features
- [ ] Add Response Rate trend chart (parallel to Daily Applications)
- [ ] Add Interview conversion funnel visualization
- [ ] Add time-to-response analytics
- [ ] Export analytics data to PDF/CSV
- [ ] Custom dashboard widget configuration

---

## Verified Email-Bound Extraction Implementation

### Phase 1: Database Migrations (Day 1) — ✅ COMPLETE
- [x] 1.1 Create migration: `docs/database/008_user_email_verification.sql`
  - Add `email_verified_at TIMESTAMP` to app_users
  - Add `email_verification_token_hash TEXT` to app_users
  - Add `email_verification_sent_at TIMESTAMP` to app_users
  - Add `email_verification_attempts INT DEFAULT 0` to app_users
  - Create index on `email_verification_token_hash`
- [x] 1.2 Create migration: `docs/database/009_oauth_tokens_per_user.sql`
  - Drop old `oauth_tokens` table (single-row design: id=1)
  - Create new `oauth_tokens` with `id TEXT PRIMARY KEY` (format: oauth_{user_id})
  - Add `owner_user_id UUID UNIQUE NOT NULL`
  - Add `access_token, refresh_token, expires_at, verified_email_address`
  - Add `verified_at, created_at, updated_at` timestamps
  - Add FK: `owner_user_id REFERENCES app_users(id) ON DELETE CASCADE`
  - Create index on `owner_user_id`
- [x] 1.3 Run migrations against dev database and verify both tables created
- [x] 1.4 Update `docs/database/schema.sql` to document new table structure
- [x] 1.5 Add `.env` config: `SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM`

### Phase 2: User Store & Token APIs (Day 2) — ✅ COMPLETE
- [x] 2.1 Add to `server/src/store/userStore.js`:
  - `getUserByVerificationTokenHash(tokenHash)` — lookup user by token hash
  - `updateUserVerification(userId, {tokenHash, verifiedAt})` — set verified state
  - `setEmailVerificationTokenHash(userId, tokenHash, sentAt)` — store token + increment attempts
  - `isEmailVerified(user)` — helper function
- [x] 2.2 Add to `server/src/store/dataStore.js`:
  - **REPLACE** global `getTokens()` with `getTokensByUser(userId)` — per-user lookup
  - **REPLACE** global `setTokens()` with `setTokensForUser(userId, tokens, verifiedEmailAddress)` — per-user upsert
  - Add `refreshTokenIfExpiredForUser(userId)` — refresh expired token
  - Add `getAllUsersWithActiveTokens()` — return list of userIds with active tokens (for scheduler)
- [x] 2.3 Test token APIs:
  - Call `setTokensForUser(userA, tokensA, emailA)` and `setTokensForUser(userB, tokensB, emailB)`
  - Verify `getTokensByUser(userA)` returns only userA tokens
  - Verify `getTokensByUser(userB)` returns only userB tokens
  - Verify `getAllUsersWithActiveTokens()` returns [userA, userB]

### Phase 3: Auth Endpoints — Verification & Gmail OAuth (Day 3) — ✅ COMPLETE
- [x] 3.1 Add `POST /auth/verify-email/request` endpoint in `server/src/routes/authRoutes.js`
  - Require authenticated user
  - Rate limit: max 3 requests per hour per user
  - Generate crypto random token (32 bytes hex)
  - Hash token with SHA256
  - Store hash in DB via `setEmailVerificationTokenHash()`
  - Send email with verification link: `{FRONTEND_URL}/verify-email?token={token}`
  - Return success with "Expires In: 24 hours"
- [x] 3.2 Add `GET /auth/verify-email/confirm?token=...` endpoint in `server/src/routes/authRoutes.js`
  - Public endpoint (no auth required)
  - Hash query token with SHA256
  - Look up user via `getUserByVerificationTokenHash(tokenHash)`
  - Check token not older than 24 hours (from `email_verification_sent_at`)
  - Call `updateUserVerification(userId, {verifiedAt: now, tokenHash: null})`
  - Return success with redirect URL to `/dashboard?verified=true`
- [x] 3.3 Update `POST /auth/login` and `POST /auth/register` endpoints
  - Return response with: `user.email_verified_at, user.is_email_verified` (boolean)
- [x] 3.4 Update `GET /auth/gmail` endpoint (start OAuth)
  - Require authenticated user
  - Check `isEmailVerified(user)` — if false, return 403: "Please verify your email first"
  - Generate OAuth state token
  - Store userId in session: `req.session.oauthUserId = userId`
  - Redirect to Google OAuth URL
- [x] 3.5 Update `GET /auth/callback` endpoint (Gmail OAuth callback)
  - Validate OAuth state matches session state
  - Get userId from `req.session.oauthUserId`
  - Exchange auth code for tokens via Google API
  - **Fetch Gmail profile email**: `gmail.users.getProfile({ userId: "me" })`
  - **Enforce email match** (case-insensitive): if `gmailEmail !== appEmail`, return 403
  - Store tokens per-user: `await setTokensForUser(userId, tokens, gmailProfile.emailAddress)`
  - Redirect to `/dashboard?gmail_connected=true&email={gmailEmail}`
- [x] 3.6 Test all 5 endpoints:
  - Request verification email (no errors, email received)
  - Confirm verification (token valid, user marked verified)
  - Login returns is_email_verified flag
  - Gmail OAuth blocked for unverified user (403)
  - Gmail OAuth accepts matching email, rejects mismatched email (403)

### Phase 4: Job Sync & Extraction Service (Day 4) — ✅ COMPLETE
- [x] 4.1 Update `server/src/services/jobSync.js`:
  - Add `userId` parameter to `fetchJobEmails(options = {})`
  - Require userId — if missing, log and return (no extraction)
  - Load tokens: `const storedTokens = await getTokensByUser(userId)`
  - If no tokens, log and return (user not connected)
  - Refresh if expired: `await refreshTokenIfExpiredForUser(userId)`
  - Generate lock key: `lock_sync_${userId}`
  - Call `acquireSyncLock(lockKey)` — only this user can sync at once
  - Pass userId to `processMessagesWithQueue({ userId, gmail })`
  - Call `syncState.recordUserSync(userId, {extractedCount: results.length})`
- [x] 4.2 Update `processMessagesWithQueue()` in `server/src/services/jobSync.js`
  - Accept `{userId, gmail}` parameter
  - Pass userId to `isProcessedEmail(messageId, {userId})`
  - Pass userId to `markProcessedEmail(messageId, {userId})`
  - Pass userId to DB save calls in `extractJobFromMessage()`
- [x] 4.3 Update `POST /jobs/sync` route in `server/src/routes/jobRoutes.js`
  - Get authenticated userId
  - Call `fetchJobEmails({userId, mode: "manual"})`
  - Return success with userId confirmation
- [x] 4.4 Verify isProcessedEmail & markProcessedEmail in `server/src/store/dataStore.js`
  - Both must require userId parameter
  - Query DB with: `eq("owner_user_id", userId)` and `eq("message_id", messageId)`
  - Memory cache keyed by: `memory.processedIds[userId]`
- [x] 4.5 Test extraction:
  - User A syncs → extracts jobs only from User A's inbox
  - User B syncs → extracts jobs only from User B's inbox
  - Verify jobs table has correct `owner_user_id` for each

### Phase 5: Sync State & Per-User Locking (Day 4) — ✅ COMPLETE
- [x] 5.1 Update `server/src/services/syncState.js`:
  - Replace global lock with per-user locking
  - `acquireSyncLock(lockKey)` where lockKey = `sync_{userId}`
  - `releaseSyncLock(lockKey)`
  - Add `recordUserSync(userId, metadata)` — store when user last synced
  - Add `getUserLastSync(userId)` — retrieve last sync time
- [x] 5.2 Test concurrent syncs:
  - Start User A sync → acquires `sync_userA` lock
  - Start User B sync simultaneously → acquires `sync_userB` lock independently
  - Verify both run in parallel without blocking each other
  - Release locks and verify success for both

### Phase 6: Scheduler — Per-User Sync Loop (Day 5) — ✅ COMPLETE
- [x] 6.1 Update `server/src/scheduler/syncScheduler.js`:
  - Call `getAllUsersWithActiveTokens()` to get array of userIds
  - Loop through each userId sequentially
  - For each userId: `await fetchJobEmails({userId, mode: "daily"})`
  - Add 2-second delay between users to avoid API rate limiting
  - Log progress: users found, each user started/completed
- [x] 6.2 Test scheduler:
  - Mock schedule to run immediately
  - Create 2 test users with active tokens
  - Verify both users are synced (check extracted job counts)
  - Verify no token overwrite between users

### Phase 7: Frontend Auth Context & Verification UI (Day 6) — ✅ COMPLETE
- [x] 7.1 Update `client/src/auth/AuthContext.jsx`:
  - Add to user state: `email_verified_at, is_email_verified`
  - Add export: `isEmailVerified()` helper function
  - Update login/register handlers to populate verification state
- [x] 7.2 Create `client/src/pages/VerifyEmailPage.jsx` (NEW FILE)
  - Display verification status card
  - Handle URL param: `?token=...` to auto-verify
  - Show form to request resend if token missing
  - Rate limit warning if too many requests
  - Redirect to dashboard on success
- [x] 7.3 Update `client/src/api/backend.js`:
  - Add `requestEmailVerification()` — POST /auth/verify-email/request
  - Add `confirmEmailVerification(token)` — GET /auth/verify-email/confirm?token=...
- [x] 7.4 Update `client/src/pages/Dashboard.jsx`:
  - Get `isEmailVerified()` from auth context
  - Disable "Connect Gmail" button if not verified
  - Show text: "Verify Email First" when disabled
  - After OAuth callback, show: "Connected as: {email}"
  - Show button to trigger manual sync only when verified AND connected
- [x] 7.5 Test frontend:
  - Login → redirect to verification page if not verified
  - Request verification email (auto-sent)
  - Click verification link → redirected to dashboard
  - Connect Gmail button enabled after verification
  - Try connecting with mismatched Gmail → show error
  - Connect with matching Gmail → show success badge

### Phase 8: Testing & Validation (Day 7) — READY FOR TESTING
- [ ] 8.1 Unit tests for auth endpoints
  - Unverified user blocked from Gmail connect (403)
  - Verified user allowed (redirect to OAuth)
  - Mismatched Gmail email rejected (403)
  - Matching Gmail email accepted (tokens stored)
- [ ] 8.2 Integration test: Multi-user concurrent sync
  - Create User A, verify, connect Gmail
  - Create User B, verify, connect Gmail
  - Trigger sync for A → extracts A's emails
  - Trigger sync for B → extracts B's emails
  - Verify A's jobs have owner_user_id=A
  - Verify B's jobs have owner_user_id=B
  - Verify no token collision/overwrite
- [ ] 8.3 Database constraint tests
  - Verify `oauth_tokens` unique constraint on `owner_user_id`
  - Verify FK cascade delete removes tokens when user deleted
  - Verify indexes created and working
- [ ] 8.4 Manual E2E smoke test
  - [ ] Register → email_verified_at is null ✓
  - [ ] Check Gmail connect button → disabled ✓
  - [ ] Click Verify Email → verification page ✓
  - [ ] Request verification → email received ✓
  - [ ] Click verification link → verified, redirected to dashboard ✓
  - [ ] Check Gmail connect button → enabled ✓
  - [ ] Click Connect Gmail → OAuth flow ✓
  - [ ] Use different Gmail account → 403 error ✓
  - [ ] Use matching Gmail account → success ✓
  - [ ] Click Sync → jobs extracted from that Gmail ✓
  - [ ] Create second user, repeat (no interference with first user) ✓

### Phase 9: Deployment & Documentation — READY FOR DEPLOYMENT
- [ ] 9.1 Document new API endpoints in README.md
- [ ] 9.2 Add SMTP setup instructions to deployment docs
- [ ] 9.3 Test end-to-end in staging environment
- [ ] 9.4 Create backfill script if production data exists (legacy token migration)
- [ ] 9.5 Deploy to production with database migrations
- [ ] 9.6 Monitor logs for verification and extraction errors

---

## Completed Tasks (Previous Sprint)
✅ Daily Applications line chart implementation (Phases 1-10)
✅ Recharts dependency integration
✅ 7/14/30/90 day preset range selector
✅ Custom date range picker (start/end dates with Apply button)
✅ Backend support for custom date ranges
✅ Responsive chart styling and layout

---

## 🆕 EMAIL DATA EXTRACTION — Permission & Verification Feature (NEW)

### FEATURE OVERVIEW
Two-step consent verification for users to authorize Gmail data extraction:
- **Step 1:** OTP Consent Confirmation (6-digit code via email)
- **Step 2:** Email Link Verification (UUID token via email)

### Phase 1: Database Migrations — TODO
- [ ] 1.1 Create SQL migration: `docs/database/010_email_extraction_tables.sql`
- [ ] 1.2 Add columns to app_users: `otp_verified`, `email_extraction_enabled`, `extraction_verified_at`
- [ ] 1.3 Create `otp_verifications` table with: id, user_id, code, expires_at, used, created_at, attempts
- [ ] 1.4 Create `email_verify_tokens` table with: id, user_id, token, expires_at, used, created_at
- [ ] 1.5 Create `extraction_audit_log` table with: id, user_id, action, ip_address, user_agent, status, timestamp
- [ ] 1.6 Add indexes on: user_id, expires_at, token
- [ ] 1.7 Apply migration to Supabase
- [ ] **SECURITY:** Add NOT NULL constraints on code, expires_at, token columns
- [ ] **PERFORMANCE:** Add indexes for faster lookups

### Phase 2: Backend Routes & Services — TODO

#### Email Service (Nodemailer) with Brevo/Ethereal
- [ ] 2.1 Create `server/src/services/emailService.js`
- [ ] 2.2 Support Ethereal (dev) and Brevo (production) SMTP
- [ ] 2.3 OTP email template with: 6-char code, 15-min expiry, HTML inline styles
- [ ] 2.4 Verification link email template with: CTA button, explanation, 24-hr expiry note
- [ ] 2.5 Success confirmation email: "Gmail extraction is now active ✓"
- [ ] 2.6 Error handling if email delivery fails (log + return error)
- [ ] 2.7 JSDoc comments on all functions

#### Routes: `server/src/routes/emailExtraction.routes.js`
- [ ] 2.8 `POST /api/email-extraction/initiate` — Generate OTP, send email
  - Requires auth middleware
  - **RATE LIMIT:** Max 3 OTP requests per hour per user
  - **PREVENT SPAM:** Don't generate if active OTP exists
  - Return: `{ success: true, message: "Code sent to email" }`
  
- [ ] 2.9 `POST /api/email-extraction/verify-otp` — Validate OTP code
  - Requires auth middleware
  - **ATTEMPT LOCKOUT:** Max 5 wrong attempts → block 15min
  - Validate: code exists, not expired, not used, not locked
  - Mark OTP `used = true`, increment attempts
  - Set user `otp_verified = true`
  - **AUTO-TRIGGER:** Call send-verify-link endpoint
  - Return: `{ success: true, message: "Verify email next step" }`
  
- [ ] 2.10 `POST /api/email-extraction/resend-otp` — Resend OTP with cooldown
  - Requires auth middleware
  - **COOLDOWN:** 60 seconds between resends
  - **LIMIT:** Max 3 resend attempts per OTP
  - Return: `{ success: true, nextRetryAt: "2026-04-03T20:45:30Z" }`
  
- [ ] 2.11 `POST /api/email-extraction/send-verify-link` — Generate & send UUID verification link
  - Requires auth middleware
  - Check user has `otp_verified = true`
  - Generate UUID token
  - Store in DB with 24-hr expiry
  - Send email with link: `https://yourdomain.com/verify-extraction?token={uuid}`
  - Return: `{ success: true, message: "Verification link sent" }`
  
- [ ] 2.12 `GET /api/email-extraction/verify-link?token=xxx` — Validate and enable extraction
  - Requires auth middleware
  - **SECURITY:** Validate token belongs to current user (token.user_id === req.user.id)
  - Validate: token exists, not expired, not used
  - Mark token `used = true`
  - Update user: `email_extraction_enabled = true`, `extraction_verified_at = now()`
  - **LOG AUDIT:** Add entry to extraction_audit_log table
  - Send success confirmation email
  - Return: `{ success: true, message: "Gmail extraction is now active" }`
  
- [ ] 2.13 `GET /api/email-extraction/status` — Get user's extraction status
  - Requires auth middleware
  - Return: `{ otpVerified, extractionEnabled, verifiedAt, nextRetryAt }`

### Phase 3: Frontend Components — TODO

#### Component 1: `ActivateExtractionButton.jsx`
- [ ] 3.1 Shows status badge: "Not activated" / "OTP verified" / "Fully active"
- [ ] 3.2 Badge colors: red / amber / green
- [ ] 3.3 Click → opens OtpEntryModal
- [ ] 3.4 Lucide icons: Shield, ShieldCheck, Loader
- [ ] 3.5 Disable if already extraction_enabled
- [ ] 3.6 Place on Profile page (bottom section)

#### Component 2: `OtpEntryModal.jsx`
- [ ] 3.7 Six <input> boxes with auto-focus on next character
- [ ] 3.8 Each input: 48px x 48px, font-size 24px (mobile-friendly)
- [ ] 3.9 Allow paste: detect paste event → fill all boxes → auto-submit
- [ ] 3.10 Resend OTP button with countdown timer (60 sec cooldown)
- [ ] 3.11 Error message display with red styling
- [ ] 3.12 Loading state: "Verifying..." spinner
- [ ] 3.13 **ATTEMPT LOCKOUT UX:** Show "Too many attempts. Try again in 15 min"
- [ ] 3.14 Lucide: ShieldCheck, RefreshCw, Loader, AlertCircle icons
- [ ] 3.15 Tailwind dark mode compatible

#### Component 3: `VerifyEmailSentScreen.jsx`
- [ ] 3.16 Shows after OTP success
- [ ] 3.17 Message: "Check your email for verification link"
- [ ] 3.18 Resend link button (60 sec cooldown)
- [ ] 3.19 Lucide: Mail, CheckCircle icons

#### Component 4: `ExtractionVerifiedPage.jsx` (New Route)
- [ ] 3.20 Route: `/verify-extraction?token=xxx`
- [ ] 3.21 On mount: extract token from URL → call verify-link API
- [ ] 3.22 States: Loading → Success → Error (or redirect)
- [ ] 3.23 Success message: "Gmail extraction is now active ✓"
- [ ] 3.24 Auto-redirect to dashboard after 3 seconds on success
- [ ] 3.25 Error handling: show error message, offer retry button

### Phase 4: Authentication Hook — TODO

#### Hook: `useExtractionAccess.js`
- [ ] 4.1 Returns: `{ otpVerified, extractionEnabled, loading }`
- [ ] 4.2 Calls `GET /api/email-extraction/status` on mount
- [ ] 4.3 Caches status in state to avoid repeated API calls
- [ ] 4.4 Refresh function: `refreshStatus()`

#### Usage in components:
- [ ] 4.5 Use in any component that needs extraction access
- [ ] 4.6 If `extractionEnabled === false`: show activation prompt
- [ ] 4.7 If `extractionEnabled === true`: show extraction results

### Phase 5: Frontend - Profile Page Integration — TODO
- [ ] 5.1 Import `ActivateExtractionButton` component
- [ ] 5.2 Add section at bottom of profile: "Gmail Data Extraction"
- [ ] 5.3 Show current status: "Not activated" / "OTP verified" / "Fully active"
- [ ] 5.4 If not activated: show button to start flow
- [ ] 5.5 If activated: show "Active since [date]" + reauthorize option

### Phase 6: Frontend - Add Verification Route — TODO
- [ ] 6.1 Import `ExtractionVerifiedPage` in `App.jsx`
- [ ] 6.2 Add route: `<Route path="/verify-extraction" element={<ExtractionVerifiedPage />} />`
- [ ] 6.3 Make route protected (optional - public is fine for confirmation)

### Phase 7: Environment Configuration — TODO
- [ ] 7.1 Add to `.env`: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
- [ ] 7.2 For dev: Leave empty (use Ethereal test account)
- [ ] 7.3 For prod: Add Brevo SMTP credentials (get from brevo.com free tier)
- [ ] 7.4 Update `.env.example` with SMTP variables
- [ ] 7.5 Update `docker-compose.yml` with environment variables
- [ ] 7.6 Document SMTP setup in README.md

### Phase 8: Toast Notifications — TODO
- [ ] 8.1 Show green toast: "Code sent to your email"
- [ ] 8.2 Show green toast: "Code verified! Check your email for next step"
- [ ] 8.3 Show red toast: "Invalid code" / "Code expired"
- [ ] 8.4 Show red toast: "Too many attempts. Try again in 15 min"
- [ ] 8.5 Show green toast: "Gmail extraction is now active ✓"
- [ ] 8.6 Use existing toast system if available

### Phase 9: Testing Scenarios — TODO
- [ ] 9.1 Single user: Register → Verify email → Activate extraction (full flow)
- [ ] 9.2 OTP rate limit: Request 4 codes rapidly → 4th fails with 429
- [ ] 9.3 Attempt lockout: Enter wrong code 6 times → get blocked 15min
- [ ] 9.4 Token security: User A clicks User B's verification link → 403 error
- [ ] 9.5 Expired OTP: Try to verify after 15 min → "Code expired"
- [ ] 9.6 Expired link: Try to verify after 24 hr → "Link expired"
- [ ] 9.7 One-time link: Verify successfully → try link again → "Already used"
- [ ] 9.8 Auto-paste OTP: Paste 6-digit code → auto-fills all boxes → auto-submits

### Phase 10: Deployment & Documentation — TODO
- [ ] 10.1 Docker rebuild: `docker compose down && docker compose up -d --build`
- [ ] 10.2 Test full flow end-to-end on localhost
- [ ] 10.3 Test on production (if applicable)
- [ ] 10.4 Update README.md with email extraction feature overview
- [ ] 10.5 Document Brevo SMTP setup process
- [ ] 10.6 Add screenshots of OTP entry and success screens

### Security & Compliance — TODO
- [ ] 10.7 Verify audit log entries for all extraction activation steps
- [ ] 10.8 Test cleanup cron job: delete expired tokens hourly
- [ ] 10.9 Verify no email addresses leaked in error messages
- [ ] 10.10 Document compliance: GDPR, CCPA email practices
- [ ] 10.11 Test email delivery failure handling

---

## ❓ QUESTIONS FOR YOU

### 1. **Device/Session Binding — Should extraction be tied to device?**
   - **Yes**: Only the device that verified the link can extract data (more secure)
   - **No**: Any authenticated device can extract data (current design, more flexible)
   - *My Recommendation:* Start with **No** for simplicity, can add later

### 2. **Brevo Email Limit — Is 300 emails/day enough?**
   - If users sending lots of verification emails, consider paid SMTP
   - Or implement stricter rate limits (1 code per hour instead of 3)
   - *My Recommendation:* Start with Brevo free, increase if needed

### 3. **Should users be able to reauthorize extraction?**
   - Should there be a "Re-verify" button on their profile?
   - Or should extraction be permanent once enabled?
   - *My Recommendation:* Add "Re-verify" option for security updates later

### 4. **What if user changes their Gmail address?**
   - Should extraction be revoked automatically?
   - Or prompt user to reauthorize?
   - *My Recommendation:* Check email match on login, prompt reauthorize if different

### 5. **OTP Delivery Failure — What should happen if Nodemailer fails?**
   - Should we retry? How many times?
   - Should we fall back to SMS or security questions?
   - *My Recommendation:* Retry 2 times (5-sec delay), then give user error + manual resend button

### 6. **Auto-Redirect After Success — How long to wait?**
   - 3 seconds? 5 seconds?
   - Should user be able to skip redirect?
   - *My Recommendation:* 3 seconds, clickable "Go to Dashboard" button

### 7. **Should we log IP address in audit trail?**
   - For fraud detection and security review?
   - Adds privacy considerations (GDPR-compliant if we delete after 30 days)
   - *My Recommendation:* Yes, log IP + user_agent, delete after 90 days

### 8. **Rate Limit Reset — Hourly or per calendar day?**
   - Hourly: Resets based on when user made first request
   - Calendar day: Resets at midnight UTC
   - *My Recommendation:* Hourly (simpler to implement)

---

## RECOMMENDED PRIORITY

**Start with:** Database migrations (Phase 1) → Backend routes (Phase 2) → Frontend components (Phase 3)

**Can defer:** Audit logs (Phase 10), cleanup cron job, compliance docs
