const { logger } = require("../utils/logger");
const { query: dbQuery } = require("./dbAdapter");

const NOTIFICATION_TYPES = {
  STALE_JOB: "stale_job",
  WEEKLY_DIGEST: "weekly_digest",
  PLAN_EXPIRING: "plan_expiring",
  WELCOME: "welcome",
  SECURITY_ALERT: "security_alert",
};

async function createNotification(userId, type, title, body, metadata = {}) {
  try {
    await dbQuery(
      `INSERT INTO notifications (user_id, type, title, body, metadata, read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW())`,
      [userId, type, title, body, JSON.stringify(metadata)]
    );
  } catch (err) {
    logger.warn("Failed to create notification", { userId, type, error: err.message });
  }
}

async function getUnreadNotifications(userId) {
  try {
    const result = await dbQuery(
      `SELECT * FROM notifications WHERE user_id = $1 AND read = false
       ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    return result.rows || [];
  } catch (err) {
    logger.warn("Failed to fetch notifications", { error: err.message });
    return [];
  }
}

async function markNotificationRead(notificationId, userId) {
  try {
    await dbQuery(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  } catch (err) {
    logger.warn("Failed to mark notification read", { error: err.message });
  }
}

async function markAllRead(userId) {
  try {
    await dbQuery(
      `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
      [userId]
    );
  } catch (err) {
    logger.warn("Failed to mark all notifications read", { error: err.message });
  }
}

async function sendWelcomeNotification(userId) {
  await createNotification(
    userId,
    NOTIFICATION_TYPES.WELCOME,
    "Welcome to Job Search Hub!",
    "Get started by connecting your Gmail account or adding your first job application.",
    { action: "onboarding" }
  );
}

async function checkStaleJobs(userId) {
  try {
    const result = await dbQuery(
      `SELECT id, company, role FROM jobs
       WHERE user_id = $1 AND status NOT IN ('Offer', 'Rejected', 'Closed')
       AND updated_at < NOW() - INTERVAL '7 days'`,
      [userId]
    );
    const staleJobs = result.rows || [];
    for (const job of staleJobs.slice(0, 3)) {
      await createNotification(
        userId,
        NOTIFICATION_TYPES.STALE_JOB,
        `Follow up with ${job.company}?`,
        `Your application for ${job.role} at ${job.company} has been quiet for 7+ days. Consider sending a follow-up.`,
        { jobId: job.id }
      );
    }
    return staleJobs.length;
  } catch (err) {
    logger.warn("Failed to check stale jobs", { error: err.message });
    return 0;
  }
}

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  getUnreadNotifications,
  markNotificationRead,
  markAllRead,
  sendWelcomeNotification,
  checkStaleJobs,
};
