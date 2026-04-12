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
const { logger } = require("../utils/logger");
const { oauth2Client, createGmailClient } = require("../integrations/gmail");
const { extractJobInfo } = require("./jobExtractor");
const { withRetry, withTimeout } = require("../utils/asyncTools");
const { acquireSyncLock, releaseSyncLock } = require("./syncState");
const { env, getGmailSyncQueryBase } = require("../config/env");
const { decryptToken } = require("../utils/encryption");
const { query: dbQuery } = require("./dbAdapter");

const STATUS_PROGRESSION = ["Wishlist", "Applied", "Screening", "Interview", "Offer", "Rejected"];

/**
 * Helper function to get user's role/tier from database
 * Returns role string or "free" as default fallback
 */
async function getUserRole(userId) {
  if (!userId) return "free";
  try {
    const result = await dbQuery(
      `SELECT role FROM user_plans WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (result.rows && result.rows.length > 0) {
      return result.rows[0].role || "free";
    }
  } catch (error) {
    logger.warn("Failed to get user role, using default", { userId, error: error.message });
  }
  return "free";
}

async function refreshTokensIfExpired(tokens, userId) {
  if (!tokens) {
    return tokens;
  }

  const expiryMs =
    Number(tokens.expiry_date) ||
    (tokens.expires_at ? new Date(tokens.expires_at).getTime() : null);

  if (!expiryMs || expiryMs >= Date.now()) {
    return tokens;
  }

  try {
    await refreshTokenIfExpiredForUser(userId);
    // After refresh, fetch the updated tokens
    const updatedTokens = await getTokensByUser(userId);
    logger.info("Refreshed Gmail OAuth token", { userId });
    return updatedTokens;
  } catch (error) {
    logger.error("Token refresh failed in decryptStoredTokens", { error: error.message });
    throw error;
  }
}

function maybeDecryptStoredToken(value) {
  if (!value || typeof value !== "string") {
    return value || null;
  }
  try {
    return decryptToken(value);
  } catch {
    // Backward compatibility: older rows may already be plaintext.
    return value;
  }
}

function normalizeOauthTokensForGoogle(storedTokens) {
  if (!storedTokens || typeof storedTokens !== "object") {
    return null;
  }

  const accessToken = maybeDecryptStoredToken(storedTokens.access_token || storedTokens.accessToken);
  const refreshToken = maybeDecryptStoredToken(storedTokens.refresh_token || storedTokens.refreshToken);
  const expiryDate =
    Number(storedTokens.expiry_date) ||
    (storedTokens.expires_at ? new Date(storedTokens.expires_at).getTime() : undefined);

  return {
    ...storedTokens,
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
  };
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

  if (
    /\bschedule[d]? (?:an? |your )?interview\b|\binvit(?:e|ed) (?:you )?(?:to |for )?(?:an? )?interview\b/.test(normalizedSubject)
  ) {
    return "Interview Scheduled";
  }

  if (/\bjob offer\b|\boffer letter\b|\bextend (?:you )?(?:an? )?offer\b/.test(normalizedSubject)) {
    return "Offer";
  }

  if (
    /\bnot moving forward\b|\bnot selected\b|\bposition filled\b|\bwe will not be proceeding\b/.test(normalizedSubject)
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
    normalizedFrom.includes("icims") ||
    normalizedFrom.includes("notifications@")
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

/**
 * Parse an email Date header into a YYYY-MM-DD string preserving the
 * local date from the header (avoids UTC shift that moves April 9 10PM EST
 * to April 10 in UTC).
 */
function parseLocalDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

/**
 * Tiered matching: find the best existing job for an incoming email extraction.
 * Tier 1: exact emailId (already handled before this is called)
 * Tier 2: company + role exact match
 * Tier 3: company + role fuzzy (substring)
 * Tier 4: company-only match (only if exactly 1 job at that company)
 * Tier 5: sender domain matches recruiterEmail domain on a single company job
 */
function findMatchingJob(jobs, extracted, fromEmail) {
  const newCompany = normalizeKeyValue(extracted.company);
  if (!newCompany) return null;

  const newRole = normalizeKeyValue(extracted.role);

  // Tier 2: exact company + role
  if (newRole) {
    const exact = jobs.find(
      (j) => normalizeKeyValue(j.company) === newCompany && normalizeKeyValue(j.role) === newRole
    );
    if (exact) return exact;

    // Tier 3: company matches, role is a substring of the other
    const fuzzy = jobs.find((j) => {
      const jCompany = normalizeKeyValue(j.company);
      const jRole = normalizeKeyValue(j.role);
      if (jCompany !== newCompany || !jRole) return false;
      return jRole.includes(newRole) || newRole.includes(jRole);
    });
    if (fuzzy) return fuzzy;
  }

  // Tier 4: company-only (safe only when exactly 1 job at that company)
  const companyJobs = jobs.filter((j) => normalizeKeyValue(j.company) === newCompany);
  if (companyJobs.length === 1) return companyJobs[0];

  // Tier 5: sender domain matches an existing job's recruiterEmail domain
  if (fromEmail && companyJobs.length > 1) {
    const domain = (fromEmail.split("@")[1] || "").toLowerCase();
    if (domain) {
      const domainMatch = companyJobs.find(
        (j) => j.recruiterEmail && j.recruiterEmail.toLowerCase().includes(domain)
      );
      if (domainMatch) return domainMatch;
    }
  }

  return null;
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

/**
 * Gmail search date for incremental sync: day before last sync (UTC) to reduce edge misses at midnight.
 * @param {string} iso
 * @returns {string|null} YYYY/MM/DD
 */
function formatGmailAfterDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/**
 * Initial / forced: keyword query + newer_than:Nd (wide backfill).
 * Incremental: same keywords + after:YYYY/MM/DD from per-user last_checked.
 * @param {number|null|undefined} lookbackDaysOverride - 1-365 for newer_than when forceInitialSync
 */
function buildSyncQuery(lastChecked, forceInitialSync = false, lookbackDaysOverride = null) {
  const base = getGmailSyncQueryBase();
  if (forceInitialSync || !lastChecked) {
    let days = env.INITIAL_SYNC_LOOKBACK_DAYS;
    if (lookbackDaysOverride != null && Number.isFinite(Number(lookbackDaysOverride))) {
      days = Math.min(365, Math.max(1, Math.floor(Number(lookbackDaysOverride))));
    }
    return `${base} newer_than:${days}d`;
  }

  const after = formatGmailAfterDate(lastChecked);
  if (!after) {
    return `${base} newer_than:${env.DAILY_SYNC_LOOKBACK_DAYS}d`;
  }

  return `${base} after:${after}`;
}

async function processEmail(gmail, messageId, options = {}) {
  const userId = options.userId || null;
  const userRole = options.userRole || "free";
  const { subject, from, date, body } = await fetchMessageDetails(gmail, messageId);
  const { fromName, fromEmail } = parseSender(from);
  const originalBody = String(body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const displayBody = cleanEmailBodyForDisplay(originalBody);
  const compactBody = compactForExtraction(originalBody);
  const preview = compactForExtraction(displayBody).slice(0, 180);

  if (!compactBody || compactBody.length < 12) {
    if (options.stats) {
      options.stats.skippedShortBody += 1;
    }
    return;
  }

  const extracted = await extractJobInfo({
    subject,
    from,
    date,
    body: compactBody.slice(0, 3000),
    userRole,
    syncMode: options.syncMode || "daily",
    syncLookbackDays:
      options.syncLookbackDays != null && Number.isFinite(Number(options.syncLookbackDays))
        ? Math.min(365, Math.max(1, Math.floor(Number(options.syncLookbackDays))))
        : null,
  });

  if (options.stats) {
    if (extracted?.extractionSource === "model") {
      options.stats.extractionModel += 1;
    } else if (extracted?.extractionSource === "fallback") {
      options.stats.extractionFallback += 1;
    }
  }

  logger.debug("Email extraction result", {
    messageId,
    subject: subject.slice(0, 50),
    isJobRelated: extracted?.isJobRelated,
    company: extracted?.company,
    role: extracted?.role,
  });

  if (!extracted || !extracted.isJobRelated) {
    if (options.stats) {
      options.stats.skippedNotJobRelated += 1;
    }
    logger.debug("Email not job-related, skipping", { messageId, subject: subject.slice(0, 50) });
    return;
  }

  if (!extracted.appliedDate) {
    extracted.appliedDate = parseLocalDate(date);
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

  // Tier 1: exact Gmail message ID match (reprocessing the same email)
  const jobByEmailId = jobs.find((job) => job.emailId === messageId);
  if (jobByEmailId) {
    await updateJobStatus(jobByEmailId, extracted, emailPayload, { userId });
    if (options.stats) {
      options.stats.jobsUpdated += 1;
    }
    logger.info("Job updated (emailId match)", { jobId: jobByEmailId.id, company: jobByEmailId.company });
    return;
  }

  // Tier 2-5: smart matching by company/role/sender
  const matchedJob = findMatchingJob(jobs, extracted, fromEmail);
  if (matchedJob) {
    await updateJobStatus(matchedJob, extracted, emailPayload, { userId });
    if (options.stats) {
      options.stats.jobsUpdated += 1;
    }
    logger.info("Job updated (smart match)", {
      jobId: matchedJob.id,
      existingCompany: matchedJob.company,
      existingRole: matchedJob.role,
      incomingCompany: extracted.company,
      incomingRole: extracted.role,
      statusBefore: matchedJob.status,
      statusAfter: extracted.status,
    });
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
  if (options.stats) {
    options.stats.jobsCreated += 1;
  }
  logger.info("Job created (new)", { company: extracted.company, role: extracted.role });
}

async function backfillJobEmailsFromExistingJobs(options = {}) {
  const userId = options.userId || null;
  
  if (!userId) {
    logger.warn("Backfill skipped: userId required");
    return { updated: 0, scanned: 0 };
  }

  const tokens = await getTokensByUser(userId);
  if (!tokens) {
    logger.warn("Backfill skipped: gmail not connected", { userId });
    return { updated: 0, scanned: 0 };
  }

  const gmail = createGmailClient(normalizeOauthTokensForGoogle(tokens));
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
      logger.error("Backfill failed for job", { jobId: job.id, error: error.message });
    }
  }

  return { updated, scanned };
}

async function processMessagesWithQueue(gmail, messages, options = {}) {
  const userId = options.userId || null;
  const userRole = await getUserRole(userId);
  const forceReprocess = Boolean(options.forceReprocess);
  const syncMode = options.syncMode === "initial" ? "initial" : "daily";
  const syncLookbackDays =
    options.syncLookbackDays != null && Number.isFinite(Number(options.syncLookbackDays))
      ? Math.min(365, Math.max(1, Math.floor(Number(options.syncLookbackDays))))
      : null;
  const concurrency = Math.max(1, Number(env.SYNC_PROCESSING_CONCURRENCY || 1));
  const queue = [...messages];
  let processed = 0;
  const stats = {
    skippedShortBody: 0,
    skippedNotJobRelated: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    messageErrors: 0,
    extractionModel: 0,
    extractionFallback: 0,
  };

  async function worker() {
    while (queue.length > 0) {
      const msg = queue.shift();
      if (!msg) {
        continue;
      }

      try {
        await processEmail(gmail, msg.id, { userId, userRole, stats, syncMode, syncLookbackDays });
        // Keep historical behavior by default; allow force mode to reprocess previously-seen IDs.
        if (!forceReprocess) {
          await markProcessedEmail(msg.id, { userId });
        }
        processed += 1;
      } catch (error) {
        stats.messageErrors += 1;
        logger.error("Message processing failed", { gmailId: msg.id, error: error.message });
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, Number(env.SYNC_INTER_MESSAGE_DELAY_MS) || 0))
      );
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker());
  await Promise.all(workers);
  return { processed, debug: stats };
}

async function fetchJobEmails(options = {}) {
  const userId = options.userId || null;
  const forceReprocess = Boolean(options.forceReprocess);
  const processAll = Boolean(options.processAll);

  // REQUIRE userId — no extraction without per-user context
  if (!userId) {
    logger.warn("Sync skipped: userId required");
    return;
  }

  // NEW: Use per-user lock key
  const lockKey = `sync_${userId}`;
  if (!acquireSyncLock(lockKey)) {
    logger.info("Sync already in progress", { userId });
    return;
  }

  const forceInitialSync = options.mode === "initial";
  const lookbackDays =
    options.lookbackDays != null && Number.isFinite(Number(options.lookbackDays))
      ? Math.min(365, Math.max(1, Math.floor(Number(options.lookbackDays))))
      : null;
  const syncMode = forceInitialSync ? "initial" : "daily";

  try {
    // NEW: Load tokens per-user (not global)
    const storedTokens = await getTokensByUser(userId);
    if (!storedTokens) {
      logger.warn("Sync skipped: gmail not connected", { userId });
      releaseSyncLock(lockKey);
      return;
    }

    let activeTokens = storedTokens;
    try {
      activeTokens = await refreshTokensIfExpired(storedTokens, userId);
    } catch (error) {
      logger.error("Sync token refresh failed", { error: error.message });
      releaseSyncLock(lockKey, { scanned: 0, processed: 0, error: `token_refresh_failed: ${error.message}` });
      return;
    }

    const gmail = createGmailClient(normalizeOauthTokensForGoogle(activeTokens));
    const startedAt = Date.now();
    const previousLastChecked = await getLastChecked(userId);
    const query = buildSyncQuery(previousLastChecked, forceInitialSync, lookbackDays);

    const maxInitial = env.INITIAL_SYNC_MAX_MESSAGES;
    const maxIncremental = env.INCREMENTAL_SYNC_MAX_MESSAGES;

    try {
      const messages = [];
      let pageToken;
      let continuePaging = true;
      let nextPageTokenAfterLastFetch = null;

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
        nextPageTokenAfterLastFetch = pageToken || null;

        const cap = processAll
          ? 5000
          : (!previousLastChecked || forceInitialSync ? maxInitial : maxIncremental);
        if ((!processAll && messages.length >= cap) || !pageToken) {
          continuePaging = false;
        }
      }

      const cap = processAll
        ? 5000
        : (!previousLastChecked || forceInitialSync ? maxInitial : maxIncremental);
      const limitedMessages = processAll ? messages : messages.slice(0, cap);
      const hasMoreGmailResults = !processAll && Boolean(nextPageTokenAfterLastFetch);
      if (hasMoreGmailResults) {
        logger.warn(
          "Gmail sync listed messages up to cap; more matching mail exists in Gmail (raise INITIAL_SYNC_MAX_MESSAGES or narrow GMAIL_SYNC_QUERY)",
          { userId, cap, listed: messages.length, processedBatch: limitedMessages.length, query }
        );
      }
      const newMessages = [];
      for (const message of limitedMessages) {
        if (forceReprocess) {
          newMessages.push(message);
          continue;
        }
        const processed = await isProcessedEmail(message.id, { userId });
        if (!processed) {
          newMessages.push(message);
        }
      }

      if (limitedMessages.length === 0) {
        logger.warn("Gmail sync found zero messages for query (check keywords and date window)", {
          userId,
          query,
          previousLastChecked,
          forceInitialSync,
        });
      }

      const { processed: processedCount, debug: syncDebug } = await processMessagesWithQueue(
        gmail,
        newMessages,
        { userId, forceReprocess, syncMode, syncLookbackDays: lookbackDays }
      );

      const checkedAt = new Date().toISOString();
      if (limitedMessages.length > 0) {
        await setLastChecked(userId, checkedAt);
      } else {
        logger.info("Gmail sync did not advance lastChecked (zero messages listed)", {
          userId,
          query,
          forceInitialSync,
        });
      }

      const result = {
        scanned: limitedMessages.length,
        processed: processedCount,
        queued: newMessages.length,
        debug: syncDebug,
        hasMoreGmailResults,
        messageCap: processAll ? null : cap,
        processAll,
        lookbackDays: lookbackDays ?? undefined,
        lastCheckedUpdated: limitedMessages.length > 0,
      };
      logger.info("Sync completed", {
        userId,
        scanned: result.scanned,
        processed: result.processed,
        queued: result.queued,
        debug: syncDebug,
        hasMoreGmailResults,
        messageCap: processAll ? null : cap,
        processAll,
        lookbackDays,
        lastCheckedUpdated: result.lastCheckedUpdated,
        query,
        forceReprocess,
        durationMs: Date.now() - startedAt,
      });
      releaseSyncLock(lockKey, result);
    } catch (error) {
      logger.error("Sync failed", { error: error.message });
      releaseSyncLock(lockKey, { scanned: 0, processed: 0, error: error.message, query });
    }
  } catch (error) {
    logger.error("Sync unexpected error", { error: error.message });
    releaseSyncLock(lockKey, { scanned: 0, processed: 0, error: `unexpected: ${error.message}` });
  }
}

module.exports = {
  fetchJobEmails,
  backfillJobEmailsFromExistingJobs,
};
