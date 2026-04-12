-- Job Search Hub persistence schema (Supabase/Postgres)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT PRIMARY KEY,
  email_id        TEXT UNIQUE,
  company         TEXT,
  role            TEXT,
  status          TEXT DEFAULT 'Applied',
  location        TEXT,
  recruiter_name  TEXT,
  recruiter_email TEXT,
  applied_date    DATE,
  notes           TEXT,
  next_step       TEXT,
  imported        BOOLEAN DEFAULT FALSE,
  source          TEXT DEFAULT 'gmail',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- DEPRECATED: Old single-row design (id=1) has been replaced with per-user storage
-- See migrations 009_oauth_tokens_per_user.sql for new table structure
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id                      TEXT PRIMARY KEY,
  -- Format: 'oauth_{user_id}' ensures one row per user
  owner_user_id           UUID UNIQUE NOT NULL,
  access_token            TEXT NOT NULL,
  refresh_token           TEXT,
  expires_at              TIMESTAMPTZ,
  verified_email_address  TEXT NOT NULL,
  -- Gmail email verified to match app account email during OAuth
  verified_at             TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS processed_emails (
  gmail_id       TEXT PRIMARY KEY,
  processed_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                           TEXT NOT NULL UNIQUE,
  password_hash                   TEXT NOT NULL,
  name                            TEXT NOT NULL DEFAULT 'User',
  headline                        TEXT NOT NULL DEFAULT '',
  location                        TEXT NOT NULL DEFAULT '',
  bio                             TEXT NOT NULL DEFAULT '',
  last_login_at                   TIMESTAMPTZ,
  -- Email verification fields (added in migration 008)
  email_verified_at               TIMESTAMPTZ,
  -- Timestamp when user clicked verification link
  email_verification_token_hash   TEXT,
  -- SHA256 hash of one-time verification token
  email_verification_sent_at      TIMESTAMPTZ,
  -- Timestamp when verification email was sent (for 24h expiry)
  email_verification_attempts     INT DEFAULT 0,
  -- Counter for rate limiting verification requests (max 3/hour)
  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);
