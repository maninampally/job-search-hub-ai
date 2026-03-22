const express = require("express");
const {
  clearTokens,
  getLastChecked,
  getTokens,
  setTokens,
} = require("../store/dataStore");
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
    await setTokens(tokens);
    oauth2Client.setCredentials(tokens);
    res.redirect(`${env.FRONTEND_URL}?connected=true`);
  } catch (error) {
    res.status(500).json({ error: "OAuth failed", details: error.message });
  }
});

authRoutes.get("/status", async (req, res) => {
  try {
    const tokens = await getTokens();
    const lastChecked = await getLastChecked();
    res.json({ connected: Boolean(tokens), lastChecked });
  } catch (error) {
    res.status(500).json({ error: "Unable to read auth status", details: error.message });
  }
});

authRoutes.post("/disconnect", async (req, res) => {
  try {
    await clearTokens();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to disconnect", details: error.message });
  }
});

module.exports = { authRoutes };
