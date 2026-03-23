const express = require("express");
const {
  addJobEmail,
  addJob,
  deleteJob,
  getJobEmails,
  getJobs,
  getLastChecked,
  getTokens,
  markJobImported,
  updateJob,
} = require("../store/dataStore");
const { backfillJobEmailsFromExistingJobs, fetchJobEmails } = require("../services/jobSync");

const jobRoutes = express.Router();

jobRoutes.get("/", async (req, res) => {
  try {
    const jobs = await getJobs();
    const lastChecked = await getLastChecked();
    res.json({ jobs, lastChecked });
  } catch (error) {
    res.status(500).json({ error: "Unable to load jobs", details: error.message });
  }
});

jobRoutes.post("/sync", async (req, res) => {
  const tokens = await getTokens();
  if (!tokens) {
    return res.status(401).json({ error: "Not connected" });
  }

  const mode = String(req.query.mode || "").toLowerCase() === "initial" ? "initial" : "daily";

  try {
    await fetchJobEmails({ mode });
    const jobs = await getJobs();
    const lastChecked = await getLastChecked();
    return res.json({ jobs, lastChecked });
  } catch (error) {
    return res.status(500).json({ error: "Sync failed", details: error.message });
  }
});

jobRoutes.post("/backfill-emails", async (req, res) => {
  const tokens = await getTokens();
  if (!tokens) {
    return res.status(401).json({ error: "Not connected" });
  }

  try {
    const result = await backfillJobEmailsFromExistingJobs();
    const jobs = await getJobs();
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

  try {
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

    await addJob(newJob);
    res.status(201).json({ job: newJob });
  } catch (error) {
    res.status(500).json({ error: "Unable to create job", details: error.message });
  }
});

jobRoutes.patch("/:id", async (req, res) => {
  try {
    await updateJob(req.params.id, req.body || {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to update job", details: error.message });
  }
});

jobRoutes.delete("/:id", async (req, res) => {
  try {
    await deleteJob(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to delete job", details: error.message });
  }
});

jobRoutes.post("/:id/imported", async (req, res) => {
  try {
    await markJobImported(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to mark imported", details: error.message });
  }
});

jobRoutes.get("/:id/emails", async (req, res) => {
  try {
    const emails = await getJobEmails(req.params.id);
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

  try {
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

    const emails = await addJobEmail(req.params.id, email);
    if (emails === null) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.status(201).json({ emails });
  } catch (error) {
    return res.status(500).json({ error: "Unable to add job email", details: error.message });
  }
});

module.exports = { jobRoutes };
