const { query: dbQuery } = require("../services/dbAdapter");

/**
 * Smart follow-up nudges (Pro+ feature)
 * Fetches jobs for userId where status is Applied/Screening and updatedAt < 7 days ago
 */
async function getFollowUpNudges(userId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const result = await dbQuery(
      `SELECT id, role, company, status, updated_at
       FROM jobs
       WHERE user_id = $1
         AND status IN ('Applied', 'Screening')
         AND updated_at < $2
       ORDER BY updated_at ASC`,
      [userId, sevenDaysAgo]
    );

    return (result.rows || []).map((job) => {
      const daysSince = Math.floor(
        (Date.now() - new Date(job.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        jobId: job.id,
        role: job.role,
        company: job.company,
        status: job.status,
        daysSinceUpdate: daysSince,
        suggestedAction: `Follow up on your ${job.status.toLowerCase()} application at ${job.company}`,
      };
    });
  } catch (err) {
    // Graceful fallback if jobs table query fails
    console.warn("[followUpService] query failed:", err.message);
    return [];
  }
}

module.exports = { getFollowUpNudges };
