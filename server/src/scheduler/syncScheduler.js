const cron = require("node-cron");
const { fetchJobEmails } = require("../services/jobSync");
const { getLinkedUserId } = require("../store/dataStore");
const { env } = require("../config/env");

function startSyncScheduler() {
  cron.schedule(env.SYNC_CRON, async () => {
    console.log("[scheduler] starting scheduled Gmail sync");
    try {
      const userId = await getLinkedUserId();
      if (!userId) {
        console.log("[scheduler] skipped: no user linked to Gmail OAuth");
        return;
      }
      await fetchJobEmails({ mode: "daily", userId });
    } catch (error) {
      console.error("[scheduler] sync failed:", error.message);
    }
  });

  console.log(`[scheduler] configured cron: ${env.SYNC_CRON}`);
}

module.exports = { startSyncScheduler };
