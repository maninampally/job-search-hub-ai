const express = require("express");
const { requireTier } = require("../middleware/requireTier");
const { generateCoverLetter } = require("../services/coverLetterService");
const { getInterviewCoaching: answerInterviewQuestion } = require("../services/interviewCoachService");
const { getFollowUpNudges } = require("../services/followUpService");
const { checkAndIncrementQuota } = require("../store/aiUsageStore");
const { logger } = require("../utils/logger");

const aiRoutes = express.Router();

// POST /ai/cover-letter - Elite only
aiRoutes.post("/cover-letter", requireTier("elite", "ai_cover_letter"), async (req, res) => {
  const userId = req.authUser?.id;
  const { jobTitle, company, jobDescription, resumeText } = req.body;

  if (!jobTitle || !company) {
    return res.status(400).json({ error: "jobTitle and company are required" });
  }

  try {
    const quota = await checkAndIncrementQuota(userId, "cover_letter", 10);
    if (!quota.allowed) {
      return res.status(429).json({ error: "Daily AI quota reached", used: quota.used, limit: quota.limit });
    }

    const result = await generateCoverLetter(jobTitle, company, jobDescription || "", {
      resumeText,
      name: req.authUser?.name,
    });
    return res.json({ success: true, ...result, quotaUsed: quota.used, quotaLimit: quota.limit });
  } catch (err) {
    logger.error("[ai/cover-letter] failed", { error: err.message });
    return res.status(500).json({ error: "Failed to generate cover letter" });
  }
});

// POST /ai/interview-coach - Elite only
aiRoutes.post("/interview-coach", requireTier("elite", "ai_interview_coach"), async (req, res) => {
  const userId = req.authUser?.id;
  const { question, jobContext } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  try {
    const quota = await checkAndIncrementQuota(userId, "interview_coach", 20);
    if (!quota.allowed) {
      return res.status(429).json({ error: "Daily AI quota reached", used: quota.used, limit: quota.limit });
    }

    const result = await answerInterviewQuestion(question, jobContext || {});
    return res.json({ success: true, ...result, quotaUsed: quota.used, quotaLimit: quota.limit });
  } catch (err) {
    logger.error("[ai/interview-coach] failed", { error: err.message });
    return res.status(500).json({ error: "Failed to generate answer" });
  }
});

// GET /ai/nudges - Pro+
aiRoutes.get("/nudges", requireTier("pro", "smart_nudges"), async (req, res) => {
  const userId = req.authUser?.id;
  try {
    const nudges = await getFollowUpNudges(userId);
    return res.json({ success: true, nudges });
  } catch (err) {
    logger.error("[ai/nudges] failed", { error: err.message });
    return res.status(500).json({ error: "Failed to get nudges" });
  }
});

// GET /ai/usage - Pro+
aiRoutes.get("/usage", requireTier("pro", "ai_usage"), async (req, res) => {
  const userId = req.authUser?.id;
  try {
    const { getTodayUsage } = require("../store/aiUsageStore");
    const usage = await getTodayUsage(userId);
    return res.json({ success: true, usage });
  } catch (err) {
    logger.error("[ai/usage] failed", { error: err.message });
    return res.status(500).json({ error: "Failed to get usage" });
  }
});

module.exports = { aiRoutes };
