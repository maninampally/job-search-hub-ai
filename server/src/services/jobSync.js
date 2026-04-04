const {
  addJobEmail,
  saveJobEmail,
  addStatusChange,
  addJob,
  getJobs,
  getLastChecked,
  getLinkedUserId,
  getTokens,
  getTokensByUser,
  refreshTokenIfExpiredForUser,
  isProcessedEmail,
  markProcessedEmail,
  setLastChecked,
  setTokens,
  updateJob,
} = require("../store/dataStore");
const { oauth2Client, createGmailClient } = require("../integrations/gmail");
const { extractJobInfo } = require("./jobExtractor");
const { withRetry, withTimeout } = require("../utils/asyncTools");
const { acquireSyncLock, releaseSyncLock } = require("./syncState");
const { env } = require("../config/env");

const GMAIL_QUERY_BASE =
  "subject:(application OR applied OR interview OR offer OR rejected OR job OR position OR role OR hiring OR recruiter)";

const STATUS_PROGRESSION = ["Wishlist", "Applied", "Screening", "Interview", "Offer", "Rejected"];

async function refreshTokensIfExpired(tokens, userId) {
  if (!tokens || !tokens.expiry_date || tokens.expiry_date >= Date.now()) {
    return tokens;
  }

  try {
    await refreshTokenIfExpiredForUser(userId);
    // After refresh, fetch the updated tokens
    const updatedTokens = await getTokensByUser(userId);
    console.log("[sync] refreshed Gmail OAuth token for user:", userId);
    return updatedTokens;
  } catch (error) {
    console.error("[sync] token refresh failed:", error.message);
    throw error;
  }
}

function parseSender(fromHeader) {
  const raw = String(fromHeader || "").trim();
  const matched = raw.match(/^(.*)<([^>]+)>$/);
  if (!matched) {
    return {
      fromName: raw,
      fromEmail: raw.includes("@") ? raw : "",
    };
  }

  return {
    fromName: matched[1].trim().replace(/^"|"$/g, ""),
    fromEmail: matched[2].trim(),
  };
}

function classifyFallbackEmailType(subject, fromEmail) {
  const normalizedSubject = String(subject || "").toLowerCase();
  const normalizedFrom = String(fromEmail || "").toLowerCase();

  if (normalizedSubject.includes("interview")) {
    return "Interview Scheduled";
  }

  if (normalizedSubject.includes("offer")) {
    return "Offer";
  }

  if (
    normalizedSubject.includes("reject") ||
    normalizedSubject.includes("not selected") ||
    normalizedSubject.includes("unfortunately")
  ) {
    return "Rejection";
  }

  if (
    normalizedFrom.includes("noreply") ||
    normalizedFrom.includes("no-reply") ||
    normalizedFrom.includes("linkedin.com") ||
    normalizedFrom.includes("workday") ||
    normalizedFrom.includes("greenhouse") ||
    normalizedFrom.includes("lever") ||
    normalizedFrom.includes("icims")
  ) {
    return "Auto / Tracking";
  }

  if (normalizedSubject.includes("thank you for applying") || normalizedSubject.includes("application received")) {
    return "Application Confirmation";
  }

  return "Recruiter Outreach";
}

function classifyFallbackIsReal(fromEmail, emailType) {
  const normalizedFrom = String(fromEmail || "").toLowerCase();
  if (
    normalizedFrom.includes("noreply") ||
    normalizedFrom.includes("no-reply") ||
    normalizedFrom.includes("linkedin.com") ||
    emailType === "Auto / Tracking"
  ) {
    return false;
  }

  return true;
}

function sanitizeEmailBody(rawBody) {
  return String(rawBody || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n")
    .replace(/<\s*\/div\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]+/g, " ")
    .trim();
}

function compactForExtraction(rawBody) {
  return sanitizeEmailBody(rawBody).replace(/\s+/g, " ").trim();
}

function cleanEmailBodyForDisplay(rawBody) {
  let body = String(rawBody || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#169;/g, "©")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&rsquo;/g, "'")
    .replace(/Â/g, "")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/Â»/g, "»");

  body = body.replace(/https?:\/\/[^\s)]+/g, "");
  body = body.replace(/\(\s*\)/g, "");
  body = body.replace(/\(\s*https?:\/\/[\s\S]*?\)/g, "");

  body = body
    .replace(/if you wish to unsubscribe[\s\S]*$/i, "")
    .replace(/if you no longer wish to receive[\s\S]*$/i, "")
    .replace(/this message was sent to[\s\S]*$/i, "");

  const linePatterns = [
    /this is an automated email/i,
    /please do not reply/i,
    /if you no longer wish to receive/i,
    /if you wish to unsubscribe/i,
    /if you don't want to receive/i,
    /unsubscribe now/i,
    /this message was sent to/i,
    /click here/i,
    /my settings/i,
    /api\.clinchtalent\.com/i,
    /utm_source|utm_medium|utm_campaign/i,
    /signature=/i,
    /\*{3,}/,
    /={3,}/,
    /-{3,}/,
    /copyright/i,
    /©/,
    /(way;|street;|\bOH\b|\bUSA\b|\b\d{5}(?:-\d{4})?\b)/i,
  ];

  body = body
    .split("\n")
    .filter((line) => {
      const normalized = String(line || "").trim();
      if (!normalized) {
        return true;
      }
      if (/^[()\[\]\-–—_.\s]+$/.test(normalized)) {
        return false;
      }
      return !linePatterns.some((pattern) => pattern.test(normalized));
    })
    .join("\n");

  body = body
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return body;
}

function normalizeStatus(rawStatus) {
  const value = String(rawStatus || "").toLowerCase();
  if (value.includes("screen")) return "Screening";
  if (value.includes("interview")) return "Interview";
  if (value.includes("offer")) return "Offer";
  if (value.includes("reject")) return "Rejected";
  if (value.includes("wish")) return "Wishlist";
  return "Applied";
}

function shouldPromoteStatus(currentStatus, nextStatus) {
  const currentIndex = STATUS_PROGRESSION.indexOf(normalizeStatus(currentStatus));
  const nextIndex = STATUS_PROGRESSION.indexOf(normalizeStatus(nextStatus));

  if (currentIndex === -1 || nextIndex === -1) {
    return false;
  }

  return nextIndex > currentIndex;
}

function normalizeKeyValue(value) {
  return String(value || "").trim().toLowerCase();
}

function sameCompanyRole(firstJob, secondJob) {
  const firstCompany = normalizeKeyValue(firstJob.company);
  const secondCompany = normalizeKeyValue(secondJob.company);
  const firstRole = normalizeKeyValue(firstJob.role);
  const secondRole = normalizeKeyValue(secondJob.role);

  if (!firstCompany || !secondCompany || !firstRole || !secondRole) {
    return false;
  }

  return firstCompany === secondCompany && firstRole === secondRole;
}

async function updateJobStatus(existingJob, newExtracted, emailPayload, options = {}) {
  const userId = options.userId || null;
  const currentStatus = normalizeStatus(existingJob.status);
  const incomingStatus = normalizeStatus(newExtracted.status);
  const nextStatus = shouldPromoteStatus(currentStatus, incomingStatus)
    ? incomingStatus
    : currentStatus;

  const patch = {
    company: existingJob.company || newExtracted.company || null,
    role: existingJob.role || newExtracted.role || null,
    status: nextStatus,
    location: newExtracted.location || existingJob.location || null,
    recruiterName: newExtracted.recruiterName || existingJob.recruiterName || null,
    recruiterEmail: newExtracted.recruiterEmail || existingJob.recruiterEmail || null,
    appliedDate: existingJob.appliedDate || newExtracted.appliedDate || null,
    notes: newExtracted.notes || existingJob.notes || "",
    nextStep: newExtracted.nextStep || existingJob.nextStep || null,
  };

  if (patch.status !== existingJob.status) {
    await addStatusChange(existingJob.id, existingJob.status || null, patch.status, "email_sync", { userId });
  }
  await updateJob(existingJob.id, patch, { userId });
  await addJobEmail(existingJob.id, emailPayload, { userId });
  await saveJobEmail(existingJob.id, { ...emailPayload, ownerUserId: userId });
}

function decodeGmailBodyData(data) {
  if (!data) {
    return "";
  }

  const normalized = String(data).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function looksLikeHtml(value) {
  const text = String(value || "").toLowerCase();
  return text.includes("<!doctype") || text.includes("<html") || /<[^>]+>/.test(text);
}

function collectMimeBodies(payload, bucket = { plain: [], html: [] }) {
  if (!payload) {
    return bucket;
  }

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    bucket.plain.push(decodeGmailBodyData(payload.body.data));
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    bucket.html.push(decodeGmailBodyData(payload.body.data));
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      collectMimeBodies(part, bucket);
    }
  }

  if (payload.body?.data && bucket.plain.length === 0 && bucket.html.length === 0) {
    bucket.plain.push(decodeGmailBodyData(payload.body.data));
  }

  return bucket;
}

function extractPlainTextBody(payload, snippet) {
  const bodies = collectMimeBodies(payload);
  const plainBodyCandidate = bodies.plain
    .map((item) => String(item || "").trim())
    .find((item) => item.length > 0);

  if (plainBodyCandidate && !looksLikeHtml(plainBodyCandidate)) {
    return plainBodyCandidate;
  }

  const plainBodyAsHtml = plainBodyCandidate && looksLikeHtml(plainBodyCandidate)
    ? sanitizeEmailBody(plainBodyCandidate)
    : "";

  if (plainBodyAsHtml) {
    return plainBodyAsHtml;
  }

  const htmlBody = bodies.html
    .map((item) => String(item || "").trim())
    .find((item) => item.length > 0);

  if (htmlBody) {
    return sanitizeEmailBody(htmlBody);
  }

  return sanitizeEmailBody(snippet || "");
}

async function fetchMessageDetails(gmail, messageId) {
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

  const headers = msg.data.payload?.headers || [];
  const subject = headers.find((h) => h.name === "Subject")?.value || "";
  const from = headers.find((h) => h.name === "From")?.value || "";
  const date = headers.find((h) => h.name === "Date")?.value || "";
  const body = extractPlainTextBody(msg.data.payload, msg.data.snippet);
  const preview = sanitizeEmailBody(body).replace(/\s+/g, " ").trim().slice(0, 180);

  return {
    subject,
    from,
    date,
    body,
    preview,
  };
}

function buildSyncQuery(lastChecked, forceInitialSync = false) {
  if (forceInitialSync || !lastChecked) {
    return `${GMAIL_QUERY_BASE} newer_than:${env.INITIAL_SYNC_LOOKBACK_DAYS}d`;
  }

  const lastCheckedDate = new Date(lastChecked);
  if (Number.isNaN(lastCheckedDate.getTime())) {
    return `${GMAIL_QUERY_BASE} newer_than:${env.DAILY_SYNC_LOOKBACK_DAYS}d`;
  }

  return `${GMAIL_QUERY_BASE} newer_than:${env.DAILY_SYNC_LOOKBACK_DAYS}d`;
}

async function processEmail(gmail, messageId, options = {}) {
  const userId = options.userId || null;
  const { subject, from, date, body } = await fetchMessageDetails(gmail, messageId);
  const { fromName, fromEmail } = parseSender(from);
  const originalBody = String(body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const displayBody = cleanEmailBodyForDisplay(originalBody);
  const compactBody = compactForExtraction(originalBody);
  const preview = compactForExtraction(displayBody).slice(0, 180);

  if (!compactBody || compactBody.length < 20) {
    return;
  }

  const extracted = await extractJobInfo({
    subject,
    from,
    date,
    body: compactBody.slice(0, 3000),
  });

  if (!extracted || !extracted.isJobRelated) {
    return;
  }

  if (!extracted.appliedDate) {
    extracted.appliedDate = Number.isNaN(new Date(date).getTime())
      ? new Date().toISOString().slice(0, 10)
      : new Date(date).toISOString().slice(0, 10);
  }

  extracted.status = normalizeStatus(extracted.status);

  const emailType = extracted.emailType || classifyFallbackEmailType(subject, fromEmail);
  const isReal =
    typeof extracted.isReal === "boolean"
      ? extracted.isReal
      : classifyFallbackIsReal(fromEmail, emailType);

  const emailPayload = {
    id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    from: fromEmail || from,
    fromName: fromName || fromEmail || "Unknown Sender",
    subject,
    preview,
    body: displayBody || originalBody,
    date: Number.isNaN(new Date(date).getTime())
      ? new Date().toISOString()
      : new Date(date).toISOString(),
    type: emailType,
    isReal,
    gmailId: messageId,
    isRead: false,
  };

  const jobs = await getJobs({ userId });
  const matchedJob = jobs.find((job) => sameCompanyRole(job, extracted));

  if (matchedJob) {
    await updateJobStatus(matchedJob, extracted, emailPayload, { userId });
    return;
  }

  const newJobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await addJob({
    id: newJobId,
    ...extracted,
    emailId: messageId,
    emails: [emailPayload],
    createdAt: new Date().toISOString(),
    source: "gmail",
    notes:
      extracted.status !== "Applied"
        ? (extracted.notes || "Applied status inferred from a later status email.")
        : extracted.notes,
  }, { userId });
  await saveJobEmail(newJobId, { ...emailPayload, ownerUserId: userId });
  console.log(`Added: ${extracted.company} — ${extracted.role}`);
}

async function backfillJobEmailsFromExistingJobs(options = {}) {
  const userId = options.userId || null;
  
  if (!userId) {
    console.log("[backfill] skipped: userId required");
    return { updated: 0, scanned: 0 };
  }

  const tokens = await getTokensByUser(userId);
  if (!tokens) {
    console.log("[backfill] skipped: gmail not connected for user:", userId);
    return { updated: 0, scanned: 0 };
  }

  const gmail = createGmailClient(tokens);
  const jobs = await getJobs({ userId });
  let updated = 0;
  let scanned = 0;

  for (const job of jobs) {
    if (!job.emailId) {
      continue;
    }

    scanned += 1;
    try {
      const details = await fetchMessageDetails(gmail, job.emailId);
      const { fromName, fromEmail } = parseSender(details.from);
      const emailType = classifyFallbackEmailType(details.subject, fromEmail);
      const isReal = classifyFallbackIsReal(fromEmail, emailType);
      const originalBody = String(details.body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
      const displayBody = cleanEmailBodyForDisplay(originalBody);
      const preview = compactForExtraction(displayBody).slice(0, 180);

      const emails = await addJobEmail(job.id, {
        id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        from: fromEmail || details.from,
        fromName: fromName || fromEmail || "Unknown Sender",
        subject: details.subject,
        preview,
        body: displayBody || originalBody,
        date: Number.isNaN(new Date(details.date).getTime())
          ? new Date().toISOString()
          : new Date(details.date).toISOString(),
        type: emailType,
        isReal,
        gmailId: job.emailId,
        isRead: false,
      }, { userId });

      if (Array.isArray(emails) && emails.length > 0) {
        updated += 1;
      }
    } catch (error) {
      console.error(`[backfill] failed for job=${job.id}:`, error.message);
    }
  }

  return { updated, scanned };
}

async function processMessagesWithQueue(gmail, messages, options = {}) {
  const userId = options.userId || null;
  const concurrency = Math.max(1, Number(env.SYNC_PROCESSING_CONCURRENCY || 1));
  const queue = [...messages];
  let processed = 0;

  async function worker() {
    while (queue.length > 0) {
      const msg = queue.shift();
      if (!msg) {
        continue;
      }

      try {
        await processEmail(gmail, msg.id, { userId });
        await markProcessedEmail(msg.id, { userId });
        processed += 1;
      } catch (error) {
        console.error(`[sync] message processing failed: gmailId=${msg.id}`, error.message);
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker());
  await Promise.all(workers);
  return processed;
}

async function fetchJobEmails(options = {}) {
  const userId = options.userId || null;

  // REQUIRE userId — no extraction without per-user context
  if (!userId) {
    console.log("[sync] skipped: userId required for per-user extraction");
    return;
  }

  // NEW: Use per-user lock key
  const lockKey = `sync_${userId}`;
  if (!acquireSyncLock(lockKey)) {
    console.log(`[sync] skipped: sync already in progress for user=${userId}`);
    return;
  }

  const forceInitialSync = options.mode === "initial";

  try {
    // NEW: Load tokens per-user (not global)
    const storedTokens = await getTokensByUser(userId);
    if (!storedTokens) {
      console.log("[sync] skipped: gmail not connected for user:", userId);
      releaseSyncLock(lockKey);
      return;
    }

    let activeTokens = storedTokens;
    try {
      activeTokens = await refreshTokensIfExpired(storedTokens, userId);
    } catch (error) {
      console.error("[sync] token refresh failed:", error.message);
      releaseSyncLock(lockKey);
      return;
    }

    const gmail = createGmailClient(activeTokens);
    const startedAt = Date.now();
    const previousLastChecked = await getLastChecked();
    const query = buildSyncQuery(previousLastChecked, forceInitialSync);

    try {
      const messages = [];
      let pageToken;
      let continuePaging = true;

      while (continuePaging) {
        const list = await withRetry(
          () =>
            withTimeout(
              () =>
                gmail.users.messages.list({
                  userId: "me",
                  q: query,
                  maxResults: env.GMAIL_SYNC_MAX_RESULTS_PER_PAGE,
                  pageToken,
                }),
              env.EXTERNAL_API_TIMEOUT_MS,
              "Gmail message list timed out"
            ),
          { retries: env.RETRY_ATTEMPTS }
        );

        const pageMessages = list.data.messages || [];
        messages.push(...pageMessages);
        pageToken = list.data.nextPageToken;

        if ((!previousLastChecked || forceInitialSync) && messages.length >= env.INITIAL_SYNC_MAX_MESSAGES) {
          continuePaging = false;
        } else if (!forceInitialSync && previousLastChecked && messages.length >= env.GMAIL_SYNC_MAX_RESULTS_PER_PAGE) {
          continuePaging = false;
        } else if (!pageToken) {
          continuePaging = false;
        }
      }

      const limitedMessages = (!previousLastChecked || forceInitialSync)
        ? messages.slice(0, env.INITIAL_SYNC_MAX_MESSAGES)
        : messages;
      const newMessages = [];
      for (const message of limitedMessages) {
        const processed = await isProcessedEmail(message.id, { userId });
        if (!processed) {
          newMessages.push(message);
        }
      }

      const processedCount = await processMessagesWithQueue(gmail, newMessages, { userId });

      const checkedAt = new Date().toISOString();
      await setLastChecked(checkedAt);

      const result = { scanned: limitedMessages.length, processed: processedCount };
      console.log(
        `[sync] completed for user=${userId}: scanned=${result.scanned}, processed=${result.processed}, queued=${newMessages.length}, query="${query}", durationMs=${Date.now() - startedAt}`
      );
      releaseSyncLock(lockKey, result);
    } catch (error) {
      console.error("[sync] failed:", error.message);
      releaseSyncLock(lockKey);
    }
  } catch (error) {
    console.error("[sync] unexpected error:", error.message);
    releaseSyncLock(lockKey);
  }
}

module.exports = {
  fetchJobEmails,
  backfillJobEmailsFromExistingJobs,
};
