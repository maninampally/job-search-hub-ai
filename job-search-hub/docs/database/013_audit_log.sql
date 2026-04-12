-- Migration 013: audit_log table
-- Immutable record of all sensitive actions in the system.
-- Rows are never updated or deleted (append-only).
-- Retention enforced via scheduled cleanup job (AUDIT_LOG_RETENTION_DAYS env var).

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  admin_id UUID,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing audit events by user (admin UI)
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON audit_log (user_id)
  WHERE user_id IS NOT NULL;

-- Index for listing events by admin who performed them
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id
  ON audit_log (admin_id)
  WHERE admin_id IS NOT NULL;

-- Index for time-based pagination and cleanup
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log (created_at DESC);

-- Index for action-type filtering (e.g. filter all 'login' events)
CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON audit_log (action);
