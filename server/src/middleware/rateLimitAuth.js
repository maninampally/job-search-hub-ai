/**
 * Rate Limit Middleware for Authentication Routes
 * Prevents brute force attacks on login/register/verify-email endpoints.
 * 
 * Strategy:
 * - Per-IP rate limit (prevent distributed attacks)
 * - Per-email rate limit (prevent enumeration)
 * - Different limits for different endpoints
 */

const { logger } = require("../utils/logger");

// In-memory store for rate limit tracking
// In production, use Redis instead
const rateLimitStore = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const ttl = 15 * 60 * 1000; // 15 minutes

  for (const [key, value] of rateLimitStore.entries()) {
    if (now - value.firstAttempt > ttl) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Record an attempt and check if limit is exceeded
 * @param {string} key - Unique key (e.g., "ip:192.168.1.1" or "email:user@example.com")
 * @param {number} maxAttempts - Max attempts allowed in window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
function checkRateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  // Create new record if doesn't exist
  if (!record) {
    record = { attempts: 1, firstAttempt: now };
    rateLimitStore.set(key, record);
    return { allowed: true, remaining: maxAttempts - 1, resetAt: now + windowMs };
  }

  // Check if window expired
  if (now - record.firstAttempt > windowMs) {
    // Reset
    record = { attempts: 1, firstAttempt: now };
    rateLimitStore.set(key, record);
    return { allowed: true, remaining: maxAttempts - 1, resetAt: now + windowMs };
  }

  // Increment attempts
  record.attempts += 1;
  const remaining = Math.max(0, maxAttempts - record.attempts);
  const resetAt = record.firstAttempt + windowMs;

  return {
    allowed: record.attempts <= maxAttempts,
    remaining,
    resetAt,
  };
}

/**
 * Middleware factory: rate limit by IP + Email on login/register
 * @param {object} options - { maxAttempts, windowMs }
 * @returns {function} Express middleware
 */
function rateLimitAuth(options = {}) {
  const { maxAttempts = 5, windowMs = 15 * 60 * 1000 } = options; // 5 attempts per 15 min

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const email = (req.body?.email || "").toLowerCase().trim();

    // Rate limit by IP (prevent distributed attacks)
    const ipKey = `ip:${ip}`;
    const ipLimit = checkRateLimit(ipKey, maxAttempts * 2, windowMs); // 2x limit per IP

    if (!ipLimit.allowed) {
      logger.warn("IP rate limit exceeded", { ip, email, resetAt: new Date(ipLimit.resetAt) });
      return res.status(429).json({
        error: "too_many_requests",
        message: "Too many attempts. Please try again later.",
        retryAfter: Math.ceil((ipLimit.resetAt - Date.now()) / 1000),
      });
    }

    // Rate limit by email (prevent enumeration + account crack)
    if (email) {
      const emailKey = `email:${email}`;
      const emailLimit = checkRateLimit(emailKey, maxAttempts, windowMs);

      if (!emailLimit.allowed) {
        logger.warn("Email rate limit exceeded", { email, ip, resetAt: new Date(emailLimit.resetAt) });
        return res.status(429).json({
          error: "too_many_requests",
          message: "Too many attempts for this email. Please try again later.",
          retryAfter: Math.ceil((emailLimit.resetAt - Date.now()) / 1000),
        });
      }

      // Attach remaining attempts to request for logging
      req.rateLimit = { ipRemaining: ipLimit.remaining, emailRemaining: emailLimit.remaining };
    } else {
      req.rateLimit = { ipRemaining: ipLimit.remaining };
    }

    next();
  };
}

/**
 * Middleware: rate limit email verification requests
 * Stricter than login (3 attempts per hour per user + per IP)
 */
function rateLimitEmailVerification(options = {}) {
  const { maxAttempts = 3, windowMs = 60 * 60 * 1000 } = options; // 3 per hour

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const userId = req.authUser?.id || "unknown";

    // Rate limit by user ID
    if (userId !== "unknown") {
      const userKey = `verify-email:${userId}`;
      const userLimit = checkRateLimit(userKey, maxAttempts, windowMs);

      if (!userLimit.allowed) {
        logger.warn("Email verification rate limit exceeded", {
          userId,
          resetAt: new Date(userLimit.resetAt),
        });
        return res.status(429).json({
          error: "too_many_requests",
          message: "Too many verification requests. Try again in 1 hour.",
          retryAfter: Math.ceil((userLimit.resetAt - Date.now()) / 1000),
        });
      }

      req.rateLimit = { userRemaining: userLimit.remaining };
    }

    // Also limit by IP (prevent abuse from multiple accounts)
    const ipKey = `verify-email-ip:${ip}`;
    const ipLimit = checkRateLimit(ipKey, maxAttempts * 3, windowMs);

    if (!ipLimit.allowed) {
      logger.warn("IP email verification rate limit exceeded", { ip, resetAt: new Date(ipLimit.resetAt) });
      return res.status(429).json({
        error: "too_many_requests",
        message: "Too many verification requests from your IP. Try again later.",
        retryAfter: Math.ceil((ipLimit.resetAt - Date.now()) / 1000),
      });
    }

    next();
  };
}

/**
 * Clear rate limit for a specific key (e.g., after successful login)
 * @param {string} key - Rate limit key
 */
function clearRateLimit(key) {
  rateLimitStore.delete(key);
}

module.exports = {
  rateLimitAuth,
  rateLimitEmailVerification,
  checkRateLimit,
  clearRateLimit,
};
