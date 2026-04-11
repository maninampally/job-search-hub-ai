const express = require("express");
const {
  getUnreadNotifications,
  markNotificationRead,
  markAllRead,
} = require("../services/notificationService");

const notificationRoutes = express.Router();

notificationRoutes.get("/", async (req, res) => {
  try {
    const notifications = await getUnreadNotifications(req.authUser.id);
    return res.json({ notifications });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

notificationRoutes.patch("/:id/read", async (req, res) => {
  try {
    await markNotificationRead(req.params.id, req.authUser.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to mark notification" });
  }
});

notificationRoutes.post("/read-all", async (req, res) => {
  try {
    await markAllRead(req.authUser.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to mark all read" });
  }
});

module.exports = { notificationRoutes };
