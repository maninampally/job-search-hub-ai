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

    // Attach tier/auth fields from the JWT payload so downstream middleware
    // (requireTier, requireAdmin) can use them without an extra DB round-trip.
    // These come from the token, not the DB, because they are embedded at login time.
    req.user = {
      id: payload.sub,
      role: payload.role || "free",
      plan_expires: payload.plan_expires || null,
      email_verified: payload.email_verified || false,
      mfa_passed: payload.mfa_passed || false,
    };

    return next();
  } catch (error) {
    return res.status(500).json({ error: "Unable to validate authentication", details: error.message });
  }
}

/**
 * requireEmailVerified - middleware that checks the user has verified their email.
 * Checks both req.authUser (DB data) and req.user (JWT payload).
 * Returns 403 if not verified.
 */
function requireEmailVerified() {
  return function emailVerifiedMiddleware(req, res, next) {
    const verifiedInDb = req.authUser?.is_email_verified || Boolean(req.authUser?.email_verified_at);
    const verifiedInToken = req.user?.email_verified || false;

    if (!verifiedInDb && !verifiedInToken) {
      return res.status(403).json({
        error: "email_not_verified",
        action: "verify_email_required",
      });
    }

    return next();
  };
}

module.exports = {
  requireUserAuth,
  requireEmailVerified,
};
