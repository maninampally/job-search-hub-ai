-- Migration 007: user-level ownership isolation
-- Run in Supabase SQL Editor before restarting backend.

-- Add owner column to all user-scoped tables.
ALTER TABLE IF EXISTS jobs ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE IF EXISTS job_status_timeline ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE IF EXISTS job_emails ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE IF EXISTS resumes ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE IF EXISTS contacts ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE IF EXISTS reminders ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE IF EXISTS outreach ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE IF EXISTS processed_emails ADD COLUMN IF NOT EXISTS owner_user_id UUID;

-- Indexes for owner-based filtering.
CREATE INDEX IF NOT EXISTS idx_jobs_owner_user_id ON jobs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_job_status_timeline_owner_user_id ON job_status_timeline(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_job_emails_owner_user_id ON job_emails(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_owner_user_id ON resumes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_user_id ON contacts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_owner_user_id ON reminders(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_owner_user_id ON outreach(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_processed_emails_owner_user_id ON processed_emails(owner_user_id);

-- job_emails: make Gmail dedupe user-specific.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_emails_gmail_id_key'
  ) THEN
    ALTER TABLE job_emails DROP CONSTRAINT job_emails_gmail_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_job_emails_owner_gmail
  ON job_emails(owner_user_id, gmail_id)
  WHERE gmail_id IS NOT NULL;

-- processed_emails: make processed tracking user-specific.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'processed_emails_pkey'
  ) THEN
    ALTER TABLE processed_emails DROP CONSTRAINT processed_emails_pkey;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_processed_emails_owner_gmail
  ON processed_emails(owner_user_id, gmail_id);

-- Optional FK links (safe because columns are nullable).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_owner_user_id_fkey'
      AND table_name = 'jobs'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'resumes_owner_user_id_fkey'
      AND table_name = 'resumes'
  ) THEN
    ALTER TABLE resumes
      ADD CONSTRAINT resumes_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'contacts_owner_user_id_fkey'
      AND table_name = 'contacts'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'reminders_owner_user_id_fkey'
      AND table_name = 'reminders'
  ) THEN
    ALTER TABLE reminders
      ADD CONSTRAINT reminders_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'outreach_owner_user_id_fkey'
      AND table_name = 'outreach'
  ) THEN
    ALTER TABLE outreach
      ADD CONSTRAINT outreach_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'job_status_timeline_owner_user_id_fkey'
      AND table_name = 'job_status_timeline'
  ) THEN
    ALTER TABLE job_status_timeline
      ADD CONSTRAINT job_status_timeline_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'job_emails_owner_user_id_fkey'
      AND table_name = 'job_emails'
  ) THEN
    ALTER TABLE job_emails
      ADD CONSTRAINT job_emails_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'processed_emails_owner_user_id_fkey'
      AND table_name = 'processed_emails'
  ) THEN
    ALTER TABLE processed_emails
      ADD CONSTRAINT processed_emails_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END $$;
