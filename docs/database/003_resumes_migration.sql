-- Migration 003: resumes table
-- Run in Supabase SQL Editor before deploying updated backend.

CREATE TABLE IF NOT EXISTS resumes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        TEXT        REFERENCES jobs(id) ON DELETE SET NULL,
  file_name     TEXT        NOT NULL,
  original_name TEXT        NOT NULL,
  file_path     TEXT        NOT NULL,
  file_size     INTEGER,
  mime_type     TEXT,
  is_primary    BOOLEAN     NOT NULL DEFAULT FALSE,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_job_id ON resumes (job_id);

-- At most one primary resume per job
CREATE UNIQUE INDEX IF NOT EXISTS uidx_resumes_primary_per_job
  ON resumes (job_id)
  WHERE is_primary = TRUE;

-- ROLLBACK:
-- DROP TABLE IF EXISTS resumes;
