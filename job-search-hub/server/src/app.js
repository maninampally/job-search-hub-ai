const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { env } = require("./config/env");

const { authRoutes } = require("./routes/authRoutes");
const { jobRoutes } = require("./routes/jobRoutes");
const { healthRoutes } = require("./routes/healthRoutes");
const { templateRoutes } = require("./routes/templateRoutes");
const { resumeRoutes } = require("./routes/resumeRoutes");
const { contactRoutes } = require("./routes/contactRoutes");
const { reminderRoutes } = require("./routes/reminderRoutes");
const { outreachRoutes } = require("./routes/outreachRoutes");
const { mcpRoutes } = require("./routes/mcpRoutes");
const { emailExtractionRoutes } = require("./routes/emailExtractionRoutes");
const { aiRoutes } = require("./routes/aiRoutes");
const { adminRoutes } = require("./routes/adminRoutes");
const { billingRoutes, billingWebhookRouter } = require("./routes/billingRoutes");
const { notificationRoutes } = require("./routes/notificationRoutes");
const { requireUserAuth } = require("./middleware/requireUserAuth");
const { requireAdmin } = require("./middleware/requireAdmin");
const { logger } = require("./utils/logger");
const { validateLlmConfiguration } = require("./services/llmSelector");

function createApp() {
  const app = express();
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.length
    ? env.CORS_ALLOWED_ORIGINS
    : [env.FRONTEND_URL].filter(Boolean);

  // Stripe webhook needs raw body - mount BEFORE express.json()
  app.use("/billing/webhook", express.raw({ type: "application/json" }), billingWebhookRouter);

  app.use(helmet());
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        // Specific localhost ports allowed in development (Vite uses 5173, Next.js uses 3000)
        const allowedDevPorts = [3000, 5173];
        const isLocalDevOrigin =
          process.env.NODE_ENV !== "production" &&
          typeof origin === "string" &&
          allowedDevPorts.some((port) => origin === `http://localhost:${port}` || origin === `https://localhost:${port}`);

        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        if (isLocalDevOrigin) {
          callback(null, true);
          return;
        }

        callback(new Error("CORS blocked for origin"), false);
      },
    })
  );

  // Session middleware for OAuth PKCE/CSRF state
  app.use(
    session({
      secret: env.SESSION_SECRET || "dev-secret-change-in-production",
      resave: false,
      saveUninitialized: true,
      cookie: {
        httpOnly: true,
        secure: env.ENVIRONMENT === "production",
        sameSite: "lax",
        maxAge: 30 * 60 * 1000, // 30 minutes - only needed for OAuth flow
      },
    })
  );

  app.use("/auth", authRoutes);
  app.use("/jobs", requireUserAuth, jobRoutes);
  app.use("/resumes", requireUserAuth, resumeRoutes);
  app.use("/contacts", requireUserAuth, contactRoutes);
  app.use("/reminders", requireUserAuth, reminderRoutes);
  app.use("/outreach", requireUserAuth, outreachRoutes);
  app.use("/templates", requireUserAuth, templateRoutes);
  app.use("/api/extract", requireUserAuth, emailExtractionRoutes);
  app.use("/ai", requireUserAuth, aiRoutes);
  app.use("/admin", requireUserAuth, requireAdmin(), adminRoutes);
  app.use("/billing", requireUserAuth, billingRoutes);
  app.use("/notifications", requireUserAuth, notificationRoutes);
  app.use("/health", healthRoutes);
  app.use("/mcp", mcpRoutes);

  // Browsers often open the API origin directly or request /favicon.ico; avoid a raw JSON 404 for humans.
  app.get("/", (_req, res) => {
    const appUrl = env.FRONTEND_URL || "http://localhost:5173";
    res.type("html").send(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Job Search Hub API</title></head>` +
        `<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem;line-height:1.5">` +
        `<h1>API is running</h1>` +
        `<p>This port serves the Job Search Hub backend only. Open the web app here:</p>` +
        `<p><a href="${appUrl}">${appUrl}</a></p>` +
        `<p style="color:#64748b;font-size:0.9rem">Health check: <a href="/health">/health</a></p>` +
        `</body></html>`
    );
  });

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Global error handler
  app.use((err, _req, res, _next) => {
    logger.error("Unhandled error", {
      error: err.message,
      stack: env.ENVIRONMENT !== "production" ? err.stack : undefined,
    });
    res.status(err.status || 500).json({
      error: env.ENVIRONMENT === "production" ? "Internal server error" : err.message,
    });
  });

  // Validate LLM configuration at startup
  try {
    validateLlmConfiguration();
  } catch (error) {
    logger.warn("LLM configuration validation warning", { error: error.message });
  }

  return app;
}

module.exports = { createApp };
