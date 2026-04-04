# Email Extraction User Flow & Implementation Guide

## User Experience Flow

The email extraction verification system expects users to go through a structured consent flow:

### Step-by-Step User Journey

#### 1. Initial Request
```
User Action:
  - Clicks "Enable Email Extraction" button
  - Presented with explanation of what extraction does

Backend:
  - No action yet

Database:
  - No records created yet
```

#### 2. Email Entry
```
User Action:
  - Enters email address
  - Clicks "Send OTP"

Backend:
  - Validates email format
  - Checks rate limiting (1 per minute)
  - Generates 6-digit OTP code
  - Stores OTP in database with 15-minute expiry
  - In production: Sends OTP via email
  - In development: Returns OTP in response

Database:
  INSERT INTO otp_verifications (user_id, code, expires_at)
  VALUES ('user-id', '123456', now() + '15 minutes');

Frontend:
  - Shows masked email: "u****@example.com"
  - Displays success message
  - Transitions to OTP entry screen
```

#### 3. OTP Verification
```
User Action:
  - Receives OTP via email
  - Enters 6-digit code
  - Clicks "Verify Code"

Backend:
  - Validates OTP format (6 digits)
  - Checks if OTP has expired
  - Checks if OTP already used
  - Checks attempt count (max 5)
  - Verifies code matches
  - If incorrect:
    - Increments attempt counter
    - Returns remaining attempts
    - Locks account after 5 attempts for 15 minutes
  - If correct:
    - Marks OTP as used
    - Updates user: otp_verified = true
    - Generates email verification token (UUID)
    - Stores token with 24-hour expiry
    - Returns token to client

Database:
  UPDATE otp_verifications SET used = true WHERE id = 'otp-id';
  UPDATE app_users SET otp_verified = true WHERE id = 'user-id';
  INSERT INTO email_verify_tokens (user_id, token, expires_at)
  VALUES ('user-id', 'a1b2c3d4...', now() + '24 hours');

Frontend:
  - Shows success message
  - Transitions to email verification screen
```

#### 4. Email Verification
```
User Action:
  - Receives verification email with link
  - Clicks link in email: "https://app.com/verify-extraction?token=a1b2c3d4..."
  - Frontend automatically verifies token

Backend:
  - POST /api/extract/verify-email receives token
  - Queries for token in database
  - Checks if token is valid and not expired
  - Checks if token already used
  - Marks token as used
  - Updates user: email_extraction_enabled = true
  - Logs action in audit table

Database:
  UPDATE email_verify_tokens SET used = true WHERE token = 'a1b2c3d4...';
  UPDATE app_users SET email_extraction_enabled = true WHERE id = 'user-id';
  INSERT INTO extraction_audit_log (user_id, action, status) 
  VALUES ('user-id', 'enabled', 'success');

Frontend:
  - Shows success message
  - Shows "Extraction Enabled!" confirmation
  - User can close component
```

## Architecture Documentation

### Component Hierarchy

```
App.jsx
  ├─ Dashboard.jsx
  │  └─ EmailExtractionVerification.jsx
  │     ├─ Step: InitialStep
  │     ├─ Step: OTPRequestStep
  │     ├─ Step: OTPVerifyStep
  │     ├─ Step: EmailVerifyStep
  │     └─ Step: SuccessStep
  └─ VerifyExtractionPage.jsx (for email link clicks)
```

### Data Flow

```
Frontend Component
  ├─ State: step, email, code, token, error, loading
  ├─ Handlers:
  │  ├─ handleRequestOTP() → calls api.requestOTP()
  │  ├─ handleVerifyOTP() → calls api.verifyOTP()
  │  ├─ handleVerifyEmail() → calls api.verifyEmailToken()
  │  └─ checkExtractionStatus() → calls api.getExtractionStatus()
  │
  └─ API Client (emailExtraction.js)
      └─ Makes HTTP requests to backend

Express Routes (emailExtractionRoutes.js)
  ├─ POST /request-otp
  │  └─ calls emailExtractionService.requestOTP()
  ├─ POST /verify-otp
  │  └─ calls emailExtractionService.verifyOTP()
  ├─ POST /verify-email
  │  └─ calls emailExtractionService.verifyEmailToken()
  ├─ GET /status
  │  └─ calls emailExtractionService.getExtractionStatus()
  └─ GET /audit-log
     └─ calls emailExtractionService.getAuditLog()

Service Layer (emailExtractionService.js)
  ├─ Business logic
  ├─ Security enforcement
  ├─ Database queries
  └─ Audit logging

Utilities (emailExtractionUtils.js)
  ├─ OTP generation
  ├─ Token creation
  ├─ Format validation
  ├─ Security checks
  └─ Email utilities

Database
  ├─ otp_verifications (OTP records)
  ├─ email_verify_tokens (verification tokens)
  └─ extraction_audit_log (audit trail)
```

## Implementation Checklist

### Backend Implementation

- [ ] Database migration applied
  - [ ] `otp_verifications` table created
  - [ ] `email_verify_tokens` table created
  - [ ] `extraction_audit_log` table created
  - [ ] Indexes created for performance
  - [ ] Columns added to `app_users` table

- [ ] Backend files installed
  - [ ] `emailExtractionUtils.js` → `server/src/utils/`
  - [ ] `requestUtils.js` → `server/src/utils/`
  - [ ] `emailExtractionService.js` → `server/src/services/`
  - [ ] `emailExtractionRoutes.js` → `server/src/routes/`

- [ ] Routes registered in Express app
  - [ ] Import routes: `import emailExtractionRoutes from './routes/emailExtractionRoutes.js'`
  - [ ] Register middleware: `app.use('/api/extract', emailExtractionRoutes)`
  - [ ] Test endpoint: `GET /api/extract/status` returns 200

- [ ] Email service configured (if using real emails)
  - [ ] Nodemailer installed
  - [ ] SMTP credentials in `.env`
  - [ ] Email templates created
  - [ ] Test mail sending

- [ ] Environment variables set
  - [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
  - [ ] `SMTP_FROM_EMAIL`, `FRONTEND_URL`
  - [ ] All variables tested

### Frontend Implementation

- [ ] Frontend files installed
  - [ ] `emailExtraction.js` → `client/src/api/`
  - [ ] `EmailExtractionVerification.jsx` → `client/src/components/`
  - [ ] `emailExtractionVerification.css` → `client/src/components/`

- [ ] Component imported in main app
  - [ ] Import in Dashboard: `import EmailExtractionVerification from '../components/EmailExtractionVerification'`
  - [ ] Import styles: `import '../components/emailExtractionVerification.css'`

- [ ] Verification page created (for email links)
  - [ ] `VerifyExtractionPage.jsx` created
  - [ ] Route added: `/verify-extraction`
  - [ ] Token verification implemented

- [ ] UI integration
  - [ ] "Enable Email Extraction" button added to dashboard
  - [ ] Modal/component shown on button click
  - [ ] Success/error messages displayed
  - [ ] Loading states handled

- [ ] Styling
  - [ ] CSS imported and applied
  - [ ] Responsive design works on mobile
  - [ ] Color scheme matches app
  - [ ] Icons/buttons styled properly

### Testing

- [ ] Development mode
  - [ ] Backend starts without errors
  - [ ] Frontend starts without errors
  - [ ] Network requests visible in DevTools

- [ ] OTP Flow
  - [ ] Request OTP endpoint works
  - [ ] OTP code generated and stored
  - [ ] Email (or response) shows OTP
  - [ ] OTP verification works
  - [ ] Correct code accepted
  - [ ] Incorrect code rejected with message
  - [ ] Attempt counter works
  - [ ] Lockout after 5 attempts

- [ ] Token Flow
  - [ ] Token generated after OTP verification
  - [ ] Token verification endpoint works
  - [ ] Email link with token works
  - [ ] Token verification sets extraction_enabled flag

- [ ] Status Checks
  - [ ] GET /api/extract/status returns correct state
  - [ ] Before verification: otpVerified = false, emailExtractionEnabled = false
  - [ ] After OTP: otpVerified = true, emailExtractionEnabled = false
  - [ ] After email: otpVerified = true, emailExtractionEnabled = true

- [ ] Audit Logging
  - [ ] All actions logged
  - [ ] Failed attempts recorded
  - [ ] IP addresses captured
  - [ ] Timestamps correct

- [ ] Rate Limiting
  - [ ] OTP requests limited to 1/minute
  - [ ] OTP verification attempts limited to 5/15mins
  - [ ] Appropriate error messages shown

- [ ] Error Handling
  - [ ] Network errors handled gracefully
  - [ ] Invalid input validated
  - [ ] Expired tokens rejected
  - [ ] Used tokens rejected
  - [ ] Missing auth rejected

### Production Deployment

- [ ] Security measures
  - [ ] HTTPS configured
  - [ ] CORS properly set
  - [ ] Rate limiting enabled
  - [ ] Input validation strict

- [ ] Email configuration
  - [ ] Sending OTP via email (not in response)
  - [ ] Verification link sent correctly
  - [ ] Email templates professional
  - [ ] Email delivery monitored

- [ ] Database
  - [ ] Backups configured
  - [ ] Migration history tracked
  - [ ] Cleanup jobs scheduled for old records

- [ ] Monitoring
  - [ ] Error rates monitored
  - [ ] Failed attempts tracked
  - [ ] Suspicious activity alerted
  - [ ] Audit logs reviewed

- [ ] Documentation
  - [ ] API docs complete
  - [ ] Integration guide complete
  - [ ] User flow documented
  - [ ] Troubleshooting guide ready

## Error Scenarios & Handling

### Scenario 1: User Requests OTP Multiple Times

```
Expected Behavior:
1. First request → OTP sent
2. Second request within 1 minute → "Wait 1 minute" error
3. After 1 minute → Can request again

Implementation:
- Check: SELECT * FROM otp_verifications 
  WHERE user_id = $1 AND created_at > now() - interval '1 minute'
- If found: Return RATE_LIMITED error
- Otherwise: Generate new OTP
```

### Scenario 2: User Enters Wrong OTP

```
Expected Behavior:
1. Wrong code entered
2. Show "Invalid OTP, 4 attempts remaining"
3. After 5 wrong attempts
4. Show "Account locked for 15 minutes"

Implementation:
- Check: otp.attempts < MAX_OTP_ATTEMPTS
- Increment: otp.attempts += 1
- If at max: Set blocked_until = now() + 15 minutes
- Return: attempts remaining in response
```

### Scenario 3: OTP Expires

```
Expected Behavior:
1. User doesn't verify within 15 minutes
2. OTP expires automatically
3. User must request new OTP

Implementation:
- When verifying: Check expires_at < now()
- If expired: Return "OTP expired, request new one"
- Prevent using old OTP
```

### Scenario 4: Email Link Clicked After Expiration

```
Expected Behavior:
1. Email link received
2. User waits 25 hours
3. Click link
4. Get "Link expired, request new extraction"

Implementation:
- When verifying token: Check expires_at < now()
- If expired: Return "TOKEN_EXPIRED" error
- Suggest user start over
```

### Scenario 5: Email Link Used Twice

```
Expected Behavior:
1. User clicks link first time → Success
2. User clicks same link again → "Already verified"

Implementation:
- When verifying: Check used = true
- If already used: Return "TOKEN_USED" error
- Check extraction status for current state
```

## State Management Reference

### Frontend Component State

```javascript
// Current Step
step = 'initial' | 'otp_request' | 'otp_verify' | 'email_verify' | 'success'

// Form Data
email = string
otpCode = string (exactly 6 digits)
verificationToken = string (UUID)

// UI State
loading = boolean
error = string
successMessage = string

// Security Info
attemptsRemaining = number (0-5)
retryAfterSeconds = number (countdown timer)

// User Data
maskedEmail = string (e.g., "u****@example.com")
extractionStatus = {
  otpVerified: boolean,
  emailExtractionEnabled: boolean,
  verifiedAt: timestamp,
  email: string
}
```

### Database State

```javascript
// OTP Record
{
  id: UUID,
  user_id: UUID,
  code: string (6 digits),
  expires_at: timestamp,
  used: boolean,
  attempts: number,
  blocked_until: timestamp | null,
  created_at: timestamp
}

// Email Token Record
{
  id: UUID,
  user_id: UUID,
  token: string (UUID hex),
  expires_at: timestamp,
  used: boolean,
  created_at: timestamp
}

// User Record (updated fields)
{
  id: UUID,
  email: string,
  otp_verified: boolean,
  email_extraction_enabled: boolean,
  extraction_verified_at: timestamp | null
}

// Audit Log Record
{
  id: UUID,
  user_id: UUID,
  action: string,
  status: 'success' | 'failed',
  ip_address: string | null,
  user_agent: string,
  error_message: string | null,
  timestamp: timestamp
}
```

## Performance Considerations

### Database Indexes

The migration creates optimal indexes:

```sql
-- Fast lookups by user
CREATE INDEX idx_otp_verifications_user_id ON otp_verifications(user_id);

-- Fast cleanup of expired records
CREATE INDEX idx_otp_verifications_expires_at ON otp_verifications(expires_at);

-- Check if token is valid
CREATE INDEX idx_otp_verifications_code ON otp_verifications(code) WHERE used = false;

-- Quick token lookup
CREATE INDEX idx_email_verify_tokens_token ON email_verify_tokens(token) WHERE used = false;

-- User token history
CREATE INDEX idx_email_verify_tokens_user_id ON email_verify_tokens(user_id);

-- Cleanup old tokens
CREATE INDEX idx_email_verify_tokens_expires_at ON email_verify_tokens(expires_at);

-- Audit log queries
CREATE INDEX idx_extraction_audit_log_user_id ON extraction_audit_log(user_id);
CREATE INDEX idx_extraction_audit_log_timestamp ON extraction_audit_log(timestamp);
CREATE INDEX idx_extraction_audit_log_action ON extraction_audit_log(action);
```

### Query Performance

- OTP lookup: ~1ms (indexed on user_id)
- Token lookup: ~1ms (indexed on token)
- Audit log query: ~50ms for 50 records (indexed on user_id)

### Memory Optimization

- Component state kept minimal
- No large arrays in state
- Event listeners cleaned up
- Timers cancelled on unmount

---

## Quick Reference

### Common API Calls

```javascript
// Request OTP
POST /api/extract/request-otp
Body: { email: "user@example.com" }
Response: { success, message, maskedEmail, code }

// Verify OTP
POST /api/extract/verify-otp
Body: { code: "123456" }
Response: { success, verificationLink: { token, expiresIn } }

// Verify Email Token
POST /api/extract/verify-email
Body: { token: "a1b2c3d4..." }
Response: { success, extractionEnabled: true }

// Check Status
GET /api/extract/status
Response: { success, status: { otpVerified, emailExtractionEnabled, verifiedAt, email } }

// Get Audit Log
GET /api/extract/audit-log?limit=50
Response: { success, records: [...] }
```

### Database Queries

```sql
-- Check user's OTP records
SELECT * FROM otp_verifications 
WHERE user_id = 'user-id'
ORDER BY created_at DESC LIMIT 10;

-- Check user's extraction status
SELECT otp_verified, email_extraction_enabled, extraction_verified_at
FROM app_users WHERE id = 'user-id';

-- View extraction audit trail
SELECT action, status, timestamp, ip_address 
FROM extraction_audit_log
WHERE user_id = 'user-id'
ORDER BY timestamp DESC LIMIT 50;

-- Find locked-out users
SELECT user_id, blocked_until 
FROM otp_verifications
WHERE blocked_until > now();
```

---

## Deployment Checklist

- [ ] All files copied to correct locations
- [ ] Database migration applied
- [ ] Routes registered in Express app
- [ ] Environment variables configured
- [ ] Email service configured
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Database backups enabled
- [ ] Monitoring setup
- [ ] Audit logs reviewed
- [ ] User documentation ready
- [ ] Support team trained
- [ ] Load testing completed
- [ ] Security audit passed
