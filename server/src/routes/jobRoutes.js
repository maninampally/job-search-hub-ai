const express = require("express");
const {
  addJob,
  deleteJob,
  getJobs,
  getLastChecked,
  getTokens,
  markJobImported,
  updateJob,
} = require("../store/dataStore");
const { fetchJobEmails } = require("../services/jobSync");

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

  try {
    await fetchJobEmails();
    const jobs = await getJobs();
    const lastChecked = await getLastChecked();
    return res.json({ jobs, lastChecked });
  } catch (error) {
    return res.status(500).json({ error: "Sync failed", details: error.message });
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

module.exports = { jobRoutes };
