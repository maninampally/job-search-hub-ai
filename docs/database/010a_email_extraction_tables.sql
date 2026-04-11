-- Migration 010: Email Data Extraction — Consent Verification Tables
-- Adds OTP and email verification link support for extraction authorization

-- Add columns to app_users table
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT false;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_extraction_enabled BOOLEAN DEFAULT false;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS extraction_verified_at TIMESTAMPTZ;

-- OTP Verifications table — 6-digit codes for consent confirmation
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  attempts INT DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT code_not_null CHECK (code IS NOT NULL),
  CONSTRAINT expires_at_not_null CHECK (expires_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_user_id ON otp_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_code ON otp_verifications(code) WHERE used = false;

COMMENT ON TABLE otp_verifications IS 'One-time passwords for extraction consent — 6-digit codes with 15-min expiry';
COMMENT ON COLUMN otp_verifications.code IS '6-character alphanumeric OTP code';
COMMENT ON COLUMN otp_verifications.expires_at IS 'Code expires 15 minutes after creation';
COMMENT ON COLUMN otp_verifications.used IS 'true after successful verification (one-time use)';
COMMENT ON COLUMN otp_verifications.attempts IS 'Wrong attempt counter (blocks after 5 attempts)';
COMMENT ON COLUMN otp_verifications.blocked_until IS 'Timestamp until which user is blocked from submitting codes (15min lockout)';

-- Email Verification Tokens table — UUID tokens for extraction link verification
CREATE TABLE IF NOT EXISTS email_verify_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT token_not_null CHECK (token IS NOT NULL),
  CONSTRAINT expires_at_not_null CHECK (expires_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_email_verify_tokens_token ON email_verify_tokens(token) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_email_verify_tokens_user_id ON email_verify_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verify_tokens_expires_at ON email_verify_tokens(expires_at);

COMMENT ON TABLE email_verify_tokens IS 'UUID tokens for extraction link verification — 24-hr expiry';
COMMENT ON COLUMN email_verify_tokens.token IS 'UUID token (unique) — sent in verification email link';
COMMENT ON COLUMN email_verify_tokens.expires_at IS 'Token expires 24 hours after creation';
COMMENT ON COLUMN email_verify_tokens.used IS 'true after successful verification (one-time use)';

-- Extraction Audit Log table — Security & compliance logging
CREATE TABLE IF NOT EXISTS extraction_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  action VARCHAR(50) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT action_not_null CHECK (action IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_extraction_audit_log_user_id ON extraction_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_audit_log_timestamp ON extraction_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_extraction_audit_log_action ON extraction_audit_log(action);

COMMENT ON TABLE extraction_audit_log IS 'Security audit log for extraction activation steps — for GDPR/CCPA compliance';
COMMENT ON COLUMN extraction_audit_log.action IS 'Action type: otp_requested, otp_verified, link_sent, link_verified, enabled';
COMMENT ON COLUMN extraction_audit_log.status IS 'success or failed';
COMMENT ON COLUMN extraction_audit_log.error_message IS 'Error details if status = failed';
COMMENT ON COLUMN extraction_audit_log.ip_address IS 'User IP address (deleted after 90 days for privacy)';
COMMENT ON COLUMN extraction_audit_log.user_agent IS 'Browser/device user agent for device fingerprinting';

-- Cleanup trigger: Delete OTP verifications older than 1 day (prevent table bloat)
-- Run this as a scheduled job hourly in production, or create a trigger
-- DELETE FROM otp_verifications WHERE expires_at < now() AND used = true;

-- Cleanup for audit logs: Delete after 90 days (GDPR compliance)
-- DELETE FROM extraction_audit_log WHERE timestamp < now() - interval '90 days';
