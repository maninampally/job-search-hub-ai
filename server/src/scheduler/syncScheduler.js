const cron = require("node-cron");
const { fetchJobEmails } = require("../services/jobSync");
const { getLinkedUserId, getAllUsersWithActiveTokens } = require("../store/dataStore");
const { env } = require("../config/env");

function startSyncScheduler() {
  cron.schedule(env.SYNC_CRON, async () => {
    console.log("[scheduler] starting scheduled Gmail sync");
    try {
      // NEW: Get all users with active Gmail tokens
      const usersWithTokens = await getAllUsersWithActiveTokens();
      
      if (!usersWithTokens || usersWithTokens.length === 0) {
        console.log("[scheduler] skipped: no users with active Gmail tokens");
        return;
      }

      console.log(`[scheduler] found ${usersWithTokens.length} user(s) with active tokens, starting sync loop`);

      // NEW: Sync each user sequentially with delay to avoid API rate limiting
      for (const userId of usersWithTokens) {
        try {
          console.log(`[scheduler] syncing user=${userId}`);
          await fetchJobEmails({ mode: "daily", userId });
          // 2-second delay between users to avoid Gmail API rate limits
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`[scheduler] sync failed for user=${userId}:`, error.message);
          // Continue to next user even if one fails
        }
      }

      console.log(`[scheduler] completed sync loop for ${usersWithTokens.length} user(s)`);
    } catch (error) {
      console.error("[scheduler] sync failed:", error.message);
    }
  });

  console.log(`[scheduler] configured cron: ${env.SYNC_CRON}`);
}

module.exports = { startSyncScheduler };
