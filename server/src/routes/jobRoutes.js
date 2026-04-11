const express = require("express");
const {
  addJobEmail,
  addJob,
  addStatusChange,
  deleteJob,
  getJobEmails,
  getJobStatusTimeline,
  getJobs,
  getLastChecked,
  getTokensByUser,
  markJobImported,
  updateJob,
} = require("../store/dataStore");
const { backfillJobEmailsFromExistingJobs, fetchJobEmails } = require("../services/jobSync");
const { getSyncStatus } = require("../services/syncState");
const { env } = require("../config/env");
const { VALID_STATUSES, EMAIL_TYPES } = require("../config/constants");
const { rateLimitMiddleware } = require("../security/rateLimiter");
const { logSync, logError } = require("../security/auditLogger");
const { requireUserAuth } = require("../middleware/requireUserAuth");
const { requireTierGmailSync } = require("../middleware/requireTier");
const { logger } = require("../utils/logger");
const { parseJobsSyncBody } = require("../schemas/jobSyncSchemas");

const jobRoutes = express.Router();

function getAuthenticatedUserId(req) {
  return req.authUser?.id || null;
}

function isValidDateInput(value) {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  return !Number.isNaN(new Date(value).getTime());
}

function isStringWithinLimit(value, maxLength) {
  if (value === undefined || value === null) {
    return true;
  }
  return typeof value === "string" && value.length <= maxLength;
}

function toDateSafe(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function csvEscape(value) {
  const text = String(value === undefined || value === null ? "" : value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function sendWebhook(url, payload) {
  if (!url) {
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return {
      delivered: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      delivered: false,
      reason: error.message,
    };
  }
}

jobRoutes.get("/", requireUserAuth, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const jobs = await getJobs({ userId });
    const lastChecked = await getLastChecked(userId);
    res.json({ jobs, lastChecked });
  } catch (error) {
    res.status(500).json({ error: "Unable to load jobs", details: error.message });
  }
});

jobRoutes.get("/sync-status", requireUserAuth, (req, res) => {
  // NEW: Support both global and per-user status queries
  const userId = getAuthenticatedUserId(req);
  res.json(getSyncStatus(userId));
});

jobRoutes.post("/sync", requireUserAuth, requireTierGmailSync, rateLimitMiddleware, async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const parsed = parseJobsSyncBody(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid sync request",
      details: parsed.error.flatten(),
    });
  }

  const { forceReprocess = false, fullWindow = false, lookbackDays, processAll = true } = parsed.data;
  /** Wide Gmail window: fullWindow or explicit lookbackDays. */
  const wideSync = Boolean(fullWindow) || lookbackDays != null;
  const mode = wideSync ? "initial" : "daily";
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const tokens = await getTokensByUser(userId);
  if (!tokens) {
    return res.status(401).json({ error: "Not connected" });
  }

  // NEW: Check per-user sync status
  const status = getSyncStatus(userId);
  if (status.isSyncing) {
    return res.status(409).json({ error: "Sync already in progress for this user", isSyncing: true });
  }

  try {
    logSync("SYNC_TRIGGERED", userId, { mode, forceReprocess, fullWindow, lookbackDays, processAll });
    // Run in background — respond immediately so UI isn't blocked
    fetchJobEmails({ mode, userId, forceReprocess, lookbackDays, processAll }).catch((err) =>
      logger.error("Manual sync background error", { userId, error: err.message })
    );

    return res.json({
      started: true,
      isSyncing: true,
      forceReprocess,
      fullWindow,
      lookbackDays: lookbackDays ?? null,
      processAll,
      mode,
    });
  } catch (error) {
    logError("SYNC_ERROR", error, userId);
    return res.status(500).json({ error: "Sync failed", details: error.message });
  }
});

jobRoutes.post("/backfill-emails", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const tokens = await getTokensByUser(userId);
  if (!tokens) {
    return res.status(401).json({ error: "Not connected" });
  }

  try {
    const result = await backfillJobEmailsFromExistingJobs({ userId });
    const jobs = await getJobs({ userId });
    const lastChecked = await getLastChecked(userId);
    return res.json({ ...result, jobs, lastChecked });
  } catch (error) {
    return res.status(500).json({ error: "Backfill failed", details: error.message });
  }
});

jobRoutes.post("/", async (req, res) => {
  const { company, role, status, location, recruiterName, recruiterEmail, appliedDate, notes, nextStep } =
    req.body || {};

  if (!company || !role) {
    return res.status(400).json({ error: "company and role are required" });
  }

  if (status && !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  if (!isValidDateInput(appliedDate)) {
    return res.status(400).json({ error: "Invalid appliedDate" });
  }

  try {
    const userId = getAuthenticatedUserId(req);
    const newJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      company,
      role,
      status: status || "Applied",
      location: location || "",
      recruiterName: recruiterName || "",
      recruiterEmail: recruiterEmail || "",
      appliedDate: appliedDate || null,
      notes: notes || "",
      nextStep: nextStep || "",
      source: "manual",
      imported: true,
      createdAt: new Date().toISOString(),
    };

    await addJob(newJob, { userId });
    res.status(201).json({ job: newJob });
  } catch (error) {
    res.status(500).json({ error: "Unable to create job", details: error.message });
  }
});

jobRoutes.get("/analytics/weekly", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const jobs = await getJobs({ userId });
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const applicationsThisWeek = jobs.filter((job) => {
      const anchor = toDateSafe(job.createdAt || job.appliedDate);
      return Boolean(anchor && anchor >= weekAgo && anchor <= now);
    }).length;

    const responsesThisWeek = jobs.reduce((count, job) => {
      const emails = Array.isArray(job.emails) ? job.emails : [];
      const hasResponse = emails.some((email) => {
        const date = toDateSafe(email.date);
        return (
          date &&
          date >= weekAgo &&
          date <= now &&
          ["Recruiter Outreach", "Interview Scheduled", "Offer", "Rejection"].includes(email.type)
        );
      });

      return count + (hasResponse ? 1 : 0);
    }, 0);

    const interviewsThisWeek = jobs.reduce((count, job) => {
      const emails = Array.isArray(job.emails) ? job.emails : [];
      const hasInterview = emails.some((email) => {
        const date = toDateSafe(email.date);
        return date && date >= weekAgo && date <= now && email.type === "Interview Scheduled";
      });

      return count + (hasInterview ? 1 : 0);
    }, 0);

    const stalledJobs = jobs.filter((job) => {
      if (!["Applied", "Screening"].includes(job.status || "")) {
        return false;
      }
      const anchor = toDateSafe(job.appliedDate || job.createdAt);
      if (!anchor) {
        return false;
      }
      const ageInDays = Math.floor((now.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      return ageInDays >= 14;
    }).length;

    return res.json({
      applicationsThisWeek,
      responsesThisWeek,
      interviewsThisWeek,
      stalledJobs,
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to build weekly analytics", details: error.message });
  }
});

jobRoutes.get("/analytics/daily", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const metric = req.query.metric || "applications";

    if (metric !== "applications") {
      return res.status(400).json({ error: "Only 'applications' metric is currently supported" });
    }

    // Determine date range: custom or preset
    let startDate, endDate;
    if (req.query.startDate && req.query.endDate) {
      // Custom date range
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Preset days range
      const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90);
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Midnight of today
      endDate = new Date(now);
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days + 1);
    }

    const jobs = await getJobs({ userId });

    // Calculate number of days in range
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Build map of date -> application count
    const dailyCounts = {};
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
      dailyCounts[dateKey] = 0;
    }

    // Count applications by appliedDate - only jobs with "Applied" status
    for (const job of jobs) {
      const appliedDate = job.appliedDate;
      // Only count jobs with "Applied" status
      if (appliedDate && job.status === "Applied") {
        const dateObj = toDateSafe(appliedDate);
        if (dateObj) {
          const dateKey = dateObj.toISOString().split("T")[0]; // Extract YYYY-MM-DD
          if (dailyCounts.hasOwnProperty(dateKey)) {
            dailyCounts[dateKey]++;
          }
        }
      }
    }

    // Build series array
    const series = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split("T")[0];
      series.push({
        date: dateKey,
        count: dailyCounts[dateKey],
      });
    }

    const endDateKey = endDate.toISOString().split("T")[0];
    const startDateKey = startDate.toISOString().split("T")[0];

    return res.json({
      metric: "applications",
      startDate: startDateKey,
      endDate: endDateKey,
      series,
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to build daily analytics", details: error.message });
  }
});

/**
 * GET /jobs/daily-report
 * Summary of sync activity in the last 24h (default 9PM-9PM window).
 * Query params: ?hours=24 (override window size)
 */
jobRoutes.get("/daily-report", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 168);
    const now = new Date();
    const windowStart = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const jobs = await getJobs({ userId });
    const allEmails = [];
    for (const job of jobs) {
      const emails = await getJobEmails(job.id, { userId });
      for (const em of emails) {
        allEmails.push({ ...em, jobId: job.id, company: job.company, role: job.role });
      }
    }

    const recentEmails = allEmails.filter((em) => {
      const d = new Date(em.date);
      return !Number.isNaN(d.getTime()) && d >= windowStart && d <= now;
    });

    const jobsCreatedInWindow = jobs.filter((j) => {
      const d = new Date(j.createdAt);
      return !Number.isNaN(d.getTime()) && d >= windowStart && d <= now;
    });

    const statusChanges = [];
    for (const job of jobs) {
      const timeline = await getJobStatusTimeline(job.id, { userId });
      for (const ev of timeline) {
        const d = new Date(ev.changedAt);
        if (!Number.isNaN(d.getTime()) && d >= windowStart && d <= now) {
          statusChanges.push({
            company: job.company,
            role: job.role,
            from: ev.fromStatus,
            to: ev.toStatus,
            trigger: ev.trigger,
            date: ev.changedAt,
          });
        }
      }
    }

    const emailsByType = {};
    for (const em of recentEmails) {
      const t = em.type || "Unknown";
      emailsByType[t] = (emailsByType[t] || 0) + 1;
    }

    return res.json({
      window: { start: windowStart.toISOString(), end: now.toISOString(), hours },
      summary: {
        emailsProcessed: recentEmails.length,
        jobsCreated: jobsCreatedInWindow.length,
        statusChanges: statusChanges.length,
      },
      emailsByType,
      newJobs: jobsCreatedInWindow.map((j) => ({
        company: j.company,
        role: j.role,
        status: j.status,
        appliedDate: j.appliedDate,
      })),
      statusChanges,
      recentEmails: recentEmails.slice(0, 50).map((em) => ({
        company: em.company,
        role: em.role,
        subject: em.subject,
        from: em.fromName || em.from,
        date: em.date,
        type: em.type,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to build daily report", details: error.message });
  }
});

jobRoutes.get("/export/csv", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const jobs = await getJobs({ userId });
    const reminders = Array.isArray(req.body?.reminders) ? req.body.reminders : [];
    const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts : [];
    const outreach = Array.isArray(req.body?.outreach) ? req.body.outreach : [];

    const lines = [];
    lines.push("section,field1,field2,field3,field4,field5,field6");

    for (const job of jobs) {
      lines.push(
        [
          "jobs",
          csvEscape(job.id),
          csvEscape(job.company),
          csvEscape(job.role),
          csvEscape(job.status),
          csvEscape(job.appliedDate),
          csvEscape(job.recruiterName),
        ].join(",")
      );
    }

    for (const contact of contacts) {
      lines.push(
        [
          "contacts",
          csvEscape(contact.id),
          csvEscape(contact.name),
          csvEscape(contact.company),
          csvEscape(contact.relationship),
          csvEscape(contact.email),
          csvEscape(contact.notes),
        ].join(",")
      );
    }

    for (const entry of outreach) {
      lines.push(
        [
          "outreach",
          csvEscape(entry.id),
          csvEscape(entry.contact),
          csvEscape(entry.company),
          csvEscape(entry.method),
          csvEscape(entry.status),
          csvEscape(entry.notes),
        ].join(",")
      );
    }

    for (const reminder of reminders) {
      lines.push(
        [
          "reminders",
          csvEscape(reminder.id),
          csvEscape(reminder.title),
          csvEscape(reminder.type),
          csvEscape(reminder.dueDate),
          csvEscape(reminder.completed),
          csvEscape(""),
        ].join(",")
      );
    }

    const fileName = `job-search-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    return res.status(200).send(lines.join("\n"));
  } catch (error) {
    return res.status(500).json({ error: "Unable to export CSV", details: error.message });
  }
});

jobRoutes.get("/timeline/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const jobs = await getJobs({ userId });
    const job = jobs.find((item) => item.id === req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const statusEvents = await getJobStatusTimeline(req.params.id, { userId });
    const emails = await getJobEmails(req.params.id, { userId });

    const unified = [];

    for (const ev of statusEvents) {
      unified.push({
        type: "status_change",
        date: ev.changedAt || ev.changed_at,
        title: ev.fromStatus
          ? `${ev.fromStatus} \u2192 ${ev.toStatus}`
          : `Status set to ${ev.toStatus}`,
        detail: ev.trigger === "email_sync" ? "Updated from email" : "Manual change",
        from_status: ev.fromStatus,
        to_status: ev.toStatus,
        trigger: ev.trigger,
      });
    }

    for (const em of emails) {
      unified.push({
        type: "email",
        date: em.date,
        title: em.subject || "No subject",
        detail: em.preview || "",
        from: em.fromName || em.from || "Unknown",
        emailType: em.type || em.emailType || "Auto / Tracking",
        isReal: em.isReal,
      });
    }

    unified.sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.json({ timeline: unified });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load timeline", details: error.message });
  }
});

jobRoutes.post("/notifications/hooks/due-reminders", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const reminders = Array.isArray(req.body?.reminders) ? req.body.reminders : [];
    const dueReminders = reminders.filter(
      (item) => !item.completed && String(item.dueDate || "") <= today
    );

    const payload = {
      event: "due_reminders",
      generatedAt: new Date().toISOString(),
      count: dueReminders.length,
      reminders: dueReminders,
    };

    const [emailResult, slackResult, whatsappResult] = await Promise.all([
      sendWebhook(env.NOTIFY_EMAIL_WEBHOOK_URL, payload),
      sendWebhook(env.NOTIFY_SLACK_WEBHOOK_URL, payload),
      sendWebhook(env.NOTIFY_WHATSAPP_WEBHOOK_URL, payload),
    ]);

    return res.json({
      success: true,
      count: dueReminders.length,
      delivery: {
        email: emailResult,
        slack: slackResult,
        whatsapp: whatsappResult,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to send notification hooks", details: error.message });
  }
});

jobRoutes.patch("/:id", async (req, res) => {
  const patch = req.body || {};
  if (patch.status !== undefined && !VALID_STATUSES.has(patch.status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  if (patch.appliedDate !== undefined && !isValidDateInput(patch.appliedDate)) {
    return res.status(400).json({ error: "Invalid appliedDate" });
  }

  try {
    const userId = getAuthenticatedUserId(req);
    if (patch.status !== undefined) {
      const jobs = await getJobs({ userId });
      const existing = jobs.find((j) => j.id === req.params.id);
      if (existing && existing.status !== patch.status) {
        await addStatusChange(req.params.id, existing.status || null, patch.status, "manual", { userId });
      }
    }
    await updateJob(req.params.id, patch, { userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to update job", details: error.message });
  }
});

jobRoutes.delete("/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    await deleteJob(req.params.id, { userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to delete job", details: error.message });
  }
});

jobRoutes.post("/:id/imported", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    await markJobImported(req.params.id, { userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to mark imported", details: error.message });
  }
});

jobRoutes.get("/:id/emails", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const emails = await getJobEmails(req.params.id, { userId });
    if (emails === null) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.json({ emails });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load job emails", details: error.message });
  }
});

jobRoutes.post("/:id/emails", async (req, res) => {
  const body = req.body || {};
  if (!body.subject || !body.date) {
    return res.status(400).json({ error: "subject and date are required" });
  }

  if (!isValidDateInput(body.date)) {
    return res.status(400).json({ error: "Invalid email date" });
  }

  if (!isStringWithinLimit(body.subject, 500)) {
    return res.status(400).json({ error: "subject exceeds max length (500)" });
  }

  if (!isStringWithinLimit(body.preview, 4000)) {
    return res.status(400).json({ error: "preview exceeds max length (4000)" });
  }

  if (!isStringWithinLimit(body.body, 50000)) {
    return res.status(400).json({ error: "body exceeds max length (50000)" });
  }

  if (body.type !== undefined) {
    const allowedTypes = new Set([
      "Application Confirmation",
      "Recruiter Outreach",
      "Interview Scheduled",
      "Rejection",
      "Offer",
      "Auto / Tracking",
    ]);
    if (!allowedTypes.has(body.type)) {
      return res.status(400).json({ error: "Invalid email type" });
    }
  }

  try {
    const userId = getAuthenticatedUserId(req);
    const email = {
      id: body.id || `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: body.from || "",
      fromName: body.fromName || "",
      subject: body.subject,
      preview: body.preview || "",
      body: body.body || "",
      date: body.date,
      type: body.type || "Auto / Tracking",
      isReal: Boolean(body.isReal),
      gmailId: body.gmailId || "",
      isRead: Boolean(body.isRead),
    };

    const emails = await addJobEmail(req.params.id, email, { userId });
    if (emails === null) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.status(201).json({ emails });
  } catch (error) {
    return res.status(500).json({ error: "Unable to add job email", details: error.message });
  }
});

module.exports = { jobRoutes };
