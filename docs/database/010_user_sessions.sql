-- Migration 010: user_sessions table
-- Stores refresh token hashes and device info for session management.
-- The actual refresh token is never stored - only a SHA-256 hex hash.

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast token hash lookups (used on every refresh)
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON user_sessions (token_hash);

-- Index for listing all sessions by user (sessions management UI)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON user_sessions (user_id);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
  ON user_sessions (expires_at);
