-- Migration 002: job_emails table
-- Run in Supabase SQL Editor before deploying updated backend.

CREATE TABLE IF NOT EXISTS job_emails (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  gmail_id     TEXT        UNIQUE,
  subject      TEXT,
  sender       TEXT,
  sender_name  TEXT,
  body_text    TEXT,
  preview      TEXT,
  received_at  TIMESTAMPTZ,
  email_type   TEXT,
  is_real      BOOLEAN     DEFAULT TRUE,
  is_read      BOOLEAN     DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_emails_job_id  ON job_emails (job_id);
CREATE INDEX IF NOT EXISTS idx_job_emails_gmail_id ON job_emails (gmail_id);

-- ROLLBACK:
-- DROP TABLE IF EXISTS job_emails;
