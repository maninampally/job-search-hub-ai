require("dotenv").config();

const { env } = require("./src/config/env");
const { createApp } = require("./src/app");
const { startSyncScheduler } = require("./src/scheduler/syncScheduler");

const app = createApp();

startSyncScheduler();

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
