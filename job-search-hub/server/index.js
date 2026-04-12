require("dotenv").config();

const { validateEnv } = require("./src/config/validateEnv");
const { logger } = require("./src/utils/logger");

validateEnv();

const { env } = require("./src/config/env");
const { createApp } = require("./src/app");
const { startSyncScheduler, stopSyncScheduler } = require("./src/scheduler/syncScheduler");

const app = createApp();

startSyncScheduler();

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info("HTTP server closed");
    if (typeof stopSyncScheduler === "function") stopSyncScheduler();
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after 10s timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { error: String(reason) });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception, shutting down", { error: err.message, stack: err.stack });
  process.exit(1);
});
