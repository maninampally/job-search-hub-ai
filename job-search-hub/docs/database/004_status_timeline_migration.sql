-- Migration 004: job_status_timeline table
-- Run in Supabase SQL Editor before deploying updated backend.

CREATE TABLE IF NOT EXISTS job_status_timeline (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  from_status  TEXT,
  to_status    TEXT        NOT NULL,
  trigger      TEXT        NOT NULL DEFAULT 'manual',  -- 'manual' or 'email_sync'
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_job_id ON job_status_timeline (job_id);

-- ROLLBACK:
-- DROP TABLE IF EXISTS job_status_timeline;
