const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const templateRoutes = express.Router();

const archiveBasePath = path.resolve(
  __dirname,
  "../../../docs/template-data/outreach-templates/outreach-templates-manikanth"
);

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

templateRoutes.get("/archive/files", async (req, res) => {
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

    res.json({ files: payload });
  } catch (error) {
    res.status(500).json({ error: "Unable to list template archive", details: error.message });
  }
});

templateRoutes.get("/archive/content", async (req, res) => {
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
    return res.json({ path: relativePath.replace(/\\/g, "/"), content });
  } catch (error) {
    return res.status(404).json({ error: "Template file not found", details: error.message });
  }
});

module.exports = { templateRoutes };