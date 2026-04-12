const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { logger } = require("../utils/logger");
const {
  addJob,
  deleteJob,
  getJobs,
  getTokens,
  updateJob,
} = require("../store/dataStore");
const { fetchJobEmails } = require("../services/jobSync");
const { env } = require("../config/env");
const { VALID_STATUSES } = require("../config/constants");

const mcpRoutes = express.Router();
const toolRateState = new Map();

const archiveBasePath = path.resolve(
  __dirname,
  "../../../docs/template-data/outreach-templates/outreach-templates-manikanth"
);

function isValidDateInput(value) {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  return !Number.isNaN(new Date(value).getTime());
}

function normalizeSyncMode(mode) {
  return String(mode || "").toLowerCase() === "initial" ? "initial" : "daily";
}

function getToolNameFromRequest(req) {
  return String(req.path || "")
    .replace(/^\//, "")
    .trim();
}

function enforceAllowedTool(toolName) {
  if (!env.MCP_ALLOWED_TOOLS.length) {
    return true;
  }
  return env.MCP_ALLOWED_TOOLS.includes(toolName);
}

function requireMcpAuth(req, res, next) {
  if (!env.MCP_AUTH_TOKEN) {
    if (env.ENVIRONMENT === "production") {
      return res.status(401).json({ error: "MCP_AUTH_TOKEN not configured" });
    }
    return next();
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || token !== env.MCP_AUTH_TOKEN) {
    return res.status(401).json({ error: "Unauthorized MCP request" });
  }

  return next();
}

function rateLimitMcp(req, res, next) {
  const ip = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
  const now = Date.now();
  const windowMs = env.MCP_RATE_LIMIT_WINDOW_MS;
  const maxRequests = env.MCP_RATE_LIMIT_MAX_REQUESTS;

  const current = toolRateState.get(ip);
  if (!current || now - current.windowStart >= windowMs) {
    toolRateState.set(ip, { windowStart: now, count: 1 });
    return next();
  }

  if (current.count >= maxRequests) {
    return res.status(429).json({ error: "MCP rate limit exceeded" });
  }

  current.count += 1;
  toolRateState.set(ip, current);
  return next();
}

function enforceToolGuardrails(req, res, next) {
  const toolName = getToolNameFromRequest(req);
  if (!enforceAllowedTool(toolName)) {
    return res.status(403).json({ error: `Tool not allowed: ${toolName}` });
  }
  return next();
}

function auditMcpRequest(req, res, next) {
  if (env.MCP_AUDIT_LOG_ENABLED) {
    const toolName = getToolNameFromRequest(req);
    logger.info("MCP request", { tool: toolName, method: req.method, ip: req.ip });
  }
  return next();
}

async function walkTemplateFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nestedFiles = await walkTemplateFiles(fullPath);
      files.push(...nestedFiles);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".txt")) {
      files.push(fullPath);
    }
  }

  return files;
}

mcpRoutes.use(requireMcpAuth);
mcpRoutes.use(rateLimitMcp);
mcpRoutes.use(enforceToolGuardrails);
mcpRoutes.use(auditMcpRequest);

mcpRoutes.get("/health", async (req, res) => {
  try {
    return res.json({
      tool: "health",
      result: {
        status: "ok",
        version: "1.0.0",
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to run MCP tool health", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

mcpRoutes.get("/auth_status", async (req, res) => {
  try {
    const tokens = await getTokens();
    return res.json({
      tool: "auth_status",
      result: {
        connected: Boolean(tokens),
        lastChecked: null,
        note: "Per-user Gmail uses oauth_tokens by owner; use app auth status for lastChecked.",
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to run MCP tool auth_status", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

mcpRoutes.get("/list_jobs", async (req, res) => {
  try {
    const jobs = await getJobs();
    return res.json({
      tool: "list_jobs",
      result: {
        jobs,
        count: jobs.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to run MCP tool list_jobs", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

mcpRoutes.post("/sync_jobs", async (req, res) => {
  try {
    const userId = String(req.body?.userId || req.query?.userId || "").trim();
    if (!userId) {
      return res.status(400).json({
        error: "userId required",
        hint: "Pass owner user UUID in body or query. Legacy global Gmail token is not supported.",
      });
    }

    const mode = normalizeSyncMode(req.body?.mode || req.query?.mode);
    await fetchJobEmails({ mode, userId });

    const jobs = await getJobs({ userId });

    return res.json({
      tool: "sync_jobs",
      result: {
        jobs,
        count: jobs.length,
        mode,
        userId,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to run MCP tool sync_jobs", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

mcpRoutes.post("/create_job", async (req, res) => {
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
    return res.status(201).json({
      tool: "create_job",
      result: { job: newJob },
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to run MCP tool create_job", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

mcpRoutes.patch("/update_job", async (req, res) => {
  const { id, ...patch } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  if (patch.status !== undefined && !VALID_STATUSES.has(patch.status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  if (patch.appliedDate !== undefined && !isValidDateInput(patch.appliedDate)) {
    return res.status(400).json({ error: "Invalid appliedDate" });
  }

  try {
    const jobs = await getJobs();
    const existing = jobs.find((job) => job.id === id);
    if (!existing) {
      return res.status(404).json({ error: "Job not found" });
    }

    await updateJob(id, patch);
    const refreshedJobs = await getJobs();
    const updatedJob = refreshedJobs.find((job) => job.id === id) || { ...existing, ...patch };

    return res.json({
      tool: "update_job",
      result: { job: updatedJob },
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to run MCP tool update_job", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

mcpRoutes.delete("/delete_job", async (req, res) => {
  const id = String(req.body?.id || req.query?.id || "").trim();
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  try {
    const jobs = await getJobs();
    const existing = jobs.find((job) => job.id === id);
    if (!existing) {
      return res.status(404).json({ error: "Job not found" });
    }

    await deleteJob(id);
    return res.json({
      tool: "delete_job",
      result: { success: true, id },
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to run MCP tool delete_job", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

mcpRoutes.get("/template_list", async (req, res) => {
  try {
    const files = await walkTemplateFiles(archiveBasePath);
    const payload = await Promise.all(
      files.sort().map(async (fullPath) => {
        const stats = await fs.stat(fullPath);
        return {
          path: path.relative(archiveBasePath, fullPath).replace(/\\/g, "/"),
          size: stats.size,
        };
      })
    );

    return res.json({
      tool: "template_list",
      result: { files: payload, count: payload.length },
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to run MCP tool template_list", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

mcpRoutes.get("/template_fetch", async (req, res) => {
  const relativePath = String(req.query.path || "").trim();
  if (!relativePath) {
    return res.status(400).json({ error: "path query parameter is required" });
  }

  const resolvedPath = path.resolve(archiveBasePath, relativePath);
  const relativeResolvedPath = path.relative(archiveBasePath, resolvedPath);
  const isPathTraversal =
    !relativeResolvedPath ||
    relativeResolvedPath.startsWith("..") ||
    path.isAbsolute(relativeResolvedPath);

  if (isPathTraversal || !resolvedPath.toLowerCase().endsWith(".txt")) {
    return res.status(400).json({ error: "Invalid template path" });
  }

  try {
    const content = await fs.readFile(resolvedPath, "utf-8");
    return res.json({
      tool: "template_fetch",
      result: { path: relativePath.replace(/\\/g, "/"), content },
    });
  } catch (error) {
    return res.status(404).json({ error: "Template file not found", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

module.exports = { mcpRoutes };
