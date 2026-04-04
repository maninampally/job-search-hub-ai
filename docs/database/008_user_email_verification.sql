-- Migration 008: Add Email Verification Fields to app_users
-- Purpose: Support email verification workflow to gate Gmail OAuth connection
-- Changes: Add verification tracking columns and index for token lookup

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMP;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verification_attempts INT DEFAULT 0;

-- Index for fast token lookup during verification confirmation
CREATE INDEX IF NOT EXISTS idx_app_users_email_verification_token_hash 
  ON app_users(email_verification_token_hash) 
  WHERE email_verification_token_hash IS NOT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN app_users.email_verified_at IS 'Timestamp when user verified their email address via link';
COMMENT ON COLUMN app_users.email_verification_token_hash IS 'SHA256 hash of verification token (one-time use)';
COMMENT ON COLUMN app_users.email_verification_sent_at IS 'Timestamp when verification email was sent (for expiry check)';
COMMENT ON COLUMN app_users.email_verification_attempts IS 'Count of verification email requests (for rate limiting)';
