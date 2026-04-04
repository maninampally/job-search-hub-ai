# Email Extraction API Documentation

## Overview

The Email Extraction API provides secure consent and verification endpoints for enabling email-based job opportunity extraction in Job Search Hub. It implements industry-standard security practices including one-time passwords (OTP), email verification tokens, rate limiting, and comprehensive audit logging.

## Base URL

```
POST/GET /api/extract
```

All endpoints require user authentication via bearer token in the `Authorization` header.

---

## Endpoints

### 1. Request OTP

**Endpoint:** `POST /api/extract/request-otp`

Request a 6-digit one-time password for email extraction verification.

#### Request

```json
{
  "email": "user@example.com"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | Email address to verify |

#### Response (Success)

```json
{
  "success": true,
  "message": "OTP sent to your email",
  "maskedEmail": "u****@example.com",
  "expiresIn": 900,
  "code": "123456"
}
```

**Note:** In production, remove the `code` field and send the OTP via email instead.

#### Response (Error)

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "OTP requested too soon. Please wait 1 minute before requesting another."
  }
}
```

#### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| INVALID_EMAIL | 400 | Email format is invalid |
| RATE_LIMITED | 429 | User requested OTP too soon (max 1 per minute) |
| ACCOUNT_LOCKED | 429 | User account is temporarily locked |
| ERROR | 500 | Server error |

#### Security

- **Rate Limit:** 1 OTP request per minute per user
- **Storage:** OTP stored securely in database, expires in 15 minutes
- **Validation:** Email format validated using RFC 5322 simplified pattern

---

### 2. Verify OTP

**Endpoint:** `POST /api/extract/verify-otp`

Verify the 6-digit OTP code sent to user's email.

#### Request

```json
{
  "code": "123456"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | 6-digit OTP code |

#### Response (Success)

```json
{
  "success": true,
  "message": "OTP verified successfully",
  "nextStep": "email_verification",
  "verificationLink": {
    "token": "a1b2c3d4e5f6...",
    "expiresIn": 86400
  }
}
```

#### Response (Error)

```json
{
  "error": {
    "code": "INVALID_CODE",
    "message": "Invalid OTP. 4 attempts remaining.",
    "details": {
      "attemptsRemaining": 4
    }
  }
}
```

#### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| INVALID_FORMAT | 400 | Code is not 6 digits |
| NO_OTP | 400 | No OTP request found |
| OTP_EXPIRED | 400 | OTP has expired |
| INVALID_CODE | 400 | Code is incorrect |
| ACCOUNT_LOCKED | 429 | Account locked after 5 failed attempts |
| ERROR | 500 | Server error |

#### Security

- **Attempt Limit:** Maximum 5 failed verification attempts
- **Lockout:** After 5 failed attempts, account locked for 15 minutes
- **One-Time Use:** OTP can only be verified once
- **Expiration:** OTP expires 15 minutes after creation
- **Audit:** All attempts logged for security monitoring

---

### 3. Verify Email Token

**Endpoint:** `POST /api/extract/verify-email`

Verify the email verification token received from email link.

#### Request

```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0..."
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | UUID verification token |

#### Response (Success)

```json
{
  "success": true,
  "message": "Email extraction enabled successfully",
  "extractionEnabled": true
}
```

#### Response (Error)

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Verification token has expired"
  }
}
```

#### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| INVALID_TOKEN | 400 | Token is invalid or not found |
| TOKEN_USED | 400 | Token has already been used |
| TOKEN_EXPIRED | 400 | Token has expired (24-hour validity) |
| ERROR | 500 | Server error |

#### Security

- **Token Format:** UUID hex string (64 characters)
- **One-Time Use:** Token can only be verified once
- **Expiration:** Token expires 24 hours after creation
- **Distribution:** Token sent via email for distributed authentication

---

### 4. Get Extraction Status

**Endpoint:** `GET /api/extract/status`

Retrieve current extraction verification status for the authenticated user.

#### Response (Success)

```json
{
  "success": true,
  "status": {
    "otpVerified": true,
    "emailExtractionEnabled": true,
    "verifiedAt": "2024-01-15T10:30:00Z",
    "email": "user@example.com"
  }
}
```

#### Response (Error)

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found"
  }
}
```

#### Status Fields

| Field | Type | Description |
|-------|------|-------------|
| otpVerified | boolean | Whether OTP has been verified |
| emailExtractionEnabled | boolean | Whether extraction is enabled |
| verifiedAt | ISO8601 | Timestamp of last successful verification |
| email | string | User's email address |

---

### 5. Get Audit Log

**Endpoint:** `GET /api/extract/audit-log`

Retrieve security audit log for email extraction (compliance and monitoring).

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 50 | Max records to return (max 100) |

#### Response (Success)

```json
{
  "success": true,
  "records": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "550e8400-e29b-41d4-a716-446655440001",
      "action": "otp_verified",
      "status": "success",
      "ip_address": "192.0.2.1",
      "timestamp": "2024-01-15T10:30:00Z",
      "error_message": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "user_id": "550e8400-e29b-41d4-a716-446655440001",
      "action": "otp_verified",
      "status": "failed",
      "ip_address": "192.0.2.2",
      "timestamp": "2024-01-15T10:25:00Z",
      "error_message": "Invalid code. 4 attempts remaining."
    }
  ]
}
```

#### Action Types

| Action | Description |
|--------|-------------|
| otp_requested | User requested OTP |
| otp_verified | User submitted OTP verification |
| link_sent | Verification link generated and sent |
| link_verified | User verified email token |
| enabled | Extraction successfully enabled |

#### Audit Log Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Log entry ID |
| user_id | UUID | User ID |
| action | string | Action type |
| status | string | success or failed |
| ip_address | INET | Client IP address |
| timestamp | ISO8601 | When action occurred |
| error_message | string | Error details if failed |

#### Security Notes

- IP addresses are stored for security monitoring
- IP addresses are automatically deleted after 90 days (GDPR compliance)
- Audit log is retained for 1 year for compliance
- Only authenticated users can view their own logs

---

## Authentication

All endpoints require authentication using bearer tokens in the `Authorization` header:

```
Authorization: Bearer <token>
```

If authentication fails:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

## Flow Diagram

```
User Flow:
  1. Request OTP → Backend sends OTP to email
  2. User enters OTP → Backend verifies code
  3. User clicks email link → Backend verifies token
  4. Extraction enabled → User can now use extraction features
  
Security:
  - OTP: 15-min expiry, 5-attempt lockout, 1-per-minute rate limit
  - Token: 24-hour expiry, one-time use
  - Audit: All actions logged with IP and timestamp
  - GDPR: IP deleted after 90 days, logs after 1 year
```

---

## Error Handling

### Common Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "key": "additional context"
    }
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (invalid input, expired token, etc.) |
| 401 | Unauthorized (authentication required) |
| 429 | Too many requests (rate limited or account locked) |
| 500 | Server error |

---

## Rate Limiting

- **OTP Requests:** 1 per minute per user
- **OTP Verification Attempts:** 5 attempts, then 15-minute lockout
- **Token Verification:** No limit (but token is one-time use)

---

## Security Best Practices

1. **Always use HTTPS** to prevent man-in-the-middle attacks
2. **Send OTP via email** (not SMS) for better security
3. **Never expose tokens in URLs** when possible
4. **Rotate credentials** regularly
5. **Monitor audit logs** for suspicious activity
6. **Implement IP whitelisting** for admin endpoints

---

## Testing

### Development Mode

For testing, OTP codes are returned in the response:

```bash
curl -X POST http://localhost:3000/api/extract/request-otp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

Response will include `"code": "123456"`

**Note:** Remove this in production.

### Example cURL Commands

```bash
# Request OTP
curl -X POST http://localhost:3000/api/extract/request-otp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Verify OTP
curl -X POST http://localhost:3000/api/extract/verify-otp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'

# Verify Email Token
curl -X POST http://localhost:3000/api/extract/verify-email \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"token": "a1b2c3d4..."}'

# Get Status
curl -X GET http://localhost:3000/api/extract/status \
  -H "Authorization: Bearer <token>"

# Get Audit Log
curl -X GET http://localhost:3000/api/extract/audit-log?limit=10 \
  -H "Authorization: Bearer <token>"
```

---

## Migration Guide

To integrate this API into your application:

1. **Run database migration:** `010_email_extraction_tables.sql`
2. **Install backend service:** `emailExtractionService.js`
3. **Register routes:** Add `emailExtractionRoutes.js` to Express app
4. **Install frontend component:** `EmailExtractionVerification.jsx`
5. **Import styles:** `emailExtractionVerification.css`
6. **Use from frontend:** Import and call functions from `emailExtraction.js`

---

## Support

For issues or questions:
- Check audit logs for detailed error information
- Review error codes and messages in this documentation
- Contact support with user ID and timestamps from audit logs
