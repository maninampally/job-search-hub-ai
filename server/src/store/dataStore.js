const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { env } = require("../config/env");

const localStorePath = path.resolve(__dirname, "../../data/local-store.json");

function createInitialMemory() {
  return {
    tokens: null,
    jobs: [],
    emailsByJob: {},
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

    for (const job of parsedJobs) {
      if (Array.isArray(job.emails) && job.emails.length > 0) {
        parsedEmailsByJob[job.id] = job.emails;
      }
    }

    return {
      tokens: parsed.tokens || null,
      jobs: parsedJobs,
      emailsByJob: parsedEmailsByJob,
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

    fs.writeFileSync(
      localStorePath,
      JSON.stringify(
        {
          tokens: memory.tokens,
          jobs: memory.jobs,
          emailsByJob: memory.emailsByJob,
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

const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = hasSupabase
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

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

async function setTokens(tokens) {
  if (!supabase) {
    memory.tokens = tokens;
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

async function getLastChecked() {
  if (!supabase) {
    return memory.lastChecked;
  }

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("last_checked")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.last_checked || null;
}

async function setLastChecked(lastChecked) {
  if (!supabase) {
    memory.lastChecked = lastChecked;
    saveLocalMemory(memory);
    return;
  }

  const { error } = await supabase.from("oauth_tokens").upsert(
    {
      id: 1,
      last_checked: lastChecked,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

async function getJobs() {
  if (!supabase) {
    return memory.jobs.map((job) => ({
      ...job,
      emails: Array.isArray(job.emails) ? job.emails : [],
    }));
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

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
    emails: Array.isArray(memory.emailsByJob[row.id])
      ? memory.emailsByJob[row.id]
      : Array.isArray(row.emails)
        ? row.emails
        : [],
  }));
}

async function addJob(job) {
  if (!supabase) {
    const normalizedJob = {
      ...job,
      emails: Array.isArray(job.emails) ? job.emails : [],
    };

    memory.jobs.push(normalizedJob);
    saveLocalMemory(memory);
    return;
  }

  memory.emailsByJob[job.id] = Array.isArray(job.emails) ? job.emails : [];
  saveLocalMemory(memory);

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
    created_at: job.createdAt || new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

async function updateJob(jobId, partialJob) {
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

    saveLocalMemory(memory);
    return;
  }

  if (partialJob.emails !== undefined) {
    memory.emailsByJob[jobId] = Array.isArray(partialJob.emails) ? partialJob.emails : [];
    saveLocalMemory(memory);
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

  const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);
  if (error) {
    throw error;
  }
}

async function deleteJob(jobId) {
  if (!supabase) {
    memory.jobs = memory.jobs.filter((job) => job.id !== jobId);
    delete memory.emailsByJob[jobId];
    saveLocalMemory(memory);
    return;
  }

  delete memory.emailsByJob[jobId];
  saveLocalMemory(memory);

  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) {
    throw error;
  }
}

async function markJobImported(jobId) {
  if (!supabase) {
    memory.jobs = memory.jobs.map((job) =>
      job.id === jobId ? { ...job, imported: true } : job
    );
    saveLocalMemory(memory);
    return;
  }

  const { error } = await supabase
    .from("jobs")
    .update({ imported: true })
    .eq("id", jobId);

  if (error) {
    throw error;
  }
}

async function isProcessedEmail(messageId) {
  if (!supabase) {
    return memory.processedIds.has(messageId);
  }

  const { data, error } = await supabase
    .from("processed_emails")
    .select("gmail_id")
    .eq("gmail_id", messageId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.gmail_id);
}

async function markProcessedEmail(messageId) {
  if (!supabase) {
    memory.processedIds.add(messageId);
    saveLocalMemory(memory);
    return;
  }

  const { error } = await supabase.from("processed_emails").upsert(
    {
      gmail_id: messageId,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "gmail_id" }
  );

  if (error) {
    throw error;
  }
}

async function getJobEmails(jobId) {
  const jobs = await getJobs();
  const job = jobs.find((item) => item.id === jobId);
  if (!job) {
    return null;
  }

  return Array.isArray(job.emails) ? job.emails : [];
}

async function addJobEmail(jobId, email) {
  const jobs = await getJobs();
  const job = jobs.find((item) => item.id === jobId);
  if (!job) {
    return null;
  }

  const existingEmails = Array.isArray(job.emails) ? job.emails : [];
  const emailGmailId = email.gmailId || null;

  const duplicateIndex = existingEmails.findIndex((item) => {
    if (emailGmailId && item.gmailId) {
      return item.gmailId === emailGmailId;
    }
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
    nextEmails.sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime());

    await updateJob(jobId, { emails: nextEmails });
    return nextEmails;
  }

  const nextEmails = [...existingEmails, email].sort(
    (first, second) => new Date(first.date).getTime() - new Date(second.date).getTime()
  );

  await updateJob(jobId, { emails: nextEmails });
  return nextEmails;
}

module.exports = {
  getTokens,
  setTokens,
  clearTokens,
  getLastChecked,
  setLastChecked,
  getJobs,
  addJob,
  updateJob,
  deleteJob,
  markJobImported,
  isProcessedEmail,
  markProcessedEmail,
  getJobEmails,
  addJobEmail,
};