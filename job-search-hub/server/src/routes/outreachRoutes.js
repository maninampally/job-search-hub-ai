const express = require("express");
const {
  getOutreach,
  createOutreach,
  updateOutreach,
  deleteOutreach,
} = require("../store/dataStore");

const outreachRoutes = express.Router();

function getAuthenticatedUserId(req) {
  return req.authUser?.id || null;
}

// GET /outreach - fetch all outreach logs, optionally filtered by contact or job
outreachRoutes.get("/", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { contactId, jobId, type } = req.query;

    const outreach = await getOutreach({
      contactId: contactId || undefined,
      jobId: jobId || undefined,
      type: type || undefined,
    }, { userId });

    res.json({ outreach });
  } catch (error) {
    console.error("[outreach:list]", error.message);
    res.status(500).json({ error: "Failed to fetch outreach logs", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

// POST /outreach - create new outreach log
outreachRoutes.post("/", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { contactId, jobId, type, message, sentAt, notes, responseReceived } = req.body;

    if (!type || type.trim().length === 0) {
      return res.status(400).json({ error: "Outreach type is required" });
    }

    const outreach = await createOutreach({
      contactId: contactId || null,
      jobId: jobId || null,
      type: type.trim(),
      message: message || null,
      sentAt: sentAt || new Date().toISOString(),
      responseReceived: responseReceived ?? false,
      notes: notes || null,
    }, { userId });

    res.json({ outreach, message: "Outreach logged successfully" });
  } catch (error) {
    console.error("[outreach:create]", error.message);
    res.status(500).json({ error: "Failed to create outreach log", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

// PATCH /outreach/:id - update outreach log
outreachRoutes.patch("/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { type, message, sentAt, responseReceived, notes } = req.body;

    const patch = {};
    if (type !== undefined) patch.type = type;
    if (message !== undefined) patch.message = message;
    if (sentAt !== undefined) patch.sentAt = sentAt;
    if (responseReceived !== undefined) patch.responseReceived = responseReceived;
    if (notes !== undefined) patch.notes = notes;

    const outreach = await updateOutreach(req.params.id, patch, { userId });

    if (!outreach) {
      return res.status(404).json({ error: "Outreach log not found" });
    }

    res.json({ outreach, message: "Outreach log updated successfully" });
  } catch (error) {
    console.error("[outreach:update]", error.message);
    res.status(500).json({ error: "Failed to update outreach log", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

// DELETE /outreach/:id - delete outreach log
outreachRoutes.delete("/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    await deleteOutreach(req.params.id, { userId });
    res.json({ message: "Outreach log deleted successfully" });
  } catch (error) {
    console.error("[outreach:delete]", error.message);
    res.status(500).json({ error: "Failed to delete outreach log", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

module.exports = { outreachRoutes };
