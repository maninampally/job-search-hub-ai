const express = require("express");
const cors = require("cors");
const { env } = require("./config/env");

const { authRoutes } = require("./routes/authRoutes");
const { jobRoutes } = require("./routes/jobRoutes");
const { healthRoutes } = require("./routes/healthRoutes");
const { templateRoutes } = require("./routes/templateRoutes");
const { mcpRoutes } = require("./routes/mcpRoutes");

function createApp() {
  const app = express();
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.length
    ? env.CORS_ALLOWED_ORIGINS
    : [env.FRONTEND_URL].filter(Boolean);

  app.use(express.json());
  app.use(
    cors({
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

  app.use("/auth", authRoutes);
  app.use("/jobs", jobRoutes);
  app.use("/templates", templateRoutes);
  app.use("/health", healthRoutes);
  app.use("/mcp", mcpRoutes);

  return app;
}

module.exports = { createApp };
