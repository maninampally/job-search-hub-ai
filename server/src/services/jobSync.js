const {
  addJob,
  getJobs,
  getTokens,
  isProcessedEmail,
  markProcessedEmail,
  setLastChecked,
  setTokens,
} = require("../store/dataStore");
const { oauth2Client, createGmailClient } = require("../integrations/gmail");
const { extractJobInfo } = require("./jobExtractor");
const { withRetry, withTimeout } = require("../utils/asyncTools");
const { env } = require("../config/env");

const GMAIL_QUERY = "subject:(application OR applied OR interview OR offer OR rejected OR job OR position OR role OR hiring OR recruiter) newer_than:7d";

async function processEmail(gmail, messageId) {
  try {
    const msg = await withRetry(
      () =>
        withTimeout(
          () =>
            gmail.users.messages.get({
              userId: "me",
              id: messageId,
              format: "full",
            }),
          env.EXTERNAL_API_TIMEOUT_MS,
          "Gmail message get timed out"
        ),
      { retries: env.RETRY_ATTEMPTS }
    );

    const headers = msg.data.payload.headers || [];
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";

    let body = "";
    const parts = msg.data.payload.parts || [msg.data.payload];
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
        break;
      }
    }

    if (!body && msg.data.payload.body?.data) {
      body = Buffer.from(msg.data.payload.body.data, "base64").toString("utf-8");
    }

    if (!body || body.length < 20) {
      return;
    }

    const extracted = await extractJobInfo({
      subject,
      from,
      date,
      body: body.slice(0, 3000),
    });

    if (!extracted || !extracted.isJobRelated) {
      return;
    }

    const jobs = await getJobs();
    const exists = jobs.some(
      (job) =>
        job.company?.toLowerCase() === extracted.company?.toLowerCase() &&
        job.role?.toLowerCase() === extracted.role?.toLowerCase()
    );

    if (!exists) {
      await addJob({
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...extracted,
        emailId: messageId,
        createdAt: new Date().toISOString(),
        source: "gmail",
      });
      console.log(`Added: ${extracted.company} — ${extracted.role}`);
    }
  } catch (error) {
    console.error("Process email error:", error.message);
  }
}

async function fetchJobEmails() {
  const tokens = await getTokens();
  if (!tokens) {
    console.log("[sync] skipped: gmail not connected");
    return;
  }

  const gmail = createGmailClient(tokens);
  const startedAt = Date.now();

  try {
    const list = await withRetry(
      () =>
        withTimeout(
          () =>
            gmail.users.messages.list({
              userId: "me",
              q: GMAIL_QUERY,
              maxResults: 20,
            }),
          env.EXTERNAL_API_TIMEOUT_MS,
          "Gmail message list timed out"
        ),
      { retries: env.RETRY_ATTEMPTS }
    );

    const messages = list.data.messages || [];
    const newMessages = [];
    for (const message of messages) {
      const processed = await isProcessedEmail(message.id);
      if (!processed) {
        newMessages.push(message);
      }
    }

    for (const msg of newMessages) {
      await processEmail(gmail, msg.id);
      await markProcessedEmail(msg.id);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const checkedAt = new Date().toISOString();
    await setLastChecked(checkedAt);

    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await setTokens(credentials);
      console.log("[sync] refreshed Gmail OAuth token");
    }

    console.log(
      `[sync] completed: scanned=${messages.length}, processed=${newMessages.length}, durationMs=${Date.now() - startedAt}`
    );
  } catch (error) {
    console.error("[sync] failed:", error.message);
  }
}

module.exports = {
  fetchJobEmails,
};
