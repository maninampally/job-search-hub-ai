const { store } = require("../store/memoryStore");
const { oauth2Client, createGmailClient } = require("../integrations/gmail");
const { extractJobInfo } = require("./jobExtractor");

const GMAIL_QUERY = "subject:(application OR applied OR interview OR offer OR rejected OR job OR position OR role OR hiring OR recruiter) newer_than:7d";

async function processEmail(gmail, messageId) {
  try {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

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

    const exists = store.jobs.some(
      (job) =>
        job.company?.toLowerCase() === extracted.company?.toLowerCase() &&
        job.role?.toLowerCase() === extracted.role?.toLowerCase()
    );

    if (!exists) {
      store.jobs.push({
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
  if (!store.tokens) {
    return;
  }

  const gmail = createGmailClient(store.tokens);

  try {
    const list = await gmail.users.messages.list({
      userId: "me",
      q: GMAIL_QUERY,
      maxResults: 20,
    });

    const messages = list.data.messages || [];
    const newMessages = messages.filter((message) => !store.processedIds.has(message.id));

    for (const msg of newMessages) {
      await processEmail(gmail, msg.id);
      store.processedIds.add(msg.id);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    store.lastChecked = new Date().toISOString();

    if (store.tokens.expiry_date && store.tokens.expiry_date < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      store.tokens = credentials;
    }
  } catch (error) {
    console.error("Gmail fetch error:", error.message);
  }
}

module.exports = {
  fetchJobEmails,
};
