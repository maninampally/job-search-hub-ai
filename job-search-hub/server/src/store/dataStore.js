const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");

const localStorePath = path.resolve(__dirname, "../../data/local-store.json");

function createInitialMemory() {
  return {
    tokens: null,
    userTokens: {},  // NEW: per-user token storage
    jobs: [],
    emailsByJob: {},
    statusTimelineByJob: {},
    resumes: [],
    lastChecked: null,
    processedIds: new Set(),
  };
}

function loadLocalMemory() {
  try {
    if (!fs.existsSync(localStorePath)) {
      return createInitialMemory();
    }

    const raw = fs.readFileSync(localStorePath, "utf-8");
    const parsed = JSON.parse(raw);

    const parsedJobs = Array.isArray(parsed.jobs)
      ? parsed.jobs.map((job) => ({
          ...job,
          emails: Array.isArray(job.emails) ? job.emails : [],
        }))
      : [];

    const parsedEmailsByJob =
      parsed.emailsByJob && typeof parsed.emailsByJob === "object"
        ? parsed.emailsByJob
        : {};
    const parsedTimelineByJob =
      parsed.statusTimelineByJob && typeof parsed.statusTimelineByJob === "object"
        ? parsed.statusTimelineByJob
        : {};

    for (const job of parsedJobs) {
      if (Array.isArray(job.emails) && job.emails.length > 0) {
        parsedEmailsByJob[job.id] = job.emails;
      }
    }

    const parsedResumes = Array.isArray(parsed.resumes)
      ? parsed.resumes.map((resume) => ({
          ...resume,
          fileBuffer: null, // Re-loaded from upload when needed
        }))
      : [];

    const parsedUserTokens =
      parsed.userTokens && typeof parsed.userTokens === "object"
        ? parsed.userTokens
        : {};

    return {
      tokens: parsed.tokens || null,
      userTokens: parsedUserTokens,  // NEW: load per-user tokens
      jobs: parsedJobs,
      emailsByJob: parsedEmailsByJob,
      statusTimelineByJob: parsedTimelineByJob,
      resumes: parsedResumes,
      lastChecked: parsed.lastChecked || null,
      processedIds: new Set(Array.isArray(parsed.processedIds) ? parsed.processedIds : []),
    };
  } catch {
    return createInitialMemory();
  }
}

function saveLocalMemory(memory) {
  try {
    const dir = path.dirname(localStorePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Don't save file buffers - they're too large
    const resumesForStorage = (memory.resumes || []).map((r) => ({
      id: r.id,
      name: r.name,
      fileName: r.fileName,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      uploadedAt: r.uploadedAt,
      linkedJobId: r.linkedJobId,
      version: r.version,
      updatedAt: r.updatedAt,
    }));

    fs.writeFileSync(
      localStorePath,
      JSON.stringify(
        {
          tokens: memory.tokens,
          userTokens: memory.userTokens,  // NEW: save per-user tokens
          jobs: memory.jobs,
          emailsByJob: memory.emailsByJob,
          statusTimelineByJob: memory.statusTimelineByJob,
          resumes: resumesForStorage,
          lastChecked: memory.lastChecked,
          processedIds: Array.from(memory.processedIds),
        },
        null,
        2
      )
    );
  } catch {
    // Best-effort local persistence.
  }
}

const memory = {
  ...loadLocalMemory(),
};

function filterByOwner(rows, userId) {
  if (!userId) {
    return rows;
  }
  return (rows || []).filter((row) => row && row.ownerUserId === userId);
}

async function addStatusChange(jobId, fromStatus, toStatus, trigger = "manual", options = {}) {
  const userId = options.userId || null;
  if (!jobId || !toStatus) return;

  if (supabase) {
    try {
      const response = await supabase.from("job_status_timeline").insert({
        job_id:      jobId,
        owner_user_id: userId,
        from_status: fromStatus || null,
        to_status:   toStatus,
        trigger,
        changed_at:  new Date().toISOString(),
      });
      validateSupabaseResponse(response, `addStatusChange for job ${jobId}`);
    } catch (error) {
      logger.error("addStatusChange Supabase query failed", { jobId, error: error.message });
      throw error;
    }
    return;
  }

  // local JSON fallback
  if (!memory.statusTimelineByJob) memory.statusTimelineByJob = {};
  const current = Array.isArray(memory.statusTimelineByJob[jobId])
    ? memory.statusTimelineByJob[jobId]
    : [];
  memory.statusTimelineByJob[jobId] = [
    ...current,
    {
      id:         `timeline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ownerUserId: userId,
      fromStatus: fromStatus || null,
      toStatus,
      trigger,
      changedAt:  new Date().toISOString(),
    },
  ];
  saveLocalMemory(memory);
}

async function getJobStatusTimeline(jobId, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase
      .from("job_status_timeline")
      .select("*")
      .eq("job_id", jobId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { data, error } = await query.order("changed_at", { ascending: true });
    if (error) throw error;

    if (data && data.length > 0) {
      return data.map((row) => ({
        id:         row.id,
        fromStatus: row.from_status,
        toStatus:   row.to_status,
        trigger:    row.trigger,
        changedAt:  row.changed_at,
      }));
    }
  }

  // local JSON fallback
  const entries = memory.statusTimelineByJob?.[jobId];
  if (!Array.isArray(entries)) {
    return [];
  }
  return userId ? entries.filter((entry) => entry.ownerUserId === userId) : entries;
}

const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = hasSupabase
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

/**
 * Validate Supabase query response structure
 * Throws meaningful error if response is malformed
 */
function validateSupabaseResponse(response, operationName = "database operation") {
  if (!response) {
    throw new Error(`${operationName}: Supabase returned null response`);
  }
  
  const { data, error } = response;
  
  if (error) {
    logger.error("Supabase query error", { operation: operationName, error: error.message });
    throw error;
  }
  
  return data;
}

async function getTokens() {
  if (!supabase) {
    return memory.tokens;
  }

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("access_token,refresh_token,scope,token_type,expiry_date")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || !data.access_token) {
    return null;
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    scope: data.scope,
    token_type: data.token_type,
    expiry_date: data.expiry_date,
  };
}

async function getLinkedUserId() {
  if (!supabase) {
    return memory.linkedUserId || null;
  }

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("owner_user_id")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data?.owner_user_id || null;
}

async function setTokens(tokens, options = {}) {
  const userId = options.userId || null;
  if (!supabase) {
    memory.tokens = tokens;
    if (userId) memory.linkedUserId = userId;
    saveLocalMemory(memory);
    return;
  }

  const { error } = await supabase.from("oauth_tokens").upsert(
    {
      id: 1,
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      scope: tokens.scope || null,
      token_type: tokens.token_type || null,
      expiry_date: tokens.expiry_date || null,
      ...(userId ? { owner_user_id: userId } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

async function clearTokens() {
  if (!supabase) {
    memory.tokens = null;
    saveLocalMemory(memory);
    return;
  }

  const { error } = await supabase.from("oauth_tokens").upsert(
    {
      id: 1,
      access_token: null,
      refresh_token: null,
      scope: null,
      token_type: null,
      expiry_date: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

/**
 * Last successful Gmail job sync time for this user (stored on oauth_tokens).
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getLastChecked(userId) {
  if (!userId) {
    return null;
  }

  if (!supabase) {
    const row = memory.userTokens?.[userId];
    return row?.last_checked || null;
  }

  try {
    const { data, error } = await supabase
      .from("oauth_tokens")
      .select("last_checked")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (error) {
      return null;
    }

    return data?.last_checked || null;
  } catch {
    return null;
  }
}

/**
 * @param {string} userId
 * @param {string|null} lastChecked ISO string or null (e.g. on Gmail disconnect)
 */
async function setLastChecked(userId, lastChecked) {
  if (!userId) {
    return;
  }

  if (!supabase) {
    memory.userTokens = memory.userTokens || {};
    if (!memory.userTokens[userId]) {
      memory.userTokens[userId] = {};
    }
    memory.userTokens[userId].last_checked = lastChecked;
    saveLocalMemory(memory);
    return;
  }

  const { error } = await supabase
    .from("oauth_tokens")
    .update({
      last_checked: lastChecked,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", userId);

  if (error) {
    logger.error("setLastChecked failed", { userId, error: error.message });
  }
}

async function getJobs(options = {}) {
  const userId = options.userId || null;
  if (!supabase) {
    return filterByOwner(memory.jobs, userId).map((job) => ({
      ...job,
      emails: Array.isArray(job.emails) ? job.emails : [],
    }));
  }

  let query = supabase
    .from("jobs")
    .select("*");
  if (userId) {
    query = query.eq("owner_user_id", userId);
  }
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    emailId: row.email_id,
    company: row.company,
    role: row.role,
    status: row.status,
    location: row.location,
    recruiterName: row.recruiter_name,
    recruiterEmail: row.recruiter_email,
    appliedDate: row.applied_date,
    notes: row.notes,
    nextStep: row.next_step,
    imported: row.imported,
    source: row.source,
    createdAt: row.created_at,
    ownerUserId: row.owner_user_id || null,
    emails: Array.isArray(memory.emailsByJob[row.id])
      ? memory.emailsByJob[row.id]
      : Array.isArray(row.emails)
        ? row.emails
        : [],
  }));
}

async function addJob(job, options = {}) {
  const userId = options.userId || null;
  if (!supabase) {
    const normalizedJob = {
      ...job,
      ownerUserId: userId,
      emails: Array.isArray(job.emails) ? job.emails : [],
    };

    memory.jobs.push(normalizedJob);
    await addStatusChange(normalizedJob.id, null, normalizedJob.status || "Applied", "manual", { userId });
    saveLocalMemory(memory);
    return;
  }

  memory.emailsByJob[job.id] = Array.isArray(job.emails) ? job.emails : [];
  const { error } = await supabase.from("jobs").insert({
    id: job.id,
    email_id: job.emailId || null,
    company: job.company || null,
    role: job.role || null,
    status: job.status || "Applied",
    location: job.location || null,
    recruiter_name: job.recruiterName || null,
    recruiter_email: job.recruiterEmail || null,
    applied_date: job.appliedDate || null,
    notes: job.notes || null,
    next_step: job.nextStep || null,
    imported: Boolean(job.imported),
    source: job.source || "gmail",
    owner_user_id: userId,
    created_at: job.createdAt || new Date().toISOString(),
  });

  if (error) {
    const message = String(error.message || "");
    const duplicateEmailId = message.includes("jobs_email_id_key") || message.includes("duplicate key value");

    // Existing row for same email_id: update the existing job instead of failing sync.
    if (duplicateEmailId && job.emailId) {
      const { data: existing, error: lookupError } = await supabase
        .from("jobs")
        .select("id,status")
        .eq("email_id", job.emailId)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existing?.id) {
        await updateJob(
          existing.id,
          {
            company: job.company || null,
            role: job.role || null,
            status: job.status || "Applied",
            location: job.location || null,
            recruiterName: job.recruiterName || null,
            recruiterEmail: job.recruiterEmail || null,
            appliedDate: job.appliedDate || null,
            notes: job.notes || null,
            nextStep: job.nextStep || null,
            source: job.source || "gmail",
          },
          { userId }
        );
        saveLocalMemory(memory);
        return;
      }
    }

    throw error;
  }

  // Insert timeline row only after the job exists to satisfy FK constraints.
  await addStatusChange(job.id, null, job.status || "Applied", "manual", { userId });
  saveLocalMemory(memory);
}

async function updateJob(jobId, partialJob, options = {}) {
  const userId = options.userId || null;
  const existingJobs = await getJobs({ userId });
  const previousJob = existingJobs.find((job) => job.id === jobId);

  if (!supabase) {
    memory.jobs = memory.jobs.map((job) =>
      job.id === jobId
        ? {
            ...job,
            ...partialJob,
            emails:
              partialJob.emails !== undefined
                ? Array.isArray(partialJob.emails)
                  ? partialJob.emails
                  : []
                : Array.isArray(job.emails)
                  ? job.emails
                  : [],
          }
        : job
    );

    if (partialJob.emails !== undefined) {
      memory.emailsByJob[jobId] = Array.isArray(partialJob.emails) ? partialJob.emails : [];
    }

    if (partialJob.status !== undefined && previousJob && previousJob.status !== partialJob.status) {
      await addStatusChange(jobId, previousJob.status || null, partialJob.status, "manual", { userId });
    }

    saveLocalMemory(memory);
    return;
  }

  if (partialJob.emails !== undefined) {
    memory.emailsByJob[jobId] = Array.isArray(partialJob.emails) ? partialJob.emails : [];
    saveLocalMemory(memory);
  }

  if (partialJob.status !== undefined && previousJob && previousJob.status !== partialJob.status) {
    await addStatusChange(jobId, previousJob.status || null, partialJob.status, "manual", { userId });
  }

  const patch = {};
  if (partialJob.company !== undefined) patch.company = partialJob.company;
  if (partialJob.role !== undefined) patch.role = partialJob.role;
  if (partialJob.status !== undefined) patch.status = partialJob.status;
  if (partialJob.location !== undefined) patch.location = partialJob.location;
  if (partialJob.recruiterName !== undefined) patch.recruiter_name = partialJob.recruiterName;
  if (partialJob.recruiterEmail !== undefined) patch.recruiter_email = partialJob.recruiterEmail;
  if (partialJob.appliedDate !== undefined) patch.applied_date = partialJob.appliedDate;
  if (partialJob.notes !== undefined) patch.notes = partialJob.notes;
  if (partialJob.nextStep !== undefined) patch.next_step = partialJob.nextStep;
  if (partialJob.imported !== undefined) patch.imported = partialJob.imported;
  if (partialJob.source !== undefined) patch.source = partialJob.source;
  if (partialJob.attachedResumeId !== undefined) patch.attached_resume_id = partialJob.attachedResumeId;

  let query = supabase.from("jobs").update(patch).eq("id", jobId);
  if (userId) {
    query = query.eq("owner_user_id", userId);
  }
  const { error } = await query;
  if (error) {
    throw error;
  }
}

async function deleteJob(jobId, options = {}) {
  const userId = options.userId || null;
  if (!supabase) {
    memory.jobs = memory.jobs.filter((job) => {
      if (job.id !== jobId) {
        return true;
      }
      return userId ? job.ownerUserId !== userId : false;
    });
    delete memory.emailsByJob[jobId];
    delete memory.statusTimelineByJob[jobId];
    saveLocalMemory(memory);
    return;
  }

  delete memory.emailsByJob[jobId];
  delete memory.statusTimelineByJob[jobId];
  saveLocalMemory(memory);

  let query = supabase.from("jobs").delete().eq("id", jobId);
  if (userId) {
    query = query.eq("owner_user_id", userId);
  }
  const { error } = await query;
  if (error) {
    throw error;
  }
}

async function markJobImported(jobId, options = {}) {
  const userId = options.userId || null;
  if (!supabase) {
    memory.jobs = memory.jobs.map((job) =>
      job.id === jobId && (!userId || job.ownerUserId === userId) ? { ...job, imported: true } : job
    );
    saveLocalMemory(memory);
    return;
  }

  let query = supabase
    .from("jobs")
    .update({ imported: true })
    .eq("id", jobId);
  if (userId) {
    query = query.eq("owner_user_id", userId);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
}

async function isProcessedEmail(messageId, options = {}) {
  const userId = options.userId || null;
  if (!supabase) {
    return memory.processedIds.has(userId ? `${userId}:${messageId}` : messageId);
  }

  let query = supabase
    .from("processed_emails")
    .select("gmail_id")
    .eq("gmail_id", messageId);
  if (userId) {
    query = query.eq("owner_user_id", userId);
  }
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.gmail_id);
}

async function markProcessedEmail(messageId, options = {}) {
  const userId = options.userId || null;
  if (!supabase) {
    memory.processedIds.add(userId ? `${userId}:${messageId}` : messageId);
    saveLocalMemory(memory);
    return;
  }

  const row = {
    owner_user_id: userId,
    gmail_id: messageId,
    processed_at: new Date().toISOString(),
  };

  let { error } = await supabase.from("processed_emails").upsert(row, {
    onConflict: "owner_user_id,gmail_id",
  });

  if (error && String(error.message || "").includes("no unique or exclusion constraint")) {
    const retry = await supabase.from("processed_emails").upsert(row, {
      onConflict: "gmail_id",
    });
    error = retry.error || null;
  }

  if (error) {
    throw error;
  }
}

// Convert a Supabase job_emails row to the shape the rest of the app expects
function rowToEmail(row) {
  return {
    id: row.id,
    gmailId: row.gmail_id || "",
    from: row.sender || "",
    fromName: row.sender_name || "",
    subject: row.subject || "",
    preview: row.preview || "",
    body: row.body_text || "",
    date: row.received_at || row.created_at,
    type: row.email_type || "Auto / Tracking",
    isReal: Boolean(row.is_real),
    isRead: Boolean(row.is_read),
  };
}

async function saveJobEmail(jobId, email) {
  if (!supabase) {
    // Fall through to local-JSON path below
    return null;
  }

  const gmailId = email.gmailId || null;

  const row = {
    job_id: jobId,
    owner_user_id: email.ownerUserId || null,
    gmail_id: gmailId,
    subject: email.subject || null,
    sender: email.from || null,
    sender_name: email.fromName || null,
    body_text: email.body || null,
    preview: email.preview || null,
    received_at: email.date || new Date().toISOString(),
    email_type: email.type || "Auto / Tracking",
    is_real: Boolean(email.isReal),
    is_read: Boolean(email.isRead),
  };

  if (gmailId) {
    // Partial unique index uidx_job_emails_owner_gmail breaks PostgREST upsert onConflict; use explicit write path.
    const ownerId = email.ownerUserId || null;
    let query = supabase.from("job_emails").select("id").eq("gmail_id", gmailId);
    if (ownerId) {
      query = query.eq("owner_user_id", ownerId);
    }
    const { data: existingRow, error: selErr } = await query.maybeSingle();
    if (selErr) {
      throw selErr;
    }

    if (existingRow?.id) {
      const { error: upErr } = await supabase
        .from("job_emails")
        .update({
          job_id: row.job_id,
          subject: row.subject,
          sender: row.sender,
          sender_name: row.sender_name,
          body_text: row.body_text,
          preview: row.preview,
          received_at: row.received_at,
          email_type: row.email_type,
          is_real: row.is_real,
          is_read: row.is_read,
        })
        .eq("id", existingRow.id);
      if (upErr) {
        throw upErr;
      }
    } else {
      const { error: insErr } = await supabase.from("job_emails").insert(row);
      if (insErr) {
        throw insErr;
      }
    }
  } else {
    const { error } = await supabase.from("job_emails").insert(row);
    if (error) throw error;
  }
}

async function getEmailByGmailId(gmailId) {
  if (!supabase || !gmailId) return null;

  const { data, error } = await supabase
    .from("job_emails")
    .select("*")
    .eq("gmail_id", gmailId)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToEmail(data) : null;
}

async function getJobEmails(jobId, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase
      .from("job_emails")
      .select("*")
      .eq("job_id", jobId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { data, error } = await query.order("received_at", { ascending: true });

    if (error) throw error;

    // If Supabase has rows, return them
    if (data && data.length > 0) {
      return data.map(rowToEmail);
    }
  }

  // Fallback: local JSON (backward compat with existing data)
  const localEmails = memory.emailsByJob?.[jobId];
  if (Array.isArray(localEmails) && localEmails.length > 0) {
    return localEmails;
  }

  // Check if job exists at all
  const jobs = await getJobs({ userId });
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return null;

  return [];
}

async function addJobEmail(jobId, email, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    // Verify job exists
    const jobs = await getJobs({ userId });
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return null;

    await saveJobEmail(jobId, { ...email, ownerUserId: userId });

    // Return updated list from Supabase
    return getJobEmails(jobId, { userId });
  }

  // --- local JSON path (no Supabase) ---
  const jobs = await getJobs({ userId });
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return null;

  const existingEmails = Array.isArray(job.emails) ? job.emails : [];
  const emailGmailId = email.gmailId || null;

  const duplicateIndex = existingEmails.findIndex((item) => {
    if (emailGmailId && item.gmailId) return item.gmailId === emailGmailId;
    return item.id === email.id;
  });

  if (duplicateIndex >= 0) {
    const current = existingEmails[duplicateIndex] || {};
    const merged = {
      ...current,
      ...email,
      body: String(email.body || "").trim() ? email.body : current.body,
      preview: String(email.preview || "").trim() ? email.preview : current.preview,
      isRead: Boolean(current.isRead || email.isRead),
    };

    const nextEmails = [...existingEmails];
    nextEmails[duplicateIndex] = merged;
    nextEmails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    await updateJob(jobId, { emails: nextEmails }, { userId });
    return nextEmails;
  }

  const nextEmails = [...existingEmails, email].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  await updateJob(jobId, { emails: nextEmails }, { userId });
  return nextEmails;
}

// Resume Management Methods

function sbResumeToMeta(row) {
  return {
    id: row.id,
    name: row.file_name,
    fileName: row.original_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    uploadedAt: row.uploaded_at,
    linkedJobId: row.job_id || null,
    isPrimary: row.is_primary,
    version: 1,
    updatedAt: row.updated_at,
    // fileBuffer intentionally absent — files live on disk
  };
}

async function getResumes(filters = {}, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase.from("resumes").select("*").order("uploaded_at", { ascending: false });
    if (userId) query = query.eq("owner_user_id", userId);
    if (filters.jobId) query = query.eq("job_id", filters.jobId);
    if (filters.name)  query = query.ilike("file_name", `%${filters.name}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(sbResumeToMeta);
  }
  // local JSON fallback
  let resumes = filterByOwner(memory.resumes || [], userId);
  if (filters.jobId) resumes = resumes.filter((r) => r.linkedJobId === filters.jobId);
  if (filters.name)  resumes = resumes.filter((r) => r.name.toLowerCase().includes(filters.name.toLowerCase()));
  return resumes;
}

async function addResume(resumeMetadata, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    const { data, error } = await supabase
      .from("resumes")
      .insert({
        owner_user_id: userId,
        job_id:        resumeMetadata.linkedJobId || null,
        file_name:     resumeMetadata.name,
        original_name: resumeMetadata.fileName,
        file_path:     resumeMetadata.filePath,
        file_size:     resumeMetadata.fileSize,
        mime_type:     resumeMetadata.mimeType,
        is_primary:    Boolean(resumeMetadata.isPrimary),
        uploaded_at:   resumeMetadata.uploadedAt || new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return sbResumeToMeta(data);
  }
  // local JSON fallback
  if (!memory.resumes) memory.resumes = [];
  memory.resumes.push({ ...resumeMetadata, ownerUserId: userId });
  saveLocalMemory(memory);
  return resumeMetadata;
}

async function getResumeById(resumeId, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? sbResumeToMeta(data) : null;
  }
  return (memory.resumes || []).find((r) => r.id === resumeId && (!userId || r.ownerUserId === userId)) || null;
}

async function updateResume(resumeId, patch, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    const dbPatch = { updated_at: new Date().toISOString() };
    if (patch.name        !== undefined) dbPatch.file_name  = patch.name;
    if (patch.linkedJobId !== undefined) dbPatch.job_id     = patch.linkedJobId;
    if (patch.isPrimary   !== undefined) dbPatch.is_primary = patch.isPrimary;

    // Enforce single primary per job: clear others first
    if (patch.isPrimary && patch.linkedJobId) {
      let clearPrimaryQuery = supabase
        .from("resumes")
        .update({ is_primary: false })
        .eq("job_id", patch.linkedJobId)
        .neq("id", resumeId);
      if (userId) {
        clearPrimaryQuery = clearPrimaryQuery.eq("owner_user_id", userId);
      }
      await clearPrimaryQuery;
    }

    let query = supabase
      .from("resumes")
      .update(dbPatch)
      .eq("id", resumeId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return sbResumeToMeta(data);
  }
  // local JSON fallback
  const index = (memory.resumes || []).findIndex(
    (r) => r.id === resumeId && (!userId || r.ownerUserId === userId)
  );
  if (index >= 0) {
    memory.resumes[index] = { ...memory.resumes[index], ...patch, updatedAt: new Date().toISOString() };
    saveLocalMemory(memory);
    return memory.resumes[index];
  }
  return null;
}

async function deleteResume(resumeId, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase.from("resumes").delete().eq("id", resumeId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { error } = await query;
    if (error) throw error;
    return;
  }
  memory.resumes = (memory.resumes || []).filter(
    (r) => r.id !== resumeId || (userId && r.ownerUserId !== userId)
  );
  saveLocalMemory(memory);
}

// ============================================================================
// CONTACTS MANAGEMENT
// ============================================================================

async function getContacts(filters = {}, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase.from("contacts").select("*");
    if (userId) query = query.eq("owner_user_id", userId);
    if (filters.name) query = query.ilike("name", `%${filters.name}%`);
    if (filters.email) query = query.ilike("email", `%${filters.email}%`);
    if (filters.company) query = query.ilike("company", `%${filters.company}%`);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Fallback: in-memory
  let contacts = filterByOwner(memory.contacts || [], userId);
  if (filters.name)
    contacts = contacts.filter((c) =>
      String(c.name || "").toLowerCase().includes(String(filters.name).toLowerCase())
    );
  if (filters.email)
    contacts = contacts.filter((c) =>
      String(c.email || "").toLowerCase().includes(String(filters.email).toLowerCase())
    );
  if (filters.company)
    contacts = contacts.filter((c) =>
      String(c.company || "").toLowerCase().includes(String(filters.company).toLowerCase())
    );
  return contacts;
}

async function createContact(contactData, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    const { data, error } = await supabase
      .from("contacts")
      .insert([
        {
          owner_user_id: userId,
          name: contactData.name,
          email: contactData.email || null,
          phone: contactData.phone || null,
          company: contactData.company || null,
          role: contactData.role || null,
          linkedin_url: contactData.linkedinUrl || null,
          notes: contactData.notes || null,
          source: contactData.source || "manual",
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Fallback: in-memory
  const contact = {
    id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: contactData.name,
    email: contactData.email || null,
    phone: contactData.phone || null,
    company: contactData.company || null,
    role: contactData.role || null,
    linkedin_url: contactData.linkedinUrl || null,
    notes: contactData.notes || null,
    source: contactData.source || "manual",
    ownerUserId: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!memory.contacts) memory.contacts = [];
  memory.contacts.push(contact);
  saveLocalMemory(memory);
  return contact;
}

async function updateContact(contactId, patch, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    const dbPatch = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.email !== undefined) dbPatch.email = patch.email;
    if (patch.phone !== undefined) dbPatch.phone = patch.phone;
    if (patch.company !== undefined) dbPatch.company = patch.company;
    if (patch.role !== undefined) dbPatch.role = patch.role;
    if (patch.linkedinUrl !== undefined) dbPatch.linkedin_url = patch.linkedinUrl;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;

    let query = supabase
      .from("contacts")
      .update(dbPatch)
      .eq("id", contactId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  // Fallback: in-memory
  const idx = (memory.contacts || []).findIndex(
    (c) => c.id === contactId && (!userId || c.ownerUserId === userId)
  );
  if (idx < 0) return null;
  
  // Convert camelCase patch to snake_case for in-memory storage
  const snakeCasePatch = {};
  if (patch.name !== undefined) snakeCasePatch.name = patch.name;
  if (patch.email !== undefined) snakeCasePatch.email = patch.email;
  if (patch.phone !== undefined) snakeCasePatch.phone = patch.phone;
  if (patch.company !== undefined) snakeCasePatch.company = patch.company;
  if (patch.role !== undefined) snakeCasePatch.role = patch.role;
  if (patch.linkedinUrl !== undefined) snakeCasePatch.linkedin_url = patch.linkedinUrl;
  if (patch.notes !== undefined) snakeCasePatch.notes = patch.notes;
  
  const updated = { ...memory.contacts[idx], ...snakeCasePatch, updated_at: new Date().toISOString() };
  memory.contacts[idx] = updated;
  saveLocalMemory(memory);
  return updated;
}

async function deleteContact(contactId, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase.from("contacts").delete().eq("id", contactId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { error } = await query;
    if (error) throw error;
    return;
  }

  // Fallback: in-memory
  memory.contacts = (memory.contacts || []).filter(
    (c) => c.id !== contactId || (userId && c.ownerUserId !== userId)
  );
  saveLocalMemory(memory);
}

// ============================================================================
// REMINDERS MANAGEMENT
// ============================================================================

async function getReminders(filters = {}, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase.from("reminders").select("*");
    if (userId) query = query.eq("owner_user_id", userId);
    if (filters.jobId) query = query.eq("job_id", filters.jobId);
    if (filters.isDone !== undefined) query = query.eq("is_done", filters.isDone);
    const { data, error } = await query.order("due_date", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Fallback: in-memory
  let reminders = filterByOwner(memory.reminders || [], userId);
  if (filters.jobId) reminders = reminders.filter((r) => r.job_id === filters.jobId);
  if (filters.isDone !== undefined) reminders = reminders.filter((r) => Boolean(r.is_done) === filters.isDone);
  return reminders;
}

async function createReminder(reminderData, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    const { data, error } = await supabase
      .from("reminders")
      .insert([
        {
          owner_user_id: userId,
          job_id: reminderData.jobId || reminderData.job_id || null,
          title: reminderData.title,
          due_date: reminderData.dueDate || reminderData.due_date || null,
          is_done: false,
          notes: reminderData.notes || null,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Fallback: in-memory
  const reminder = {
    id: `reminder_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    job_id: reminderData.jobId || reminderData.job_id || null,
    title: reminderData.title,
    due_date: reminderData.dueDate || reminderData.due_date || null,
    is_done: false,
    notes: reminderData.notes || null,
    ownerUserId: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!memory.reminders) memory.reminders = [];
  memory.reminders.push(reminder);
  saveLocalMemory(memory);
  return reminder;
}

async function updateReminder(reminderId, patch, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    const dbPatch = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate;
    if (patch.isDone !== undefined) dbPatch.is_done = patch.isDone;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;

    let query = supabase
      .from("reminders")
      .update(dbPatch)
      .eq("id", reminderId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  // Fallback: in-memory
  const idx = (memory.reminders || []).findIndex(
    (r) => r.id === reminderId && (!userId || r.ownerUserId === userId)
  );
  if (idx < 0) return null;
  
  // Convert camelCase patch to snake_case for in-memory storage
  const snakeCasePatch = {};
  if (patch.title !== undefined) snakeCasePatch.title = patch.title;
  if (patch.dueDate !== undefined) snakeCasePatch.due_date = patch.dueDate;
  if (patch.isDone !== undefined) snakeCasePatch.is_done = patch.isDone;
  if (patch.notes !== undefined) snakeCasePatch.notes = patch.notes;
  
  const updated = { ...memory.reminders[idx], ...snakeCasePatch, updated_at: new Date().toISOString() };
  memory.reminders[idx] = updated;
  saveLocalMemory(memory);
  return updated;
}

async function deleteReminder(reminderId, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase.from("reminders").delete().eq("id", reminderId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { error } = await query;
    if (error) throw error;
    return;
  }

  // Fallback: in-memory
  memory.reminders = (memory.reminders || []).filter(
    (r) => r.id !== reminderId || (userId && r.ownerUserId !== userId)
  );
  saveLocalMemory(memory);
}

// ============================================================================
// OUTREACH MANAGEMENT
// ============================================================================

async function getOutreach(filters = {}, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase.from("outreach").select("*");
    if (userId) query = query.eq("owner_user_id", userId);
    if (filters.contactId) query = query.eq("contact_id", filters.contactId);
    if (filters.jobId) query = query.eq("job_id", filters.jobId);
    if (filters.type) query = query.eq("type", filters.type);
    const { data, error } = await query.order("sent_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Fallback: in-memory
  let outreach = filterByOwner(memory.outreach || [], userId);
  if (filters.contactId) outreach = outreach.filter((o) => o.contact_id === filters.contactId);
  if (filters.jobId) outreach = outreach.filter((o) => o.job_id === filters.jobId);
  if (filters.type) outreach = outreach.filter((o) => o.type === filters.type);
  return outreach;
}

async function createOutreach(outreachData, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    const { data, error } = await supabase
      .from("outreach")
      .insert([
        {
          owner_user_id: userId,
          contact_id: outreachData.contactId || outreachData.contact_id || null,
          job_id: outreachData.jobId || outreachData.job_id || null,
          type: outreachData.type,
          message: outreachData.message || null,
          sent_at: outreachData.sentAt || outreachData.sent_at || new Date().toISOString(),
          response_received: outreachData.responseReceived ?? outreachData.response_received ?? false,
          notes: outreachData.notes || null,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Fallback: in-memory
  const entry = {
    id: `outreach_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    contact_id: outreachData.contactId || outreachData.contact_id || null,
    job_id: outreachData.jobId || outreachData.job_id || null,
    type: outreachData.type,
    message: outreachData.message || null,
    sent_at: outreachData.sentAt || outreachData.sent_at || new Date().toISOString(),
    response_received: outreachData.responseReceived ?? outreachData.response_received ?? false,
    notes: outreachData.notes || null,
    ownerUserId: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!memory.outreach) memory.outreach = [];
  memory.outreach.push(entry);
  saveLocalMemory(memory);
  return entry;
}

async function updateOutreach(outreachId, patch, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    const dbPatch = { updated_at: new Date().toISOString() };
    if (patch.type !== undefined) dbPatch.type = patch.type;
    if (patch.message !== undefined) dbPatch.message = patch.message;
    if (patch.sentAt !== undefined) dbPatch.sent_at = patch.sentAt;
    if (patch.responseReceived !== undefined) dbPatch.response_received = patch.responseReceived;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;

    let query = supabase
      .from("outreach")
      .update(dbPatch)
      .eq("id", outreachId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  // Fallback: in-memory
  const idx = (memory.outreach || []).findIndex(
    (o) => o.id === outreachId && (!userId || o.ownerUserId === userId)
  );
  if (idx < 0) return null;
  
  // Convert camelCase patch to snake_case for in-memory storage
  const snakeCasePatch = {};
  if (patch.type !== undefined) snakeCasePatch.type = patch.type;
  if (patch.message !== undefined) snakeCasePatch.message = patch.message;
  if (patch.sentAt !== undefined) snakeCasePatch.sent_at = patch.sentAt;
  if (patch.responseReceived !== undefined) snakeCasePatch.response_received = patch.responseReceived;
  if (patch.notes !== undefined) snakeCasePatch.notes = patch.notes;
  
  const updated = { ...memory.outreach[idx], ...snakeCasePatch, updated_at: new Date().toISOString() };
  memory.outreach[idx] = updated;
  saveLocalMemory(memory);
  return updated;
}

async function deleteOutreach(outreachId, options = {}) {
  const userId = options.userId || null;
  if (supabase) {
    let query = supabase.from("outreach").delete().eq("id", outreachId);
    if (userId) {
      query = query.eq("owner_user_id", userId);
    }
    const { error } = await query;
    if (error) throw error;
    return;
  }

  // Fallback: in-memory
  memory.outreach = (memory.outreach || []).filter(
    (o) => o.id !== outreachId || (userId && o.ownerUserId !== userId)
  );
  saveLocalMemory(memory);
}

// ============================================================================
// PER-USER TOKEN STORAGE (NEW: replaces global token storage with per-user)
// ============================================================================

async function getTokensByUser(userId) {
  if (!userId) {
    return null;
  }

  if (!supabase) {
    // Local memory: user-scoped tokens
    return memory.userTokens?.[userId] || null;
  }

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error && !error.message.includes("No rows")) {
    logger.error("getTokensByUser failed", { userId, error: error.message });
  }

  return data || null;
}

async function setTokensForUser(userId, tokens, verifiedEmailAddress) {
  if (!userId || !tokens) {
    throw new Error("setTokensForUser: userId and tokens required");
  }

  if (!supabase) {
    memory.userTokens = memory.userTokens || {};
    const prev = memory.userTokens[userId] || {};
    const clearing = !tokens.access_token && !tokens.accessToken;
    memory.userTokens[userId] = {
      ...prev,
      ...tokens,
      verified_email_address: verifiedEmailAddress ?? prev.verified_email_address,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_checked: clearing ? null : prev.last_checked,
    };
    saveLocalMemory(memory);
    return memory.userTokens[userId];
  }

  const { data, error } = await supabase
    .from("oauth_tokens")
    .upsert({
      id: `oauth_${userId}`,
      owner_user_id: userId,
      access_token: tokens.access_token || tokens.accessToken,
      refresh_token: tokens.refresh_token || tokens.refreshToken,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      verified_email_address: verifiedEmailAddress,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: "owner_user_id"
    })
    .select("*")
    .single();

  if (error) {
    logger.error("setTokensForUser failed", { userId, error: error.message });
    throw error;
  }

  return data;
}

async function deleteTokensForUser(userId) {
  if (!userId) {
    throw new Error("deleteTokensForUser: userId required");
  }

  if (!supabase) {
    memory.userTokens = memory.userTokens || {};
    delete memory.userTokens[userId];
    saveLocalMemory(memory);
    return true;
  }

  const { error } = await supabase
    .from("oauth_tokens")
    .delete()
    .eq("owner_user_id", userId);

  if (error) {
    logger.error("deleteTokensForUser failed", { userId, error: error.message });
    throw error;
  }

  return true;
}

async function refreshTokenIfExpiredForUser(userId) {
  const storedTokens = await getTokensByUser(userId);
  if (!storedTokens) {
    logger.warn("No stored tokens for user", { userId });
    return null;
  }

  const now = new Date();
  const expiresAt = storedTokens.expires_at ? new Date(storedTokens.expires_at) : null;

  if (expiresAt && expiresAt > now) {
    return storedTokens;  // Still valid, no refresh needed
  }

  if (!storedTokens.refresh_token) {
    logger.warn("No refresh_token for user", { userId });
    return null;
  }

  try {
    // Note: This requires createGmailClient to be imported from gmail.js
    // For now, return null and let jobSync.js handle refresh separately
    logger.warn("Token expired, needs manual refresh", { userId });
    return null;
  } catch (error) {
    logger.error("Token refresh failed", { userId, error: error.message });
    return null;
  }
}

async function getAllUsersWithActiveTokens() {
  if (!supabase) {
    return Object.keys(memory.userTokens || {}).filter((uid) => {
      const t = memory.userTokens[uid];
      return t && (t.access_token || t.accessToken);
    });
  }

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("owner_user_id")
    .not("access_token", "is", null);

  if (error) {
    logger.error("getAllUsersWithActiveTokens failed", { error: error.message });
    return [];
  }

  return data?.map((row) => row.owner_user_id) || [];
}

module.exports = {
  // Legacy global token functions (kept for backward compatibility)
  getTokens,
  setTokens,
  clearTokens,
  getLinkedUserId,
  getLastChecked,
  setLastChecked,
  // New per-user token functions (replaces above in new code path)
  getTokensByUser,
  setTokensForUser,
  deleteTokensForUser,
  refreshTokenIfExpiredForUser,
  getAllUsersWithActiveTokens,
  getJobs,
  addJob,
  updateJob,
  deleteJob,
  markJobImported,
  isProcessedEmail,
  markProcessedEmail,
  getJobEmails,
  addJobEmail,
  saveJobEmail,
  getEmailByGmailId,
  addStatusChange,
  getJobStatusTimeline,
  getResumes,
  addResume,
  getResumeById,
  updateResume,
  deleteResume,
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  getOutreach,
  createOutreach,
  updateOutreach,
  deleteOutreach,
};