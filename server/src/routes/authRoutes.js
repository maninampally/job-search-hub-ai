const express = require("express");
const { store } = require("../store/memoryStore");
const { env } = require("../config/env");
const { oauth2Client, GMAIL_SCOPES } = require("../integrations/gmail");

const authRoutes = express.Router();

authRoutes.get("/gmail", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent",
  });
  res.redirect(url);
});

authRoutes.get("/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    store.tokens = tokens;
    oauth2Client.setCredentials(tokens);
    res.redirect(`${env.FRONTEND_URL}?connected=true`);
  } catch (error) {
    res.status(500).json({ error: "OAuth failed", details: error.message });
  }
});

authRoutes.get("/status", (req, res) => {
  res.json({ connected: Boolean(store.tokens), lastChecked: store.lastChecked });
});

authRoutes.post("/disconnect", (req, res) => {
  store.tokens = null;
  res.json({ success: true });
});

module.exports = { authRoutes };
