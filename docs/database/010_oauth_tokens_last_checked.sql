-- Per-user Gmail sync cursor (replaces legacy oauth_tokens id=1 last_checked)
ALTER TABLE oauth_tokens
  ADD COLUMN IF NOT EXISTS last_checked TIMESTAMPTZ;

COMMENT ON COLUMN oauth_tokens.last_checked IS 'ISO timestamp of last successful job email sync for this user; drives incremental Gmail search (after:date)';
