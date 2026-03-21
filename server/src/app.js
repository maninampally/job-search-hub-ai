const express = require("express");
const cors = require("cors");

const { authRoutes } = require("./routes/authRoutes");
const { jobRoutes } = require("./routes/jobRoutes");
const { healthRoutes } = require("./routes/healthRoutes");

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors({ origin: "*" }));

  app.use("/auth", authRoutes);
  app.use("/jobs", jobRoutes);
  app.use("/health", healthRoutes);

  return app;
}

module.exports = { createApp };
