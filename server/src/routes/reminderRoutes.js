const express = require("express");
const {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
} = require("../store/dataStore");

const reminderRoutes = express.Router();

function getAuthenticatedUserId(req) {
  return req.authUser?.id || null;
}

// GET /reminders - fetch all reminders, optionally filtered by job_id or status
reminderRoutes.get("/", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { jobId, isDone } = req.query;

    const reminders = await getReminders({
      jobId: jobId || undefined,
      isDone: isDone === "true" ? true : isDone === "false" ? false : undefined,
    }, { userId });

    res.json({ reminders });
  } catch (error) {
    console.error("[reminders:list]", error.message);
    res.status(500).json({ error: "Failed to fetch reminders", details: error.message });
  }
});

// POST /reminders - create new reminder
reminderRoutes.post("/", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { jobId, title, dueDate, notes } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: "Reminder title is required" });
    }

    const reminder = await createReminder({
      jobId: jobId || null,
      title: title.trim(),
      dueDate: dueDate || null,
      notes: notes || null,
    }, { userId });

    res.json({ reminder, message: "Reminder created successfully" });
  } catch (error) {
    console.error("[reminders:create]", error.message);
    res.status(500).json({ error: "Failed to create reminder", details: error.message });
  }
});

// PATCH /reminders/:id - update reminder
reminderRoutes.patch("/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { title, dueDate, isDone, notes } = req.body;

    const patch = {};
    if (title !== undefined) patch.title = title;
    if (dueDate !== undefined) patch.dueDate = dueDate;
    if (isDone !== undefined) patch.isDone = isDone;
    if (notes !== undefined) patch.notes = notes;

    const reminder = await updateReminder(req.params.id, patch, { userId });

    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    res.json({ reminder, message: "Reminder updated successfully" });
  } catch (error) {
    console.error("[reminders:update]", error.message);
    res.status(500).json({ error: "Failed to update reminder", details: error.message });
  }
});

// DELETE /reminders/:id - delete reminder
reminderRoutes.delete("/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    await deleteReminder(req.params.id, { userId });
    res.json({ message: "Reminder deleted successfully" });
  } catch (error) {
    console.error("[reminders:delete]", error.message);
    res.status(500).json({ error: "Failed to delete reminder", details: error.message });
  }
});

module.exports = { reminderRoutes };
