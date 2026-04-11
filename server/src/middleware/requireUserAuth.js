const crypto = require("crypto");
const { env } = require("../config/env");
const { verifyAuthToken, REFRESH_COOKIE_NAME } = require("../utils/sessionToken");
const { findUserById, stripPasswordHash, isEmailVerified, getSessionByHash } = require("../store/userStore");

function attachUserToRequest(req, user, jwtPayload = null) {
  req.authUser = stripPasswordHash(user);
  req.user = {
    id: user.id,
    role: user.role || "free",
    plan_expires: user.plan_expires != null && user.plan_expires !== undefined ? user.plan_expires : null,
    email_verified: isEmailVerified(user),
    // Use mfa_passed from JWT payload, not database (it's session-specific, not persisted)
    mfa_passed: jwtPayload?.mfa_passed || false,
  };
}

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

    attachUserToRequest(req, user, payload);

    return next();
  } catch (error) {
    return res.status(500).json({ error: "Unable to validate authentication", details: error.message });
  }
}

/**
 * For browser navigations (e.g. Connect Gmail): Authorization header is not sent.
 * Accepts Bearer token if present, otherwise validates the httpOnly refresh cookie (same as /auth/refresh).
 * Does not rotate the refresh token (read-only session check).
 */
async function requireUserAuthFlexible(req, res, next) {
  const authHeader = String(req.headers.authorization || "").trim();
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (bearer) {
    const payload = verifyAuthToken(bearer, env.AUTH_TOKEN_SECRET);
    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    try {
      const user = await findUserById(payload.sub);
      if (!user) return res.status(401).json({ error: "User not found for this session" });
      attachUserToRequest(req, user, payload);
      return next();
    } catch (error) {
      return res.status(500).json({ error: "Unable to validate authentication", details: error.message });
    }
  }

  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    return res.status(401).json({
      error: "Authentication required",
      hint: "Log in again, then use Connect Gmail from the app while on the same browser.",
    });
  }

  const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  try {
    const session = await getSessionByHash(hash);
    if (!session) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }
    const user = await findUserById(session.user_id);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.is_suspended) return res.status(403).json({ error: "Account suspended" });
    // For refresh tokens, mfa_passed is false (user needs to re-auth if MFA is required)
    attachUserToRequest(req, user, { mfa_passed: false });
    return next();
  } catch (error) {
    return res.status(500).json({ error: "Unable to validate session", details: error.message });
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
  requireUserAuthFlexible,
  requireEmailVerified,
};
