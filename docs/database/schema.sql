-- Job Search Hub persistence schema (Supabase/Postgres)

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

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id             INT PRIMARY KEY,
  access_token   TEXT,
  refresh_token  TEXT,
  scope          TEXT,
  token_type     TEXT,
  expiry_date    BIGINT,
  last_checked   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_emails (
  gmail_id       TEXT PRIMARY KEY,
  processed_at   TIMESTAMPTZ DEFAULT NOW()
);
