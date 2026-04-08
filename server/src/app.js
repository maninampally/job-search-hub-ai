const express = require("express");
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
const { billingRoutes } = require("./routes/billingRoutes");
const { requireUserAuth } = require("./middleware/requireUserAuth");
const { requireAdmin } = require("./middleware/requireAdmin");

function createApp() {
  const app = express();
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.length
    ? env.CORS_ALLOWED_ORIGINS
    : [env.FRONTEND_URL].filter(Boolean);

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        const isLocalDevOrigin =
          process.env.NODE_ENV !== "production" &&
          typeof origin === "string" &&
          /^https?:\/\/localhost(:\d+)?$/i.test(origin);

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
  // Billing webhook uses raw body - must be before the json-parsed billing routes
  app.use("/billing/webhook", billingRoutes);
  app.use("/billing", requireUserAuth, billingRoutes);
  app.use("/health", healthRoutes);
  app.use("/mcp", mcpRoutes);

  return app;
}

module.exports = { createApp };
