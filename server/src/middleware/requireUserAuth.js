const { env } = require("../config/env");
const { verifyAuthToken } = require("../utils/sessionToken");
const { findUserById, stripPasswordHash } = require("../store/userStore");

async function requireUserAuth(req, res, next) {
  const authHeader = String(req.headers.authorization || "").trim();
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const payload = verifyAuthToken(token, env.AUTH_TOKEN_SECRET);
  if (!payload?.sub) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  try {
    const user = await findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "User not found for this session" });
    }

    req.authUser = stripPasswordHash(user);
    return next();
  } catch (error) {
    return res.status(500).json({ error: "Unable to validate authentication", details: error.message });
  }
}

module.exports = {
  requireUserAuth,
};
