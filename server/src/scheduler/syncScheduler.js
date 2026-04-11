const cron = require("node-cron");
const { fetchJobEmails } = require("../services/jobSync");
const { getAllUsersWithActiveTokens } = require("../store/dataStore");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");

function startSyncScheduler() {
  const cronOptions = env.SYNC_CRON_TIMEZONE ? { timezone: env.SYNC_CRON_TIMEZONE } : {};

  cron.schedule(
    env.SYNC_CRON,
    async () => {
      logger.info("[scheduler] starting scheduled Gmail sync");
      try {
        const usersWithTokens = await getAllUsersWithActiveTokens();

        if (!usersWithTokens || usersWithTokens.length === 0) {
          logger.info("[scheduler] skipped: no users with active Gmail tokens");
          return;
        }

        logger.info("[scheduler] found users with active tokens", { count: usersWithTokens.length });

        for (const userId of usersWithTokens) {
          try {
            logger.debug("[scheduler] syncing user", { userId });
            await fetchJobEmails({ mode: "daily", userId });
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch (error) {
            logger.error("[scheduler] sync failed for user", { userId, error: error.message });
          }
        }

        logger.info("[scheduler] completed sync loop", { count: usersWithTokens.length });
      } catch (error) {
        logger.error("[scheduler] sync failed", { error: error.message });
      }
    },
    cronOptions
  );

  logger.info("[scheduler] configured cron schedule", {
    pattern: env.SYNC_CRON,
    timezone: env.SYNC_CRON_TIMEZONE || "server local time",
  });
}

module.exports = { startSyncScheduler };
