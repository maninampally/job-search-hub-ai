-- AI usage tracking per user per day
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL, -- 'cover_letter', 'interview_coach', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage(feature);
