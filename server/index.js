require("dotenv").config();

const { validateEnv } = require("./src/config/validateEnv");
const { logger } = require("./src/utils/logger");

validateEnv();

const { env } = require("./src/config/env");
const { createApp } = require("./src/app");
const { startSyncScheduler } = require("./src/scheduler/syncScheduler");

const app = createApp();

startSyncScheduler();

app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
});
