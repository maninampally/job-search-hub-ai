/**
 * Rate Limiter — Per-user sync rate limiting
 * Default: 3 syncs per user per hour to prevent API abuse
 */

const { env } = require("../config/env");

// In-memory rate limit tracker: { userId: [timestamp, timestamp, ...] }
const syncAttempts = new Map();

// Cleanup old attempts every 10 minutes
setInterval(() => {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;

  for (const [userId, timestamps] of syncAttempts.entries()) {
    const recent = timestamps.filter((t) => t > hourAgo);
    if (recent.length === 0) {
      syncAttempts.delete(userId);
    } else {
      syncAttempts.set(userId, recent);
    }
  }
}, 10 * 60 * 1000);

/**
 * Check if user has exceeded rate limit
 * Returns: { allowed: boolean, remaining: number, resetAt: timestamp }
 */
function checkRateLimit(userId) {
  const limit = parseInt(env.RATE_LIMIT_SYNC_PER_HOUR || "3", 10);
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;

  // Get recent attempts
  let attempts = syncAttempts.get(userId) || [];
  attempts = attempts.filter((t) => t > hourAgo);

  const allowed = attempts.length < limit;
  const remaining = Math.max(0, limit - attempts.length - (allowed ? 1 : 0));
  const resetAt = attempts.length > 0 ? attempts[0] + 60 * 60 * 1000 : now + 60 * 60 * 1000;

  return {
    allowed,
    remaining,
    resetAt,
    attemptCount: attempts.length,
    limit,
  };
}

/**
 * Record a sync attempt for a user
 */
function recordSyncAttempt(userId) {
  if (!syncAttempts.has(userId)) {
    syncAttempts.set(userId, []);
  }
  syncAttempts.get(userId).push(Date.now());
}

/**
 * Get current rate limit status for user
 */
function getRateLimitStatus(userId) {
  const limit = parseInt(env.RATE_LIMIT_SYNC_PER_HOUR || "3", 10);
  const attempts = syncAttempts.get(userId) || [];
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;

  const recent = attempts.filter((t) => t > hourAgo);
  const remaining = Math.max(0, limit - recent.length);
  const oldestAttempt = recent.length > 0 ? recent[0] : null;
  const resetAt = oldestAttempt ? oldestAttempt + 60 * 60 * 1000 : null;

  return {
    limit,
    used: recent.length,
    remaining,
    resetAt,
    nextAvailableAt: remaining === 0 && resetAt ? resetAt : now,
  };
}

/**
 * Express middleware for rate limiting
 */
function rateLimitMiddleware(req, res, next) {
  const userId = req.authUser?.id || req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const status = checkRateLimit(userId);
  if (!status.allowed) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: `No more than ${status.limit} syncs per hour allowed`,
      resetAt: status.resetAt,
      remaining: status.remaining,
    });
  }

  recordSyncAttempt(userId);

  // Add rate limit info to response headers
  res.set({
    "X-RateLimit-Limit": String(status.limit),
    "X-RateLimit-Remaining": String(Math.max(0, status.remaining - 1)),
    "X-RateLimit-Reset": String(status.resetAt),
  });

  next();
}

module.exports = {
  checkRateLimit,
  recordSyncAttempt,
  getRateLimitStatus,
  rateLimitMiddleware,
};
