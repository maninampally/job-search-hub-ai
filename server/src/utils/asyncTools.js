function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promiseFactory, timeoutMs, timeoutMessage) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promiseFactory(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function withRetry(taskFactory, options = {}) {
  const {
    retries = 2,
    initialDelayMs = 400,
    maxDelayMs = 3000,
    backoffMultiplier = 2,
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;
  let lastError = null;

  while (attempt <= retries) {
    try {
      return await taskFactory();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await sleep(delay);
      delay = Math.min(maxDelayMs, delay * backoffMultiplier);
    }
    attempt += 1;
  }

  throw lastError;
}

module.exports = {
  withTimeout,
  withRetry,
};
