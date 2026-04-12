/**
 * Startup environment validator.
 * Call once at boot before anything else touches env vars.
 * Production: throws on missing required vars.
 * Development: warns and continues.
 */

const REQUIRED = [
  { key: "GOOGLE_CLIENT_ID",          desc: "Google OAuth client ID" },
  { key: "GOOGLE_CLIENT_SECRET",      desc: "Google OAuth client secret" },
  { key: "REDIRECT_URI",              desc: "OAuth callback URI" },
  { key: "GEMINI_API_KEY",            desc: "Google Gemini API key" },
  { key: "AUTH_TOKEN_SECRET",         desc: "JWT signing secret (min 32 chars)" },
  { key: "SESSION_SECRET",            desc: "Express session secret (min 32 chars)" },
];

const PRODUCTION_REQUIRED = [
  { key: "SUPABASE_URL",              desc: "Supabase project URL" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", desc: "Supabase service role key" },
  { key: "TOKEN_ENCRYPTION_KEY",      desc: "AES-256 key for OAuth token encryption (min 32 chars)" },
  { key: "FRONTEND_URL",             desc: "Frontend origin for CORS + OAuth redirects" },
  { key: "SMTP_HOST",                desc: "SMTP host for email sending" },
  { key: "SMTP_USER",                desc: "SMTP user" },
  { key: "SMTP_PASS",                desc: "SMTP password" },
];

const MIN_LENGTH = [
  { key: "AUTH_TOKEN_SECRET",    min: 32 },
  { key: "SESSION_SECRET",       min: 32 },
  { key: "TOKEN_ENCRYPTION_KEY", min: 32 },
];

function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const errors = [];

  const required = isProd ? [...REQUIRED, ...PRODUCTION_REQUIRED] : REQUIRED;

  for (const { key, desc } of required) {
    if (!String(process.env[key] || "").trim()) {
      errors.push(`${key} - ${desc}`);
    }
  }

  for (const { key, min } of MIN_LENGTH) {
    const val = String(process.env[key] || "").trim();
    if (val && val.length < min) {
      errors.push(`${key} is too short (${val.length} chars, need ${min})`);
    }
  }

  if (errors.length > 0) {
    const list = errors.map((e) => `  - ${e}`).join("\n");
    if (isProd) {
      throw new Error(`[validateEnv] Startup aborted - fix before deploying:\n${list}`);
    }
    console.warn(`[validateEnv] Missing/invalid env vars (dev mode, continuing):\n${list}`);
  }
}

module.exports = { validateEnv };
