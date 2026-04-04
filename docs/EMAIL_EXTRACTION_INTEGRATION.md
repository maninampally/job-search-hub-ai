# Email Extraction Integration Guide

## Overview

This guide walks through integrating the email extraction verification system into Job Search Hub. The system implements a secure two-step verification flow with OTP and email token verification.

## Architecture

```
Frontend (React)
  ↓
  EmailExtractionVerification.jsx (UI Component)
  ↓ (calls API functions from)
  emailExtraction.js (API Client)
  ↓ (HTTP requests to)
Backend (Node.js/Express)
  ↓
  emailExtractionRoutes.js (HTTP Endpoints)
  ↓ (calls)
  emailExtractionService.js (Business Logic)
  ↓ (uses utilities from)
  emailExtractionUtils.js (Security Functions)
  ↓ (queries)
Database (PostgreSQL)
  ↓
  010_email_extraction_tables.sql (Schema)
```

## Installation Steps

### Step 1: Database Setup

1. **Run migration:**
   ```bash
   psql -U postgres -d job_search_hub -f docs/database/010_email_extraction_tables.sql
   ```

2. **Verify tables created:**
   ```bash
   psql -U postgres -d job_search_hub -c "\dt otp_verifications email_verify_tokens extraction_audit_log"
   ```

   Expected output:
   ```
   Schema |           Name            |       Type       |
   --------+---------------------------+------------------+
    public | email_verify_tokens       | table            |
    public | extraction_audit_log      | table            |
    public | otp_verifications         | table            |
   ```

### Step 2: Backend Setup

1. **Install dependency (if not already installed):**
   ```bash
   cd server
   npm install uuid
   ```

2. **Copy utility files:**
   - `emailExtractionUtils.js` → `server/src/utils/`
   - `requestUtils.js` → `server/src/utils/`

3. **Copy service file:**
   - `emailExtractionService.js` → `server/src/services/`

4. **Copy route file:**
   - `emailExtractionRoutes.js` → `server/src/routes/`

5. **Register routes in Express app** (`server/src/app.js`):
   ```javascript
   import emailExtractionRoutes from './routes/emailExtractionRoutes.js';
   
   // Add this line in the routes section
   app.use('/api/extract', emailExtractionRoutes);
   ```

6. **Verify endpoint availability:**
   ```bash
   curl -X GET http://localhost:3000/api/extract/status \
     -H "Authorization: Bearer <test-token>"
   ```

### Step 3: Frontend Setup

1. **Copy API client file:**
   - `emailExtraction.js` → `client/src/api/`

2. **Copy React component:**
   - `EmailExtractionVerification.jsx` → `client/src/components/`

3. **Copy styles:**
   - `emailExtractionVerification.css` → `client/src/components/`

4. **Import in your React page** (e.g., `Dashboard.jsx`):
   ```javascript
   import EmailExtractionVerification from '../components/EmailExtractionVerification.jsx';
   import '../components/emailExtractionVerification.css';
   
   function Dashboard() {
     const [showExtraction, setShowExtraction] = useState(false);
     
     return (
       <div>
         {showExtraction && (
           <EmailExtractionVerification
             onSuccess={() => {
               setShowExtraction(false);
               // Refresh extraction status or show success message
             }}
             onCancel={() => setShowExtraction(false)}
           />
         )}
         
         <button onClick={() => setShowExtraction(true)}>
           Enable Email Extraction
         </button>
       </div>
     );
   }
   ```

## Configuration

### Backend Configuration

#### Email Sending (Required for Production)

In `emailExtractionService.js`, the `requestOTP` function sends OTP via email. Currently, it returns the code in development mode.

To send via email:

1. **Install email package:**
   ```bash
   npm install nodemailer
   ```

2. **Create email service** (`server/src/services/emailService.js`):
   ```javascript
   import nodemailer from 'nodemailer';
   
   const transporter = nodemailer.createTransport({
     host: process.env.SMTP_HOST,
     port: process.env.SMTP_PORT,
     auth: {
       user: process.env.SMTP_USER,
       pass: process.env.SMTP_PASSWORD
     }
   });
   
   export async function sendOTPEmail(email, code) {
     await transporter.sendMail({
       from: process.env.SMTP_FROM_EMAIL,
       to: email,
       subject: 'Your Job Search Hub Verification Code',
       html: `
         <h2>Verification Code</h2>
         <p>Your 6-digit code is: <strong>${code}</strong></p>
         <p>This code expires in 15 minutes.</p>
       `
     });
   }
   
   export async function sendVerificationEmail(email, token) {
     const verifyLink = `${process.env.FRONTEND_URL}/verify-extraction?token=${token}`;
     
     await transporter.sendMail({
       from: process.env.SMTP_FROM_EMAIL,
       to: email,
       subject: 'Verify Your Email for Job Search Hub',
       html: `
         <h2>Email Verification</h2>
         <p>Click the link below to verify your email and enable job extraction:</p>
         <a href="${verifyLink}">Verify Email</a>
         <p>This link expires in 24 hours.</p>
       `
     });
   }
   ```

3. **Update `requestOTP` function** in `emailExtractionService.js`:
   ```javascript
   // After generating OTP
   await sendOTPEmail(sanitized, code);
   
   // Remove the 'code' field from response
   return {
     success: true,
     message: 'OTP sent to your email',
     maskedEmail: maskEmail(sanitized),
     expiresIn: 900
     // Don't include 'code' in production
   };
   ```

4. **Add environment variables** (`.env`):
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   SMTP_FROM_EMAIL=no-reply@jobsearchhub.com
   FRONTEND_URL=https://yourdomain.com
   ```

### Frontend Configuration

Update API base URL if needed in `client/src/api/emailExtraction.js`:

```javascript
// The API client uses the existing backend.js configuration
// Update backend.js if you need to change the base URL
```

## Email Verification Link Handler

Add a route to handle email verification links:

### Backend: Verification Link Endpoint

Add to Express app (`server/src/app.js`):

```javascript
app.get('/verify-extraction/:token', (req, res) => {
  const { token } = req.params;
  
  // Redirect to frontend with token parameter
  res.redirect(`${process.env.FRONTEND_URL}/verify-extraction?token=${token}`);
});
```

### Frontend: Verification Link Handler

Create a new page component (`client/src/pages/VerifyExtractionPage.jsx`):

```javascript
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { verifyEmailToken } from '../api/emailExtraction.js';

export function VerifyExtractionPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setError('No verification token provided');
      setLoading(false);
      return;
    }

    // Verify token
    verifyEmailToken(token)
      .then(response => {
        if (response.error) {
          setError(response.error.message);
        } else {
          setMessage('Email verified successfully! Redirecting...');
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 2000);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) return <div>Verifying...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  return <div className="alert alert-success">{message}</div>;
}
```

Add to router:

```javascript
import { VerifyExtractionPage } from './pages/VerifyExtractionPage.jsx';

// In your router configuration
{
  path: '/verify-extraction',
  element: <VerifyExtractionPage />
}
```

## Testing

### Manual Testing

1. **Start backend:**
   ```bash
   cd server
   npm start
   ```

2. **Start frontend:**
   ```bash
   cd client
   npm run dev
   ```

3. **Test OTP request:**
   ```bash
   curl -X POST http://localhost:3000/api/extract/request-otp \
     -H "Authorization: Bearer your-test-token" \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

4. **Test in UI:**
   - Navigate to dashboard
   - Click "Enable Email Extraction"
   - Enter email
   - Copy OTP from response (development mode)
   - Enter OTP in UI
   - System redirects to email verification

### Integration Tests

Add tests to `server/integration-tests.js`:

```javascript
async function testEmailExtraction() {
  console.log('\n=== Email Extraction Tests ===');
  
  // Test OTP Request
  console.log('1. Testing OTP request...');
  const otpResponse = await fetch('http://localhost:3000/api/extract/request-otp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${testToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: 'test@example.com' })
  });
  console.log('OTP Response:', await otpResponse.json());
  
  // Test OTP Verification
  console.log('2. Testing OTP verification...');
  const verifyResponse = await fetch('http://localhost:3000/api/extract/verify-otp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${testToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code: '123456' })
  });
  console.log('Verify Response:', await verifyResponse.json());
  
  // Test Status
  console.log('3. Testing extraction status...');
  const statusResponse = await fetch('http://localhost:3000/api/extract/status', {
    headers: { 'Authorization': `Bearer ${testToken}` }
  });
  console.log('Status Response:', await statusResponse.json());
}
```

## Security Considerations

### 1. Input Validation

All inputs are validated:
- Email format using RFC 5322 pattern
- OTP format (6 digits)
- Token format (UUID hex string)

### 2. Rate Limiting

- OTP requests: 1 per minute per user
- OTP verification: 5 attempts max, then 15-minute lockout
- Implement API-level rate limiting if needed:

```javascript
import rateLimit from 'express-rate-limit';

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: 'Too many OTP attempts, please try again later'
});

app.post('/api/extract/verify-otp', otpLimiter, emailExtractionRoutes);
```

### 3. HTTPS Requirement

Always use HTTPS in production:
```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('path/to/private-key.pem'),
  cert: fs.readFileSync('path/to/certificate.pem')
};

https.createServer(options, app).listen(3000);
```

### 4. CORS Configuration

Configure CORS for security:
```javascript
import cors from 'cors';

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

### 5. Environment Variables

Never hardcode secrets:
```
# .env file
SMTP_PASSWORD=secret-only-in-env
DATABASE_PASSWORD=secret-only-in-env
JWT_SECRET=secret-only-in-env
```

### 6. Audit Logging

Review audit logs regularly:
```bash
# View recent extraction activities
psql -U postgres -d job_search_hub -c \
  "SELECT action, status, timestamp FROM extraction_audit_log 
   WHERE timestamp > now() - interval '24 hours' 
   ORDER BY timestamp DESC;"
```

## Troubleshooting

### OTP Not Working

1. **Check database:**
   ```bash
   psql -U postgres -d job_search_hub -c \
     "SELECT * FROM otp_verifications WHERE created_at > now() - interval '1 hour';"
   ```

2. **Check rate limiting:**
   - Ensure 1 minute has passed since last request
   - Check `created_at` timestamps in database

3. **Check email service:**
   - Verify SMTP credentials in `.env`
   - Check email provider's app password settings

### Token Verification Failing

1. **Check token expiration:**
   ```bash
   psql -U postgres -d job_search_hub -c \
     "SELECT * FROM email_verify_tokens WHERE expires_at < now();"
   ```

2. **Check token usage:**
   ```bash
   psql -U postgres -d job_search_hub -c \
     "SELECT * FROM email_verify_tokens WHERE token = 'your-token';"
   ```

### Account Locked

1. **Check lockout status:**
   ```bash
   psql -U postgres -d job_search_hub -c \
     "SELECT * FROM otp_verifications WHERE blocked_until > now();"
   ```

2. **Clear lockout (admin only):**
   ```bash
   psql -U postgres -d job_search_hub -c \
     "UPDATE otp_verifications SET blocked_until = null WHERE user_id = 'user-id';"
   ```

## Monitoring

### Log Queries

Monitor extraction activities:

```javascript
// In a monitoring service
async function monitorExtractionActivity() {
  const lastHourActivity = await db.query(`
    SELECT 
      action,
      COUNT(*) as count,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failures
    FROM extraction_audit_log
    WHERE timestamp > now() - interval '1 hour'
    GROUP BY action
  `);
  
  console.log('Extraction Activity (Last Hour):', lastHourActivity.rows);
}
```

### Alerts

Set up alerts for:
- Multiple failed verification attempts
- Repeated account lockouts
- High error rates
- Suspicious IP addresses

### Metrics to Track

- Successful extractions enabled
- Failed verification attempts
- Account lockouts
- Email delivery failures
- Average verification time

## Compliance

### GDPR Compliance

- IP addresses deleted after 90 days
- Audit logs retained for 1 year
- User can request data deletion
- Verification timestamps logged

### CCPA Compliance

- User can view their audit log
- User can request deletion of records
- Transparent collection practices
- Opt-in consent model

### Data Retention

```sql
-- Cleanup jobs (run via cron)
-- Delete expired OTP records (daily)
DELETE FROM otp_verifications 
WHERE expires_at < now() AND used = true;

-- Delete old audit logs (yearly)
DELETE FROM extraction_audit_log 
WHERE timestamp < now() - interval '1 year';

-- Delete IP addresses (90 days)
UPDATE extraction_audit_log 
SET ip_address = null
WHERE timestamp < now() - interval '90 days';
```

## Migration from Legacy System

If migrating from a legacy system:

1. **Create mapping table:**
   ```sql
   CREATE TABLE IF NOT EXISTS extraction_legacy_mapping (
     user_id UUID PRIMARY KEY,
     legacy_id VARCHAR(255),
     migrated_at TIMESTAMPTZ DEFAULT now()
   );
   ```

2. **Run migration script:**
   ```javascript
   // Migrate legacy users to new system
   async function migrateUsers() {
     const legacyUsers = await db.query('SELECT * FROM legacy_users');
     
     for (const user of legacyUsers.rows) {
       await db.query(
         'INSERT INTO extraction_legacy_mapping (user_id, legacy_id) VALUES ($1, $2)',
         [user.new_id, user.legacy_id]
       );
     }
   }
   ```

## Support & Troubleshooting

For issues:
1. Check audit logs first
2. Review error codes in API documentation
3. Check SQL logs using error message details
4. Enable debug logging in development
5. Contact support with logs and user ID

---

## Next Steps

After integration:
1. Enable email extraction in UI
2. Monitor extraction success rates
3. Collect user feedback
4. Optimize email parsing
5. Add extraction status dashboard
