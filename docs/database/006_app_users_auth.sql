-- Migration 006: app_users table for application login/profile auth
-- Run in Supabase SQL Editor before using /auth/register and /auth/login in production.

-- Ensure UUID generation is available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  name          TEXT        NOT NULL DEFAULT 'User',
  headline      TEXT        NOT NULL DEFAULT '',
  location      TEXT        NOT NULL DEFAULT '',
  bio           TEXT        NOT NULL DEFAULT '',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);

CREATE OR REPLACE FUNCTION update_app_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_users_update_timestamp ON app_users;
CREATE TRIGGER app_users_update_timestamp
BEFORE UPDATE ON app_users
FOR EACH ROW
EXECUTE FUNCTION update_app_users_timestamp();

-- Optional backfill guard for existing rows that might have empty names
UPDATE app_users SET name = 'User' WHERE COALESCE(TRIM(name), '') = '';

-- ROLLBACK:
-- DROP TRIGGER IF EXISTS app_users_update_timestamp ON app_users;
-- DROP FUNCTION IF EXISTS update_app_users_timestamp();
-- DROP TABLE IF EXISTS app_users;
