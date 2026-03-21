const cron = require("node-cron");
const { fetchJobEmails } = require("../services/jobSync");

function startSyncScheduler() {
  cron.schedule("*/5 * * * *", () => {
    console.log("Scheduled Gmail sync...");
    fetchJobEmails();
  });
}

module.exports = { startSyncScheduler };
