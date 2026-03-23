const cron = require("node-cron");
const { fetchJobEmails } = require("../services/jobSync");
const { env } = require("../config/env");

function startSyncScheduler() {
  cron.schedule(env.SYNC_CRON, async () => {
    console.log("[scheduler] starting scheduled Gmail sync");
    try {
      await fetchJobEmails();
    } catch (error) {
      console.error("[scheduler] sync failed:", error.message);
    }
  });

  console.log(`[scheduler] configured cron: ${env.SYNC_CRON}`);
}

module.exports = { startSyncScheduler };
