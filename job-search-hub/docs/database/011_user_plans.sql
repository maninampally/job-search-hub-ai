-- Migration 011: user_plans table
-- Tracks billing tier, Stripe IDs, and plan expiry per user.
-- Role is also mirrored on app_users but user_plans is the source of truth for billing.

CREATE TABLE IF NOT EXISTS user_plans (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_expires TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for Stripe customer ID lookups (used in webhook handler)
CREATE INDEX IF NOT EXISTS idx_user_plans_stripe_customer_id
  ON user_plans (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Index for Stripe subscription ID lookups (used in webhook handler)
CREATE INDEX IF NOT EXISTS idx_user_plans_stripe_subscription_id
  ON user_plans (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
