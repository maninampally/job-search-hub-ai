/**
 * Audit Logger — Comprehensive audit logging for compliance and security
 * Logs: authentication, API calls, syncs, errors, security events
 * Stored in daily files in server/data/audit-logs/
 */

const fs = require("fs");
const path = require("path");
const { env } = require("../config/env");

const AUDIT_LOG_DIR = path.join(__dirname, "../../data/audit-logs");
const ENABLED = env.AUDIT_LOG_ENABLED !== "false";

// Ensure audit log directory exists
function ensureLogDirectory() {
  if (!fs.existsSync(AUDIT_LOG_DIR)) {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
  }
}

/**
 * Get today's audit log filename
 */
function getTodayLogPath() {
  const date = new Date().toISOString().split("T")[0];
  return path.join(AUDIT_LOG_DIR, `audit-${date}.log`);
}

/**
 * Write audit log entry
 */
function log(eventType, data = {}) {
  if (!ENABLED) return;

  try {
    ensureLogDirectory();

    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      eventType,
      ...data,
    };

    const logPath = getTodayLogPath();
    const line = JSON.stringify(entry) + "\n";

    fs.appendFileSync(logPath, line, "utf8");
  } catch (error) {
    console.error("[AuditLogger] Failed to write log:", error.message);
  }
}

/**
 * Log authentication events
 */
function logAuth(eventType, userId, details = {}) {
  log("AUTH", {
    eventType,
    userId,
    ...details,
  });
}

/**
 * Log OAuth flow events
 */
function logOAuth(eventType, userId, details = {}) {
  log("OAUTH", {
    eventType,
    userId,
    ...details,
  });
}

/**
 * Log sync events
 */
function logSync(eventType, userId, details = {}) {
  log("SYNC", {
    eventType,
    userId,
    ...details,
  });
}

/**
 * Log security events
 */
function logSecurity(eventType, details = {}) {
  log("SECURITY", {
    eventType,
    ...details,
  });
}

/**
 * Log API errors
 */
function logError(eventType, error, userId = null, details = {}) {
  log("ERROR", {
    eventType,
    userId,
    errorMessage: error.message,
    errorType: error.constructor.name,
    ...details,
  });
}

/**
 * Log rate limit events
 */
function logRateLimit(userId, limit, attemptCount) {
  log("RATE_LIMIT", {
    userId,
    limit,
    attemptCount,
    message: "Rate limit exceeded",
  });
}

/**
 * Clean up old audit logs (older than retention period)
 */
function cleanupOldLogs() {
  if (!ENABLED) return;

  try {
    ensureLogDirectory();
    const retentionDays = parseInt(env.AUDIT_LOG_RETENTION_DAYS || "90", 10);
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const files = fs.readdirSync(AUDIT_LOG_DIR);
    files.forEach((file) => {
      const filePath = path.join(AUDIT_LOG_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > retentionMs) {
        fs.unlinkSync(filePath);
        console.log(`[AuditLogger] Deleted old log: ${file}`);
      }
    });
  } catch (error) {
    console.error("[AuditLogger] Cleanup failed:", error.message);
  }
}

// Run cleanup daily at 2 AM
setInterval(() => {
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setDate(nextRun.getDate() + 1);
  nextRun.setHours(2, 0, 0, 0);

  const delay = nextRun - now;
  setTimeout(() => {
    cleanupOldLogs();
    // Repeat daily
    setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);
  }, delay);
}, 1000); // Check after 1 second to schedule first run

module.exports = {
  log,
  logAuth,
  logOAuth,
  logSync,
  logSecurity,
  logError,
  logRateLimit,
  cleanupOldLogs,
};
