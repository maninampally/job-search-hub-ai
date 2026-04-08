-- Migration 012: mfa_config table
-- Stores TOTP secrets and backup codes per user.
-- totp_secret is stored encrypted at rest (application-level AES-256-GCM).
-- backup_codes is a JSONB array of hashed backup codes (shown once at enrollment).

CREATE TABLE IF NOT EXISTS mfa_config (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  totp_secret TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  backup_codes JSONB,
  enrolled_at TIMESTAMPTZ
);

-- Index for fast MFA lookup by user (used during login MFA challenge)
CREATE INDEX IF NOT EXISTS idx_mfa_config_user_id
  ON mfa_config (user_id)
  WHERE totp_enabled = TRUE;
