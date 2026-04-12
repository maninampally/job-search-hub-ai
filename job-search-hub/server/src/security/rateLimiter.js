/**
 * Per-user manual sync rate limiting by subscription tier.
 * Scheduled sync (cron) does not use this middleware.
 */

const { env } = require("../config/env");

const syncAttempts = new Map();

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

function getManualSyncLimitForRole(role) {
  const r = String(role || "free").toLowerCase();
  if (r === "admin") {
    return Math.max(1, env.RATE_LIMIT_SYNC_ADMIN);
  }
  if (r === "elite") {
    return Math.max(1, env.RATE_LIMIT_SYNC_ELITE);
  }
  if (r === "pro") {
    return Math.max(1, env.RATE_LIMIT_SYNC_PRO);
  }
  return Math.max(1, env.RATE_LIMIT_SYNC_FREE);
}

function checkRateLimit(userId, role) {
  const limit = getManualSyncLimitForRole(role);
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;

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

function recordSyncAttempt(userId) {
  if (!syncAttempts.has(userId)) {
    syncAttempts.set(userId, []);
  }
  syncAttempts.get(userId).push(Date.now());
}

function getRateLimitStatus(userId, role) {
  const limit = getManualSyncLimitForRole(role);
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

function rateLimitMiddleware(req, res, next) {
  const userId = req.authUser?.id || req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = req.authUser?.role || req.user?.role || "free";
  const status = checkRateLimit(userId, role);
  if (!status.allowed) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: `No more than ${status.limit} manual syncs per hour for your plan`,
      resetAt: status.resetAt,
      remaining: status.remaining,
      limit: status.limit,
    });
  }

  recordSyncAttempt(userId);

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
  getManualSyncLimitForRole,
  rateLimitMiddleware,
};
