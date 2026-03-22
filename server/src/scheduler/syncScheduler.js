const cron = require("node-cron");
const { fetchJobEmails } = require("../services/jobSync");

function startSyncScheduler() {
  cron.schedule("*/5 * * * *", async () => {
    console.log("[scheduler] starting scheduled Gmail sync");
    try {
      await fetchJobEmails();
    } catch (error) {
      console.error("[scheduler] sync failed:", error.message);
    }
  });
}

module.exports = { startSyncScheduler };
