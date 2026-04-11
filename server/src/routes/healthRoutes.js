const express = require("express");
const { env } = require("../config/env");

const healthRoutes = express.Router();
const startTime = Date.now();

healthRoutes.get("/", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: env.ENVIRONMENT || "development",
  });
});

healthRoutes.get("/ready", async (req, res) => {
  const checks = {};
  let healthy = true;

  try {
    const { createClient } = require("@supabase/supabase-js");
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await supabase.from("app_users").select("id").limit(1);
      checks.database = error ? "degraded" : "ok";
      if (error) healthy = false;
    } else {
      checks.database = "not_configured";
    }
  } catch (err) {
    checks.database = "error";
    healthy = false;
  }

  checks.smtp = env.SMTP_HOST ? "configured" : "not_configured";
  checks.stripe = env.STRIPE_SECRET_KEY ? "configured" : "not_configured";
  checks.gemini = env.GEMINI_API_KEY ? "configured" : "not_configured";

  const status = healthy ? 200 : 503;
  res.status(status).json({
    status: healthy ? "ready" : "degraded",
    checks,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

module.exports = { healthRoutes };
