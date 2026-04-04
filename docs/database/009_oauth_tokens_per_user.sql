-- Migration 009: Redesign oauth_tokens for Per-User Token Storage
-- Purpose: Fix multi-user token collision issue by storing one token per user
-- Changes: 
--   - Drop old single-row design (id=1, only one token for all users)
--   - Create new table with unique constraint on owner_user_id
--   - Add verified_email_address to track which Gmail account was authorized

-- BACKUP step: If you need to preserve old tokens, export first:
-- SELECT * FROM oauth_tokens;

DROP TABLE IF EXISTS oauth_tokens CASCADE;

-- New per-user token storage design
CREATE TABLE oauth_tokens (
  id TEXT PRIMARY KEY,  
  -- Format: 'oauth_{user_id}' ensures one row per user
  
  owner_user_id UUID UNIQUE NOT NULL,  
  -- UNIQUE constraint: Only ONE token per user, no sharing
  -- User deletion cascades to remove their token
  
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  
  verified_email_address TEXT NOT NULL,
  -- The Gmail email address that was matched during OAuth
  -- Used to verify Gmail/app email account match
  
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_oauth_tokens_owner_user_id 
    FOREIGN KEY (owner_user_id) 
    REFERENCES app_users(id) 
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Index for queries filtering by owner_user_id
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_owner_user_id 
  ON oauth_tokens(owner_user_id);

-- Index for lookups by verified email address (optional, for auditing)
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_verified_email_address 
  ON oauth_tokens(verified_email_address);

-- Comments for documentation
COMMENT ON TABLE oauth_tokens IS 'OAuth tokens per user - one row per user with cascade delete on user removal';
COMMENT ON COLUMN oauth_tokens.id IS 'Primary key: oauth_{user_id}';
COMMENT ON COLUMN oauth_tokens.owner_user_id IS 'User who owns this token (UNIQUE - one per user)';
COMMENT ON COLUMN oauth_tokens.access_token IS 'Current OAuth access token from Google';
COMMENT ON COLUMN oauth_tokens.refresh_token IS 'Refresh token for obtaining new access tokens';
COMMENT ON COLUMN oauth_tokens.expires_at IS 'Access token expiry timestamp';
COMMENT ON COLUMN oauth_tokens.verified_email_address IS 'Gmail email verified to match app account email during OAuth';
COMMENT ON COLUMN oauth_tokens.verified_at IS 'When this token was verified as matching the app email';
