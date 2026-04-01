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
  getTokens,
  markJobImported,
  updateJob,
} = require("../store/dataStore");
const { backfillJobEmailsFromExistingJobs, fetchJobEmails } = require("../services/jobSync");
const { getSyncStatus } = require("../services/syncState");
const { env } = require("../config/env");
const { VALID_STATUSES, EMAIL_TYPES } = require("../config/constants");

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

jobRoutes.get("/", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const jobs = await getJobs({ userId });
    const lastChecked = await getLastChecked();
    res.json({ jobs, lastChecked });
  } catch (error) {
    res.status(500).json({ error: "Unable to load jobs", details: error.message });
  }
});

jobRoutes.get("/sync-status", (req, res) => {
  res.json(getSyncStatus());
});

jobRoutes.post("/sync", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const tokens = await getTokens();
  if (!tokens) {
    return res.status(401).json({ error: "Not connected" });
  }

  const status = getSyncStatus();
  if (status.isSyncing) {
    return res.status(409).json({ error: "Sync already in progress", isSyncing: true });
  }

  // Run in background — respond immediately so UI isn't blocked
  fetchJobEmails({ mode: "daily", userId }).catch((err) =>
    console.error("[sync] background error:", err.message)
  );

  return res.json({ started: true, isSyncing: true });
});

jobRoutes.post("/backfill-emails", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const tokens = await getTokens();
  if (!tokens) {
    return res.status(401).json({ error: "Not connected" });
  }

  try {
    const result = await backfillJobEmailsFromExistingJobs({ userId });
    const jobs = await getJobs({ userId });
    const lastChecked = await getLastChecked();
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

    const timeline = await getJobStatusTimeline(req.params.id, { userId });
    return res.json({ timeline });
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
