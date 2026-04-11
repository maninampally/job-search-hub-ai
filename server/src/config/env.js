const env = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI: process.env.REDIRECT_URI,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  /** Hours to skip Gemini after quota or key errors (rule-based extraction only). */
  GEMINI_COOLDOWN_HOURS: Number(process.env.GEMINI_COOLDOWN_HOURS || 6),
  /** Hours to skip OpenAI after quota errors to avoid repeated 429s. */
  OPENAI_COOLDOWN_HOURS: Number(process.env.OPENAI_COOLDOWN_HOURS || 6),
  // Multi-LLM Provider Configuration for Pro & Elite tiers
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  /** Claude model id for job extraction (Elite/admin primary; optional Pro initial when enabled). */
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  LLM_ENABLE_MULTI_PROVIDER: String(process.env.LLM_ENABLE_MULTI_PROVIDER || "true").toLowerCase() === "true",
  LLM_PRO_PROVIDER: process.env.LLM_PRO_PROVIDER || "gemini-2.5-flash-lite",
  LLM_ELITE_PROVIDER: process.env.LLM_ELITE_PROVIDER || "claude-3-5-sonnet",
  LLM_FALLBACK_PROVIDER: process.env.LLM_FALLBACK_PROVIDER || "gemini-2.5-flash-lite",
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
  /** Gmail search newer_than:Nd for first connect and manual “full window” sync (default ~1 month). */
  INITIAL_SYNC_LOOKBACK_DAYS: Number(process.env.INITIAL_SYNC_LOOKBACK_DAYS || 30),
  DAILY_SYNC_LOOKBACK_DAYS: Number(process.env.DAILY_SYNC_LOOKBACK_DAYS || 1),
  /** See getGmailSyncQueryBase() for GMAIL_SYNC_QUERY / GMAIL_SYNC_QUERY_DEFAULT. */
  GMAIL_SYNC_MAX_RESULTS_PER_PAGE: Number(process.env.GMAIL_SYNC_MAX_RESULTS_PER_PAGE || 100),
  INITIAL_SYNC_MAX_MESSAGES: Number(process.env.INITIAL_SYNC_MAX_MESSAGES || 1000),
  INCREMENTAL_SYNC_MAX_MESSAGES: Number(process.env.INCREMENTAL_SYNC_MAX_MESSAGES || 500),
  // Default 9:00 PM server local time daily; set SYNC_CRON_TIMEZONE (e.g. America/New_York) for a fixed zone
  SYNC_CRON: process.env.SYNC_CRON || "0 21 * * *",
  SYNC_CRON_TIMEZONE: String(process.env.SYNC_CRON_TIMEZONE || "").trim(),
  SYNC_PROCESSING_CONCURRENCY: Number(process.env.SYNC_PROCESSING_CONCURRENCY || 4),
  /** Pause between Gmail messages during sync (ms). Lower = faster, higher = gentler on APIs. */
  SYNC_INTER_MESSAGE_DELAY_MS: Number(process.env.SYNC_INTER_MESSAGE_DELAY_MS || 0),
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
  AUTH_TOKEN_SECRET: process.env.AUTH_TOKEN_SECRET || "dev-local-auth-secret-change-me",
  AUTH_TOKEN_TTL_HOURS: Number(process.env.AUTH_TOKEN_TTL_HOURS || 24),
  SESSION_SECRET: process.env.SESSION_SECRET || "dev-session-secret-change-me",
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || "",
  /** @deprecated use tier-specific limits below */
  RATE_LIMIT_SYNC_PER_HOUR: Number(process.env.RATE_LIMIT_SYNC_PER_HOUR || 3),
  RATE_LIMIT_SYNC_FREE: Number(process.env.RATE_LIMIT_SYNC_FREE || 3),
  RATE_LIMIT_SYNC_PRO: Number(process.env.RATE_LIMIT_SYNC_PRO || 12),
  RATE_LIMIT_SYNC_ELITE: Number(process.env.RATE_LIMIT_SYNC_ELITE || 30),
  RATE_LIMIT_SYNC_ADMIN: Number(process.env.RATE_LIMIT_SYNC_ADMIN || 60),
  AUDIT_LOG_ENABLED: String(process.env.AUDIT_LOG_ENABLED || "true").toLowerCase() !== "false",
  AUDIT_LOG_RETENTION_DAYS: Number(process.env.AUDIT_LOG_RETENTION_DAYS || 90),
  ENVIRONMENT: process.env.NODE_ENV || "development",
  // Email/SMTP Configuration
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || "noreply@jobsearchhub.local",
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || "Job Search Hub",
  SMTP_SECURE: String(process.env.SMTP_SECURE || "true").toLowerCase() === "true",
  OTP_SEND_MODE: process.env.OTP_SEND_MODE || "email", // "email" or "console" for dev
  // Admin IP allowlist (comma-separated IPs). Empty string means allow all IPs.
  ADMIN_IP_ALLOWLIST: process.env.ADMIN_IP_ALLOWLIST || "",
  // Stripe billing keys
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || "",
  STRIPE_PRICE_ELITE: process.env.STRIPE_PRICE_ELITE || "",
  // Free tier may use Gmail sync when not production (local Docker). In production set to "true" to allow, or omit to require Pro.
  // Getter so tests and runtime env changes see current process.env (avoid stale snapshot from first module load).
  get ALLOW_FREE_TIER_GMAIL_SYNC() {
    return process.env.NODE_ENV === "production"
      ? String(process.env.ALLOW_FREE_TIER_GMAIL_SYNC || "").toLowerCase() === "true"
      : String(process.env.ALLOW_FREE_TIER_GMAIL_SYNC || "").toLowerCase() !== "false";
  },
  /**
   * When true, free tier may use the same OpenAI/Gemini extraction path as Pro (if keys exist).
   * Production: set ALLOW_FREE_TIER_AI_EXTRACTION=true explicitly. Non-production: defaults on unless "false".
   */
  get ALLOW_FREE_TIER_AI_EXTRACTION() {
    return process.env.NODE_ENV === "production"
      ? String(process.env.ALLOW_FREE_TIER_AI_EXTRACTION || "").toLowerCase() === "true"
      : String(process.env.ALLOW_FREE_TIER_AI_EXTRACTION || "").toLowerCase() !== "false";
  },
  /**
   * Pro tier: set to "true" to use Claude (initial sync only) when ANTHROPIC_API_KEY is set.
   * Elite/admin use Claude for extraction when the key exists unless set to "false".
   */
  get USE_SONNET_FOR_INITIAL_SYNC() {
    return String(process.env.USE_SONNET_FOR_INITIAL_SYNC || "").toLowerCase();
  },
};

/** Base Gmail search string (before date clauses). Not stored on `env` object so edits to process.env are visible. */
function getGmailSyncQueryBase() {
  const custom = String(process.env.GMAIL_SYNC_QUERY || "").trim();
  if (custom) {
    return custom;
  }
  const fromEnv = String(process.env.GMAIL_SYNC_QUERY_DEFAULT || "").trim();
  if (fromEnv) {
    return fromEnv;
  }
  return [
    "subject:(application OR applied OR interview OR offer OR rejected OR job OR position OR role OR hiring OR recruiter OR confirmation OR update OR status)",
    '"thank you for applying"',
    '"your application"',
    '"application received"',
  ].join(" OR ");
}

const requiredEnvironmentVariables = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "REDIRECT_URI",
  "GEMINI_API_KEY",
];

// Multi-LLM provider keys are optional (only required if using specific providers in production)
const optionalLlmKeys = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"];

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

module.exports = { env, getGmailSyncQueryBase };


