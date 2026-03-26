const express = require("express");
const multer = require("multer");
const fs = require("fs").promises;
const path = require("path");
const { env } = require("../config/env");
const {
  getResumes,
  addResume,
  getResumeById,
  updateResume,
  deleteResume,
} = require("../store/dataStore");

const resumeRoutes = express.Router();

// Memory storage for resume uploads
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed"));
    }
  },
});

/**
 * POST /resumes/upload
 * Upload a new resume or version of existing resume
 * Body:
 *   - file: multipart file (PDF or DOCX)
 *   - name: Resume name/title (e.g., "Data Engineer Resume")
 *   - linkedJobId: (optional) Job ID to link this resume to
 */
resumeRoutes.post("/upload", uploadMemory.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { name, linkedJobId } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Resume name is required" });
    }

    const resumeId = `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    const fileExt = req.file.originalname.split(".").pop();

    // Store resume metadata
    const resumeMetadata = {
      id: resumeId,
      name: name.trim(),
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedAt: timestamp,
      linkedJobId: linkedJobId || null,
      fileBuffer: req.file.buffer.toString("base64"), // Store in base64 for now
      version: 1,
    };

    addResume(resumeMetadata);

    res.json({
      resumeId,
      name: resumeMetadata.name,
      fileName: resumeMetadata.fileName,
      uploadedAt: timestamp,
      message: "Resume uploaded successfully",
    });
  } catch (error) {
    console.error("[resume:upload]", error);
    res.status(500).json({ error: "Failed to upload resume", details: error.message });
  }
});

/**
 * GET /resumes
 * List all resumes with optional filters
 * Query params:
 *   - jobId: filter by linked job
 *   - name: search by resume name
 */
resumeRoutes.get("/", async (req, res) => {
  try {
    const { jobId, name } = req.query;

    let resumes = getResumes() || [];

    if (jobId) {
      resumes = resumes.filter((r) => r.linkedJobId === jobId);
    }

    if (name) {
      const searchLower = name.toLowerCase();
      resumes = resumes.filter((r) => r.name.toLowerCase().includes(searchLower));
    }

    // Return metadata only (not full file buffers)
    const response = resumes.map((r) => ({
      id: r.id,
      name: r.name,
      fileName: r.fileName,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      uploadedAt: r.uploadedAt,
      linkedJobId: r.linkedJobId,
      version: r.version,
    }));

    res.json(response);
  } catch (error) {
    console.error("[resume:list]", error);
    res.status(500).json({ error: "Failed to fetch resumes", details: error.message });
  }
});

/**
 * GET /resumes/:id/download
 * Download a resume file
 */
resumeRoutes.get("/:id/download", async (req, res) => {
  try {
    const resume = getResumeById(req.params.id);

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const buffer = Buffer.from(resume.fileBuffer, "base64");
    const ext = resume.fileName.split(".").pop();
    const downloadName = `${resume.name.replace(/\s+/g, "_")}.${ext}`;

    res.setHeader("Content-Type", resume.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.send(buffer);
  } catch (error) {
    console.error("[resume:download]", error);
    res.status(500).json({ error: "Failed to download resume", details: error.message });
  }
});

/**
 * GET /resumes/:id/preview
 * Get resume metadata for preview (without file buffer)
 */
resumeRoutes.get("/:id/preview", async (req, res) => {
  try {
    const resume = getResumeById(req.params.id);

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    res.json({
      id: resume.id,
      name: resume.name,
      fileName: resume.fileName,
      mimeType: resume.mimeType,
      fileSize: resume.fileSize,
      uploadedAt: resume.uploadedAt,
      linkedJobId: resume.linkedJobId,
      version: resume.version,
    });
  } catch (error) {
    console.error("[resume:preview]", error);
    res.status(500).json({ error: "Failed to fetch resume", details: error.message });
  }
});

/**
 * PATCH /resumes/:id
 * Update resume metadata (name, linked job)
 */
resumeRoutes.patch("/:id", async (req, res) => {
  try {
    const { name, linkedJobId } = req.body;

    const resume = getResumeById(req.params.id);
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    if (name) resume.name = name.trim();
    if (linkedJobId !== undefined) resume.linkedJobId = linkedJobId;
    resume.updatedAt = new Date().toISOString();

    updateResume(resume);

    res.json({
      id: resume.id,
      name: resume.name,
      linkedJobId: resume.linkedJobId,
      updatedAt: resume.updatedAt,
      message: "Resume updated successfully",
    });
  } catch (error) {
    console.error("[resume:update]", error);
    res.status(500).json({ error: "Failed to update resume", details: error.message });
  }
});

/**
 * DELETE /resumes/:id
 * Delete a resume (or specific version if versionId provided)
 */
resumeRoutes.delete("/:id", async (req, res) => {
  try {
    const resume = getResumeById(req.params.id);

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    deleteResume(req.params.id);

    res.json({
      message: "Resume deleted successfully",
      resumeId: req.params.id,
    });
  } catch (error) {
    console.error("[resume:delete]", error);
    res.status(500).json({ error: "Failed to delete resume", details: error.message });
  }
});

/**
 * POST /resumes/:id/versions
 * Get version history for a resume
 */
resumeRoutes.get("/:id/versions", async (req, res) => {
  try {
    const resume = getResumeById(req.params.id);

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    // For now, return single resume as version 1
    // Future: implement full version control
    res.json({
      resumeId: resume.id,
      versions: [
        {
          version: resume.version,
          uploadedAt: resume.uploadedAt,
          fileSize: resume.fileSize,
          fileName: resume.fileName,
        },
      ],
    });
  } catch (error) {
    console.error("[resume:versions]", error);
    res.status(500).json({ error: "Failed to fetch versions", details: error.message });
  }
});

module.exports = { resumeRoutes };
