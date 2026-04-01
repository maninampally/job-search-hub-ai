const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const { getResumes, addResume, getResumeById, updateResume, deleteResume } = require("../store/dataStore");

const resumeRoutes = express.Router();

function getAuthenticatedUserId(req) {
  return req.authUser?.id || null;
}

// Uploads directory — persisted on disk (mount as Docker volume in production)
const UPLOADS_DIR = path.resolve(__dirname, "../../data/uploads/resumes");

// Ensure uploads directory exists on startup
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${unique}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF and DOCX files are allowed"));
  },
});

// POST /resumes/upload
resumeRoutes.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { name, linkedJobId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Resume name is required" });

    const metadata = await addResume({
      name:        name.trim(),
      fileName:    req.file.originalname,
      filePath:    req.file.path,
      mimeType:    req.file.mimetype,
      fileSize:    req.file.size,
      linkedJobId: linkedJobId || null,
      isPrimary:   false,
      uploadedAt:  new Date().toISOString(),
    }, { userId });

    res.json({
      id:         metadata.id,
      name:       metadata.name,
      fileName:   metadata.fileName,
      uploadedAt: metadata.uploadedAt,
      message:    "Resume uploaded successfully",
    });
  } catch (error) {
    // Clean up the uploaded file if DB write fails
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error("[resume:upload]", error);
    res.status(500).json({ error: "Failed to upload resume", details: error.message });
  }
});

// GET /resumes
resumeRoutes.get("/", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { jobId, name } = req.query;
    const resumes = await getResumes({ jobId, name }, { userId });
    // Strip filePath from response — clients don't need the server path
    res.json(resumes.map(({ filePath: _fp, fileBuffer: _fb, ...rest }) => rest));
  } catch (error) {
    console.error("[resume:list]", error);
    res.status(500).json({ error: "Failed to fetch resumes", details: error.message });
  }
});

// GET /resumes/:id/download
resumeRoutes.get("/:id/download", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const resume = await getResumeById(req.params.id, { userId });
    if (!resume) return res.status(404).json({ error: "Resume not found" });

    const ext = path.extname(resume.fileName || resume.name || "file");
    const downloadName = `${(resume.name || "resume").replace(/\s+/g, "_")}${ext}`;

    // New path: stream from disk
    if (resume.filePath && fs.existsSync(resume.filePath)) {
      res.setHeader("Content-Type", resume.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      return fs.createReadStream(resume.filePath).pipe(res);
    }

    // Legacy backward compat: serve from base64 buffer in local JSON
    if (resume.fileBuffer) {
      const buffer = Buffer.from(resume.fileBuffer, "base64");
      res.setHeader("Content-Type", resume.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      return res.send(buffer);
    }

    return res.status(404).json({ error: "Resume file not found on server" });
  } catch (error) {
    console.error("[resume:download]", error);
    res.status(500).json({ error: "Failed to download resume", details: error.message });
  }
});

// GET /resumes/:id/view
resumeRoutes.get("/:id/view", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const resume = await getResumeById(req.params.id, { userId });
    if (!resume) return res.status(404).json({ error: "Resume not found" });

    const ext = path.extname(resume.fileName || resume.name || "file");
    const viewName = `${(resume.name || "resume").replace(/\s+/g, "_")}${ext}`;

    if (resume.filePath && fs.existsSync(resume.filePath)) {
      res.setHeader("Content-Type", resume.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${viewName}"`);
      return fs.createReadStream(resume.filePath).pipe(res);
    }

    if (resume.fileBuffer) {
      const buffer = Buffer.from(resume.fileBuffer, "base64");
      res.setHeader("Content-Type", resume.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${viewName}"`);
      return res.send(buffer);
    }

    return res.status(404).json({ error: "Resume file not found on server" });
  } catch (error) {
    console.error("[resume:view]", error);
    res.status(500).json({ error: "Failed to view resume", details: error.message });
  }
});

// GET /resumes/:id/preview
resumeRoutes.get("/:id/preview", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const resume = await getResumeById(req.params.id, { userId });
    if (!resume) return res.status(404).json({ error: "Resume not found" });
    const { filePath: _fp, fileBuffer: _fb, ...meta } = resume;
    res.json(meta);
  } catch (error) {
    console.error("[resume:preview]", error);
    res.status(500).json({ error: "Failed to fetch resume", details: error.message });
  }
});

// PATCH /resumes/:id
resumeRoutes.patch("/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const resume = await getResumeById(req.params.id, { userId });
    if (!resume) return res.status(404).json({ error: "Resume not found" });

    const patch = {};
    if (req.body.name        !== undefined) patch.name        = req.body.name.trim();
    if (req.body.linkedJobId !== undefined) patch.linkedJobId = req.body.linkedJobId;
    if (req.body.isPrimary   !== undefined) patch.isPrimary   = Boolean(req.body.isPrimary);

    const updated = await updateResume(req.params.id, patch, { userId });
    const { filePath: _fp, fileBuffer: _fb, ...meta } = updated;
    res.json({ ...meta, message: "Resume updated successfully" });
  } catch (error) {
    console.error("[resume:update]", error);
    res.status(500).json({ error: "Failed to update resume", details: error.message });
  }
});

// DELETE /resumes/:id
resumeRoutes.delete("/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const resume = await getResumeById(req.params.id, { userId });
    if (!resume) return res.status(404).json({ error: "Resume not found" });

    // Delete physical file if it exists
    if (resume.filePath && fs.existsSync(resume.filePath)) {
      await fsPromises.unlink(resume.filePath).catch(() => {});
    }

    await deleteResume(req.params.id, { userId });
    res.json({ message: "Resume deleted successfully", resumeId: req.params.id });
  } catch (error) {
    console.error("[resume:delete]", error);
    res.status(500).json({ error: "Failed to delete resume", details: error.message });
  }
});

// GET /resumes/:id/versions
resumeRoutes.get("/:id/versions", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const resume = await getResumeById(req.params.id, { userId });
    if (!resume) return res.status(404).json({ error: "Resume not found" });

    // Return all resumes with the same display name, oldest first, as version history
    const allResumes = await getResumes({ name: resume.name }, { userId });
    const sorted = allResumes
      .filter((r) => r.name === resume.name)
      .sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));

    const versions = sorted.map((r, index) => ({
      version: index + 1,
      resumeId: r.id,
      uploadedAt: r.uploadedAt,
      fileSize: r.fileSize,
      fileName: r.fileName,
      isCurrent: r.id === resume.id,
    }));

    res.json({ resumeId: resume.id, versions });
  } catch (error) {
    console.error("[resume:versions]", error);
    res.status(500).json({ error: "Failed to fetch versions", details: error.message });
  }
});

module.exports = { resumeRoutes };
