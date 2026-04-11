const { query: dbQuery } = require("../services/dbAdapter");
const { logger } = require("../utils/logger");

/**
 * Check quota and increment usage counter.
 * Returns { allowed, used, limit }.
 * Gracefully falls back (allows) if ai_usage table does not exist.
 */
async function checkAndIncrementQuota(userId, feature, limit) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Get today's count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as count FROM ai_usage
       WHERE user_id = $1 AND feature = $2 AND DATE(created_at) = $3`,
      [userId, feature, today]
    );

    const used = parseInt(countResult.rows?.[0]?.count || "0", 10);

    if (used >= limit) {
      return { allowed: false, used, limit };
    }

    // Increment
    await dbQuery(
      `INSERT INTO ai_usage (user_id, feature, created_at) VALUES ($1, $2, NOW())`,
      [userId, feature]
    );

    return { allowed: true, used: used + 1, limit };
  } catch (err) {
    // Table may not exist yet - allow the call but warn
    logger.warn("AI quota check failed, allowing request", { error: err.message });
    return { allowed: true, used: 0, limit };
  }
}

/**
 * Get today's usage summary for a user across all features.
 */
async function getTodayUsage(userId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await dbQuery(
      `SELECT feature, COUNT(*) as count FROM ai_usage
       WHERE user_id = $1 AND DATE(created_at) = $2
       GROUP BY feature`,
      [userId, today]
    );
    return (result.rows || []).reduce((acc, row) => {
      acc[row.feature] = parseInt(row.count, 10);
      return acc;
    }, {});
  } catch (err) {
    logger.warn("getTodayUsage failed", { error: err.message });
    return {};
  }
}

module.exports = { checkAndIncrementQuota, getTodayUsage };
