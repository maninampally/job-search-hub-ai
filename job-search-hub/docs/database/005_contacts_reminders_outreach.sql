-- Migration 005: contacts, reminders, outreach tables
-- Run in Supabase SQL Editor before deploying updated backend.

-- CONTACTS table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  role TEXT,
  linkedin_url TEXT,
  notes TEXT,
  source TEXT DEFAULT 'manual',  -- 'manual' or 'auto_sync'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- REMINDERS table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_date DATE,
  is_done BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- OUTREACH table
CREATE TABLE IF NOT EXISTS outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  type TEXT,  -- 'email', 'linkedin', 'call', 'other'
  message TEXT,
  sent_at TIMESTAMPTZ,
  response_received BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_reminders_job_id ON reminders(job_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_is_done ON reminders(is_done);
CREATE INDEX IF NOT EXISTS idx_outreach_contact_id ON outreach(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_job_id ON outreach(job_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sent_at ON outreach(sent_at);

-- Create triggers for auto-update timestamps
CREATE OR REPLACE FUNCTION update_contacts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_reminders_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_outreach_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_update_timestamp ON contacts;
CREATE TRIGGER contacts_update_timestamp
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_contacts_timestamp();

DROP TRIGGER IF EXISTS reminders_update_timestamp ON reminders;
CREATE TRIGGER reminders_update_timestamp
BEFORE UPDATE ON reminders
FOR EACH ROW
EXECUTE FUNCTION update_reminders_timestamp();

DROP TRIGGER IF EXISTS outreach_update_timestamp ON outreach;
CREATE TRIGGER outreach_update_timestamp
BEFORE UPDATE ON outreach
FOR EACH ROW
EXECUTE FUNCTION update_outreach_timestamp();

-- ROLLBACK:
-- DROP TABLE IF EXISTS outreach;
-- DROP TABLE IF EXISTS reminders;
-- DROP TABLE IF EXISTS contacts;
-- DROP FUNCTION IF EXISTS update_contacts_timestamp();
-- DROP FUNCTION IF EXISTS update_reminders_timestamp();
-- DROP FUNCTION IF EXISTS update_outreach_timestamp();
