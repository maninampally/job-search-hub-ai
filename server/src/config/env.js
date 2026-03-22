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
};

module.exports = { env };
