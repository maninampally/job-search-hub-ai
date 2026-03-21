const express = require("express");
const { store } = require("../store/memoryStore");
const { fetchJobEmails } = require("../services/jobSync");

const jobRoutes = express.Router();

jobRoutes.get("/", (req, res) => {
  res.json({ jobs: store.jobs, lastChecked: store.lastChecked });
});

jobRoutes.post("/sync", async (req, res) => {
  if (!store.tokens) {
    return res.status(401).json({ error: "Not connected" });
  }

  await fetchJobEmails();
  return res.json({ jobs: store.jobs, lastChecked: store.lastChecked });
});

jobRoutes.delete("/:id", (req, res) => {
  store.jobs = store.jobs.filter((job) => job.id !== req.params.id);
  res.json({ success: true });
});

jobRoutes.post("/:id/imported", (req, res) => {
  store.jobs = store.jobs.map((job) =>
    job.id === req.params.id ? { ...job, imported: true } : job
  );
  res.json({ success: true });
});

module.exports = { jobRoutes };
