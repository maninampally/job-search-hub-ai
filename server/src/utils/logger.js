/**
 * Structured Logger
 * Replaces console.log/warn/error throughout the codebase.
 * In production, can be extended to send logs to external service (e.g., Sentry, Datadog).
 */

const { env } = require("../config/env");

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CURRENT_LEVEL = env.LOG_LEVEL ? LOG_LEVELS[env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO : LOG_LEVELS.INFO;
const IS_PRODUCTION = env.ENVIRONMENT === "production";

function formatLog(level, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  const baseLog = {
    timestamp,
    level,
    message,
  };

  // In production, include all metadata; in dev, pretty-print
  if (IS_PRODUCTION) {
    return {
      ...baseLog,
      ...metadata,
    };
  }

  return baseLog;
}

function log(level, message, metadata = {}) {
  // Check if we should log this level
  if (LOG_LEVELS[level] < CURRENT_LEVEL) {
    return;
  }

  const logEntry = formatLog(level, message, metadata);

  if (IS_PRODUCTION) {
    // Production: JSON output for log aggregation
    console.log(JSON.stringify(logEntry));
  } else {
    // Development: human-readable format
    const metaStr = Object.keys(metadata).length > 0 ? JSON.stringify(metadata, null, 2) : "";
    const prefix = `[${logEntry.timestamp}] [${level}]`;
    console.log(`${prefix} ${message}${metaStr ? "\n" + metaStr : ""}`);
  }
}

const logger = {
  debug: (message, metadata) => log("DEBUG", message, metadata),
  info: (message, metadata) => log("INFO", message, metadata),
  warn: (message, metadata) => log("WARN", message, metadata),
  error: (message, metadata) => log("ERROR", message, metadata),
};

module.exports = { logger };
