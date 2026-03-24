const env = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI: process.env.REDIRECT_URI,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  PORT: Number(process.env.PORT || 3001),
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  EXTERNAL_API_TIMEOUT_MS: Number(process.env.EXTERNAL_API_TIMEOUT_MS || 12000),
  RETRY_ATTEMPTS: Number(process.env.RETRY_ATTEMPTS || 2),
  INITIAL_SYNC_LOOKBACK_DAYS: Number(process.env.INITIAL_SYNC_LOOKBACK_DAYS || 180),
  DAILY_SYNC_LOOKBACK_DAYS: Number(process.env.DAILY_SYNC_LOOKBACK_DAYS || 1),
  GMAIL_SYNC_MAX_RESULTS_PER_PAGE: Number(process.env.GMAIL_SYNC_MAX_RESULTS_PER_PAGE || 100),
  INITIAL_SYNC_MAX_MESSAGES: Number(process.env.INITIAL_SYNC_MAX_MESSAGES || 1000),
  SYNC_CRON: process.env.SYNC_CRON || "0 9 * * *",
  SYNC_PROCESSING_CONCURRENCY: Number(process.env.SYNC_PROCESSING_CONCURRENCY || 3),
  MCP_AUTH_TOKEN: process.env.MCP_AUTH_TOKEN || "",
  MCP_AUDIT_LOG_ENABLED: String(process.env.MCP_AUDIT_LOG_ENABLED || "true").toLowerCase() !== "false",
  MCP_ALLOWED_TOOLS: (process.env.MCP_ALLOWED_TOOLS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  MCP_RATE_LIMIT_WINDOW_MS: Number(process.env.MCP_RATE_LIMIT_WINDOW_MS || 60000),
  MCP_RATE_LIMIT_MAX_REQUESTS: Number(process.env.MCP_RATE_LIMIT_MAX_REQUESTS || 120),
  NOTIFY_EMAIL_WEBHOOK_URL: process.env.NOTIFY_EMAIL_WEBHOOK_URL || "",
  NOTIFY_SLACK_WEBHOOK_URL: process.env.NOTIFY_SLACK_WEBHOOK_URL || "",
  NOTIFY_WHATSAPP_WEBHOOK_URL: process.env.NOTIFY_WHATSAPP_WEBHOOK_URL || "",
};

const requiredEnvironmentVariables = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "REDIRECT_URI",
  "ANTHROPIC_API_KEY",
];

const missingVariables = requiredEnvironmentVariables.filter(
  (name) => !String(process.env[name] || "").trim()
);

const shouldEnforceRequiredEnv = process.env.NODE_ENV === "production";

if (missingVariables.length > 0 && shouldEnforceRequiredEnv) {
  throw new Error(`Missing required environment variables: ${missingVariables.join(", ")}`);
}

if (missingVariables.length > 0 && !shouldEnforceRequiredEnv) {
  console.warn(`[env] missing optional development variables: ${missingVariables.join(", ")}`);
}

module.exports = { env };
