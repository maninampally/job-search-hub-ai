const express = require("express");
const {
  clearTokens,
  getLastChecked,
  getTokens,
  setTokens,
} = require("../store/dataStore");
const { requireUserAuth } = require("../middleware/requireUserAuth");
const {
  findUserByEmail,
  createUser,
  updateUserProfile,
  updateUserPassword,
  touchLastLogin,
  stripPasswordHash,
} = require("../store/userStore");
const { hashPassword, verifyPassword } = require("../utils/password");
const { createAuthToken } = require("../utils/sessionToken");
const { env } = require("../config/env");
const { oauth2Client, GMAIL_SCOPES } = require("../integrations/gmail");

const authRoutes = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim().toLowerCase());
}

function toSafeUserResponse(user) {
  const safe = stripPasswordHash(user);
  return {
    id: safe.id,
    email: safe.email,
    name: safe.name,
    headline: safe.headline || "",
    location: safe.location || "",
    bio: safe.bio || "",
    createdAt: safe.createdAt,
    updatedAt: safe.updatedAt,
    lastLoginAt: safe.lastLoginAt || null,
  };
}

authRoutes.post("/register", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim();

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const user = await createUser({
      email,
      passwordHash: hashPassword(password),
      name: name || "User",
    });

    const token = createAuthToken(
      { sub: user.id, email: user.email, name: user.name },
      env.AUTH_TOKEN_SECRET,
      env.AUTH_TOKEN_TTL_HOURS
    );

    await touchLastLogin(user.id);
    const freshUser = await findUserByEmail(email);
    return res.status(201).json({ token, user: toSafeUserResponse(freshUser || user) });
  } catch (error) {
    return res.status(500).json({ error: "Unable to register", details: error.message });
  }
});

authRoutes.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = createAuthToken(
      { sub: user.id, email: user.email, name: user.name },
      env.AUTH_TOKEN_SECRET,
      env.AUTH_TOKEN_TTL_HOURS
    );

    await touchLastLogin(user.id);
    const refreshedUser = await findUserByEmail(email);
    return res.json({ token, user: toSafeUserResponse(refreshedUser || user) });
  } catch (error) {
    return res.status(500).json({ error: "Unable to login", details: error.message });
  }
});

authRoutes.post("/change-password", requireUserAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword) {
    return res.status(400).json({ error: "Current password is required" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  try {
    const user = await findUserByEmail(req.authUser.email);
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    await updateUserPassword(user.id, hashPassword(newPassword));
    return res.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    return res.status(500).json({ error: "Unable to change password", details: error.message });
  }
});

authRoutes.get("/me", requireUserAuth, async (req, res) => {
  return res.json({ user: req.authUser });
});

authRoutes.patch("/me", requireUserAuth, async (req, res) => {
  const patch = {
    name: req.body?.name,
    headline: req.body?.headline,
    location: req.body?.location,
    bio: req.body?.bio,
  };

  try {
    const updated = await updateUserProfile(req.authUser.id, patch);
    if (!updated) {
      return res.status(404).json({ error: "User profile not found" });
    }
    return res.json({ user: toSafeUserResponse(updated) });
  } catch (error) {
    return res.status(500).json({ error: "Unable to update profile", details: error.message });
  }
});

authRoutes.get("/gmail", (req, res) => {
  const userId = String(req.query.userId || "").trim();
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent",
    state,
  });
  res.redirect(url);
});

authRoutes.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  let userId = null;
  try {
    if (state) {
      const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
      userId = parsed.userId || null;
    }
  } catch {
    // state decode failed — proceed without userId
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    await setTokens(tokens, { userId });
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
