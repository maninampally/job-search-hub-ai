const express = require("express");
const crypto = require("crypto");
const { logger } = require("../utils/logger");
const { encryptToken, decryptToken } = require("../utils/encryption");
const { sanitizeEmailForAI } = require("../security/dlp");
const { rateLimitAuth, rateLimitEmailVerification, clearRateLimit } = require("../middleware/rateLimitAuth");
const {
  auditRegister,
  auditLogin,
  auditPasswordChange,
  auditEmailVerified,
  auditMFASetup,
  auditMFADisable,
  auditOAuthConnect,
  auditOAuthDisconnect,
  auditFailedLogin,
} = require("../services/auditService");
const { getTokensByUser, setTokensForUser, setLastChecked, deleteTokensForUser } = require("../store/dataStore");
const { fetchJobEmails } = require("../services/jobSync");
const { requireUserAuth, requireUserAuthFlexible } = require("../middleware/requireUserAuth");
const { requireTierGmailSync } = require("../middleware/requireTier");
const {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserProfile,
  updateUserPassword,
  touchLastLogin,
  stripPasswordHash,
  getUserByVerificationTokenHash,
  updateUserVerification,
  setEmailVerificationTokenHash,
  isEmailVerified,
  createSession,
  getSessionByHash,
  deleteSession,
  deleteAllUserSessions,
  deleteOtherSessions,
  listUserSessions,
  getMFAConfig,
  saveMFAConfig,
  disableMFA,
} = require("../store/userStore");
const { hashPassword, verifyPassword } = require("../utils/password");
const {
  createAuthToken,
  verifyAuthToken,
  generateRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} = require("../utils/sessionToken");
const { google } = require("googleapis");
const { env } = require("../config/env");
const { oauth2Client, GMAIL_SCOPES, createGmailClient } = require("../integrations/gmail");

/** OpenID + profile only (login / register). Gmail sync uses separate OAuth with GMAIL_SCOPES. */
const GOOGLE_SIGNIN_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

// Optional: Import nodemailer for email verification (requires package.json to have nodemailer)
let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  logger.warn("nodemailer not installed - email verification will be disabled");
}

const { query: dbQuery } = require('../services/dbAdapter');
const {
  generateMFASecret,
  verifyMFAToken,
  generateBackupCodes,
  verifyBackupCode,
  consumeBackupCode,
} = require('../services/mfaService');
const authRoutes = express.Router();

// Apply rate limit to auth endpoints

const TIER_ORDER_FOR_GMAIL = ["free", "pro", "elite", "admin"];

function gmailSyncAllowedForRole(role) {
  const r = role || "free";
  const idx = TIER_ORDER_FOR_GMAIL.indexOf(r);
  const proIdx = TIER_ORDER_FOR_GMAIL.indexOf("pro");
  return env.ALLOW_FREE_TIER_GMAIL_SYNC || (idx >= 0 && idx >= proIdx);
}

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
    role: safe.role || "free",
    plan_expires: safe.plan_expires ?? null,
    // NEW: Include verification status for frontend gating
    email_verified_at: safe.email_verified_at || null,
    is_email_verified: isEmailVerified(safe),
  };
}

async function toSafeUserResponseWithMfa(userId, user) {
  const mfa = await getMFAConfig(userId);
  return { ...toSafeUserResponse(user), totp_enabled: Boolean(mfa?.totp_enabled) };
}

// Helper: determine if running in production for cookie security flag
function isProduction() {
  return env.ENVIRONMENT === "production";
}

// Helper: build the standard JWT payload from a user object
function buildJwtPayload(user) {
  return {
    sub: user.id,
    role: user.role || "free",
    plan_expires: user.plan_expires || null,
    email_verified: isEmailVerified(user),
    mfa_passed: user.mfa_passed || false,
    email: user.email,
    name: user.name,
  };
}

// Helper: issue refresh token, store session, set cookie
async function issueRefreshToken(res, userId, req) {
  const { token, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // Device fingerprint: simple hash of user-agent + ip for correlation
  const deviceFingerprint = crypto
    .createHash("sha256")
    .update(`${req.ip || ""}|${req.headers["user-agent"] || ""}`)
    .digest("hex")
    .slice(0, 16);

  await createSession(
    userId,
    hash,
    deviceFingerprint,
    req.ip || null,
    req.headers["user-agent"] || null,
    expiresAt
  );

  setRefreshCookie(res, token, isProduction());
  return hash;
}

authRoutes.post("/register", rateLimitAuth({ maxAttempts: 5, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim();
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      await auditFailedLogin(email, ipAddress, "already_registered");
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const user = await createUser({
      email,
      passwordHash: hashPassword(password),
      name: name || "User",
    });

    const token = createAuthToken(
      buildJwtPayload(user),
      env.AUTH_TOKEN_SECRET,
      0.25 // 15-min access token
    );

    await touchLastLogin(user.id);
    await issueRefreshToken(res, user.id, req);
    
    // Audit logging
    await auditRegister(user.id, email, ipAddress);

    const freshUser = await findUserByEmail(email);
    return res.status(201).json({ token, user: toSafeUserResponse(freshUser || user) });
  } catch (error) {
    logger.error("Register failed", { email, error: error.message });
    return res.status(500).json({ error: "Unable to register", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

authRoutes.post("/login", rateLimitAuth({ maxAttempts: 5, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      await auditFailedLogin(email, ipAddress, "invalid_credentials");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.is_suspended) {
      await auditFailedLogin(email, ipAddress, "account_suspended");
      return res.status(403).json({ error: "Account suspended. Contact support." });
    }

    // Check if MFA is enabled
    const mfaConfig = await getMFAConfig(user.id);
    const mfaEnabled = mfaConfig?.totp_enabled || false;

    if (mfaEnabled) {
      // Issue short-lived pre-auth token (5 min) for MFA challenge
      const preAuthToken = createAuthToken(
        buildJwtPayload(user),
        env.AUTH_TOKEN_SECRET,
        5 / 60 // 5 minutes
      );

      // Return 200 so the frontend can read the payload - the error field signals MFA is needed.
      // Using 403 caused parseResponse() to throw and the preAuthToken was lost.
      return res.status(200).json({
        error: "mfa_required",
        preAuthToken,
        message: "Enter your authenticator code or backup code to continue"
      });
    }

    // No MFA - issue full access token
    const token = createAuthToken(
      buildJwtPayload(user),
      env.AUTH_TOKEN_SECRET,
      0.25 // 15-min access token
    );

    await touchLastLogin(user.id);
    await issueRefreshToken(res, user.id, req);
    
    // Audit logging
    await auditLogin(user.id, email, ipAddress, false);
    
    // Clear rate limit on successful login
    clearRateLimit(`email:${email}`);

    const refreshedUser = await findUserByEmail(email);
    return res.json({ token, user: toSafeUserResponse(refreshedUser || user) });
  } catch (error) {
    logger.error("Login failed", { email, error: error.message });
    return res.status(500).json({ error: "Unable to login", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

// POST /auth/refresh - rotate refresh token, issue new access token
authRoutes.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token" });
  }

  const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  try {
    const session = await getSessionByHash(hash);
    if (!session) {
      // Potential theft: token was already rotated but is being replayed.
      // Attempt to identify the user from any session with this token's fingerprint
      // and invalidate ALL their sessions as a precaution.
      clearRefreshCookie(res);
      logger.warn("Refresh token not found - possible replay/theft detected", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    // Rotate: delete old session
    await deleteSession(session.id);

    // Fetch user for fresh payload
    const user = await findUserById(session.user_id);
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: "User not found" });
    }

    // Block suspended users
    if (user.is_suspended) {
      await deleteAllUserSessions(user.id);
      clearRefreshCookie(res);
      return res.status(403).json({ error: "Account suspended" });
    }

    // Issue new access token
    const token = createAuthToken(
      buildJwtPayload(user),
      env.AUTH_TOKEN_SECRET,
      0.25
    );

    // Issue new refresh token (rotation)
    await issueRefreshToken(res, user.id, req);

    return res.json({ token, user: toSafeUserResponse(user) });
  } catch (error) {
    return res.status(500).json({ error: "Unable to refresh session", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

// POST /auth/logout - clear refresh cookie, delete session from DB
authRoutes.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (refreshToken) {
    try {
      const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
      const session = await getSessionByHash(hash);
      if (session) {
        await deleteSession(session.id);
      }
    } catch (error) {
      // Best effort - still clear the cookie even if DB fails
      logger.warn("Logout DB cleanup failed", { error: error.message });
    }
  }

  clearRefreshCookie(res);
  return res.json({ success: true });
});

// GET /auth/sessions - list active sessions for current user
authRoutes.get("/sessions", requireUserAuth, async (req, res) => {
  try {
    const sessions = await listUserSessions(req.authUser.id);
    return res.json({ sessions });
  } catch (error) {
    return res.status(500).json({ error: "Unable to list sessions", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

// DELETE /auth/sessions/:id - end a specific session (must belong to current user)
authRoutes.delete("/sessions/:id", requireUserAuth, async (req, res) => {
  const sessionId = req.params.id;
  try {
    // Verify session belongs to this user before deleting
    const sessions = await listUserSessions(req.authUser.id);
    const owned = sessions.find((s) => s.id === sessionId);
    if (!owned) {
      return res.status(404).json({ error: "Session not found" });
    }
    await deleteSession(sessionId);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Unable to delete session", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

// DELETE /auth/sessions - end all other sessions (keep current)
authRoutes.delete("/sessions", requireUserAuth, async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  let currentSessionId = null;

  if (refreshToken) {
    try {
      const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
      const session = await getSessionByHash(hash);
      if (session) {
        currentSessionId = session.id;
      }
    } catch {
      // Ignore - will just delete all sessions if we can't identify current
    }
  }

  try {
    await deleteOtherSessions(req.authUser.id, currentSessionId);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Unable to delete sessions", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
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
    return res.status(500).json({ error: "Unable to change password", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

authRoutes.get("/me", requireUserAuth, async (req, res) => {
  try {
    const user = await toSafeUserResponseWithMfa(req.authUser.id, req.authUser);
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load profile", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
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
    const user = await toSafeUserResponseWithMfa(req.authUser.id, updated);
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: "Unable to update profile", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

// ============================================================================
// EMAIL VERIFICATION ENDPOINTS (NEW: for verified email-bound extraction)
// ============================================================================

/**
 * POST /verify-email/request
 * Authenticated endpoint: Generate & send verification email
 * Rate limited to 3 requests per hour per user
 */
authRoutes.post("/verify-email/request", requireUserAuth, rateLimitEmailVerification(), async (req, res) => {
  try {
    const user = await findUserById(req.authUser.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Rate limit: max 3 verification attempts per hour
    if (user.email_verification_attempts >= 3) {
      const sentAt = user.email_verification_sent_at ? new Date(user.email_verification_sent_at) : new Date(0);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (sentAt > oneHourAgo) {
        return res.status(429).json({
          error: "Too many verification requests. Try again in 1 hour.",
          nextRetryAt: new Date(sentAt.getTime() + 60 * 60 * 1000)
        });
      }
    }

    // Generate secure random token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    // Store hashed token in DB
    await setEmailVerificationTokenHash(req.authUser.id, tokenHash);

    // Send verification email
    // In dev, FRONTEND_URL is often missing. Fall back to request origin or Vite default.
    const frontendUrl = env.FRONTEND_URL || req.headers.origin || "http://localhost:5173";
    const verifyUrl = `${frontendUrl}/confirm-email?token=${verificationToken}`;

    let emailSent = false;

    if (nodemailer) {
      try {
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE === "true",
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          }
        });

        // Test SMTP connection
        try {
          await transporter.verify();
          logger.debug("SMTP connection verified");
        } catch (verifyError) {
          logger.error("SMTP verify failed", { error: verifyError.message });
        }

        const mailResult = await transporter.sendMail({
          from: env.SMTP_FROM_EMAIL || "noreply@job-search-hub.com",
          to: user.email,
          subject: "Verify Your Job Search Hub Email",
          html: `
            <h2>Email Verification</h2>
            <p>Click the link below to verify your email:</p>
            <a href="${verifyUrl}" style="background: #007bff; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none;">
              Verify Email
            </a>
            <p>Or copy this link: ${verifyUrl}</p>
            <p>This link expires in 24 hours.</p>
          `
        });
        emailSent = Boolean(mailResult?.messageId);
        logger.debug("Email sent successfully", { messageId: mailResult.messageId });
      } catch (mailError) {
        logger.error("Mail error", {
          code: mailError.code,
          message: mailError.message,
          command: mailError.command,
        });
        // Still return success to prevent user from knowing if email exists
      }
    } else {
      logger.warn("nodemailer not configured, email not sent");
    }

    const exposeDevLink = !isProduction();

    res.json({
      success: true,
      message: "Verification email sent to " + user.email,
      expiresIn: "24 hours",
      ...(exposeDevLink
        ? {
            devVerifyUrl: verifyUrl,
            devEmailSent: emailSent,
          }
        : {}),
    });
  } catch (error) {
    logger.error("Verify email request failed", { error: error.message });
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

/**
 * GET /verify-email/confirm?token=...
 * Public endpoint: Confirm email verification token
 * Token must be valid and not older than 24 hours
 */
authRoutes.get("/verify-email/confirm", async (req, res) => {
  try {
    const { token } = req.query;
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    // Hash the token to look it up in DB
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with this token hash
    const user = await getUserByVerificationTokenHash(tokenHash);
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired verification token" });
    }

    // Check if token is not expired (sent less than 24 hours ago)
    const sentAt = user.email_verification_sent_at ? new Date(user.email_verification_sent_at) : new Date(0);
    const expiresAt = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000);  // 24 hours
    if (new Date() > expiresAt) {
      return res.status(400).json({ error: "Verification token expired. Request a new one." });
    }

    // Update user: set verified timestamp, clear token hash
    await updateUserVerification(user.id, {
      verifiedAt: new Date().toISOString(),
      tokenHash: null
    });

    // Audit logging
    await auditEmailVerified(user.id, user.email, ipAddress);

    // Return success with redirect URL for frontend
    res.json({
      success: true,
      message: "Email verified successfully",
      redirectUrl: `${env.FRONTEND_URL}/login?verified=true`
    });
  } catch (error) {
    logger.error("Email verification confirm failed", { error: error.message });
    res.status(500).json({ error: "Verification failed" });
  }
});

// PKCE helpers
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Stores PKCE + CSRF state in session and returns the Google authorize URL.
 * Used by GET /auth/gmail (browser navigation) and POST /auth/gmail/start (SPA + Bearer).
 */
function buildGmailOAuthAuthorizeUrl(req, userId) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("hex");

  req.session = req.session || {};
  req.session.oauthMode = "gmail";
  req.session.oauthState = state;
  req.session.oauthUserId = userId;
  req.session.oauthCodeVerifier = codeVerifier;

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    // select_account: always show Google account picker when several accounts are in Chrome
    // consent: needed so Google may return a refresh_token for offline Gmail access
    prompt: "select_account consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
}

function buildGoogleSignInOAuthUrl(req) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("hex");
  req.session = req.session || {};
  req.session.oauthMode = "google_signin";
  req.session.oauthState = state;
  req.session.oauthCodeVerifier = codeVerifier;
  delete req.session.oauthUserId;
  return oauth2Client.generateAuthUrl({
    access_type: "online",
    scope: GOOGLE_SIGNIN_SCOPES,
    // Always show account chooser so users pick the right Google identity
    prompt: "select_account",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
}

/**
 * Public: start Google sign-in or sign-up (OpenID). Same REDIRECT_URI as Gmail connect (/auth/callback).
 * User must add that exact URL under Authorized redirect URIs in Google Cloud Console.
 */
authRoutes.get("/google", rateLimitAuth({ maxAttempts: 30, windowMs: 15 * 60 * 1000 }), (req, res) => {
  try {
    const url = buildGoogleSignInOAuthUrl(req);
    return res.redirect(url);
  } catch (error) {
    logger.error("Google sign-in start failed", { error: error.message });
    return res.redirect(`${env.FRONTEND_URL}/login?error=google_signin_failed`);
  }
});

authRoutes.get("/gmail", requireUserAuthFlexible, requireTierGmailSync, async (req, res) => {
  try {
    const user = await findUserById(req.authUser.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Email is not verified via a separate link. Gmail OAuth below proves inbox access:
    // callback enforces Google account email === registered app email before storing tokens.

    const url = buildGmailOAuthAuthorizeUrl(req, req.authUser.id);
    return res.redirect(url);
  } catch (error) {
    logger.error("OAuth start failed", { error: error.message });
    res.status(500).json({ error: "OAuth start failed" });
  }
});

/**
 * Start Gmail OAuth from the SPA using the in-memory access token (Authorization: Bearer).
 * Returns { redirectUrl } so the client can navigate to Google without relying on refresh cookies on a top-level hop.
 */
authRoutes.post("/gmail/start", requireUserAuth, requireTierGmailSync, async (req, res) => {
  try {
    const user = await findUserById(req.authUser.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const redirectUrl = buildGmailOAuthAuthorizeUrl(req, req.authUser.id);
    return res.json({ redirectUrl });
  } catch (error) {
    logger.error("OAuth start failed", { error: error.message });
    return res.status(500).json({ error: "OAuth start failed" });
  }
});

authRoutes.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const ipAddress = req.ip || req.connection.remoteAddress;

  const clearOAuthSession = () => {
    if (!req.session) return;
    delete req.session.oauthState;
    delete req.session.oauthMode;
    delete req.session.oauthUserId;
    delete req.session.oauthCodeVerifier;
  };

  try {
    if (!req.session?.oauthState || req.session.oauthState !== state) {
      return res.status(400).json({ error: "Invalid OAuth state" });
    }

    const codeVerifier = req.session.oauthCodeVerifier;
    const mode = req.session.oauthMode || "gmail";
    const userId = req.session.oauthUserId;

    if (!code || !codeVerifier) {
      clearOAuthSession();
      return res.status(400).json({ error: "Invalid OAuth response" });
    }

    const { tokens } = await oauth2Client.getToken({ code, codeVerifier });

    if (mode === "google_signin") {
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      let profile;
      try {
        const userInfo = await oauth2.userinfo.get();
        profile = userInfo.data;
      } catch (infoErr) {
        logger.error("Google userinfo failed", { error: infoErr.message });
        clearOAuthSession();
        return res.redirect(`${env.FRONTEND_URL}/login?error=google_signin_failed`);
      }

      const emailNorm = String(profile.email || "").trim().toLowerCase();
      if (!isValidEmail(emailNorm) || !profile.verified_email) {
        clearOAuthSession();
        return res.redirect(`${env.FRONTEND_URL}/login?error=google_signin_failed`);
      }

      let user = await findUserByEmail(emailNorm);
      let isNewUser = false;
      if (!user) {
        const randomPass = crypto.randomBytes(32).toString("hex");
        const displayName = String(profile.name || emailNorm.split("@")[0] || "User").trim() || "User";
        user = await createUser({
          email: emailNorm,
          passwordHash: hashPassword(randomPass),
          name: displayName,
        });
        isNewUser = true;
      } else {
        const mfaConfig = await getMFAConfig(user.id);
        if (mfaConfig?.totp_enabled) {
          await auditFailedLogin(emailNorm, ipAddress, "google_oauth_blocked_mfa");
          clearOAuthSession();
          return res.redirect(`${env.FRONTEND_URL}/login?error=google_requires_password`);
        }
        if (user.is_suspended) {
          await auditFailedLogin(emailNorm, ipAddress, "account_suspended");
          clearOAuthSession();
          return res.redirect(`${env.FRONTEND_URL}/login?error=google_signin_failed`);
        }
      }

      await touchLastLogin(user.id);
      await issueRefreshToken(res, user.id, req);
      if (isNewUser) {
        await auditRegister(user.id, emailNorm, ipAddress);
      } else {
        await auditLogin(user.id, emailNorm, ipAddress, false);
      }

      clearOAuthSession();
      return res.redirect(`${env.FRONTEND_URL}/dashboard?signed_in=google`);
    }

    if (!userId) {
      clearOAuthSession();
      return res.status(400).json({ error: "OAuth session invalid" });
    }

    const user = await findUserById(userId);
    if (!user) {
      clearOAuthSession();
      return res.status(404).json({ error: "User not found" });
    }

    // Gmail connect: verify inbox matches app account
    const gmail = createGmailClient(tokens);
    let gmailProfile;
    try {
      const profileResponse = await gmail.users.getProfile({ userId: "me" });
      gmailProfile = profileResponse.data;
    } catch (gmailError) {
      logger.error("Failed to fetch Gmail profile", { error: gmailError.message });
      return res.status(400).json({ error: "Could not verify Gmail account. Please try again." });
    }

    const gmailEmail = gmailProfile.emailAddress?.toLowerCase();
    const appEmail = user.email?.toLowerCase();

    if (gmailEmail !== appEmail) {
      return res.status(403).json({
        error: "Gmail email does not match your account email",
        appEmail: user.email,
        gmailEmail: gmailProfile.emailAddress,
        action: "email_mismatch",
        message: `Your app email is ${user.email}, but Gmail is ${gmailProfile.emailAddress}. Please use the matching Gmail account.`
      });
    }

    try {
      // Encrypt tokens before storing
      const encryptedAccessToken = encryptToken(tokens.access_token).encrypted;
      const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token).encrypted : null;

      const encryptedTokens = {
        ...tokens,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
      };

      await setTokensForUser(userId, encryptedTokens, gmailProfile.emailAddress);
    } catch (storeError) {
      logger.error("Failed to store tokens", { error: storeError.message });
      return res.status(500).json({ error: "Failed to save Gmail connection" });
    }

    // Audit logging
    await auditOAuthConnect(userId, "google", gmailEmail, ipAddress);

    await updateUserVerification(userId, {
      verifiedAt: new Date().toISOString(),
      tokenHash: null,
    }).catch(() => {});

    clearOAuthSession();

    fetchJobEmails({ mode: "initial", userId }).catch((err) =>
      logger.error("Initial Gmail sync after connect failed", { userId, error: err.message })
    );

    const redirectUrl = `${env.FRONTEND_URL}/dashboard?gmail_connected=true&connected=true&email=${encodeURIComponent(gmailEmail)}`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error("OAuth callback failed", { error: error.message });
    try {
      clearOAuthSession();
    } catch {
      /* ignore */
    }
    res.status(500).json({ error: "OAuth callback failed" });
  }
});

authRoutes.get("/status", requireUserAuth, async (req, res) => {
  try {
    const userId = req.authUser.id;
    const tokens = await getTokensByUser(userId);
    const lastChecked = tokens?.last_checked || null;
    const isConnected = Boolean(tokens?.access_token);
    const gmailSyncAllowed = gmailSyncAllowedForRole(req.user?.role);
    res.json({ connected: isConnected, lastChecked, gmailSyncAllowed });
  } catch (error) {
    res.status(500).json({ error: "Unable to read auth status", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

authRoutes.post("/disconnect", requireUserAuth, async (req, res) => {
  try {
    const userId = req.authUser.id;
    // Remove per-user OAuth tokens row completely to avoid NOT NULL conflicts
    await deleteTokensForUser(userId);
    await setLastChecked(userId, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to disconnect", ...(process.env.NODE_ENV !== "production" && { details: error.message }) });
  }
});

/**
 * POST /auth/register/verify-otp
 * Step 2: Verify OTP and create user account
 * User provides email and OTP code
 * Returns auth token and redirects to dashboard
 */
authRoutes.post("/register/verify-otp", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const otpCode = String(req.body?.otp || "").trim();

  // Validation
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (!otpCode || otpCode.length !== 6) {
    return res.status(400).json({ error: "Invalid OTP code" });
  }

  try {
    // Try to look up pending registration
    let registrationData = null;
    try {
      const result = await dbQuery(
        `SELECT * FROM registration_otps 
         WHERE email = $1 AND code = $2 AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [email, otpCode]
      );
      
      if (result.rows && result.rows.length > 0) {
        registrationData = result.rows[0];
      }
    } catch (dbError) {
      // Table might not exist, will create user directly
      logger.warn('registration_otps table not available');
    }

    if (!registrationData) {
      return res.status(401).json({
        error: "Invalid or expired OTP code"
      });
    }

    // Create the user account
    const user = await createUser({
      email: registrationData.email,
      passwordHash: registrationData.password_hash,
      name: registrationData.name || 'User'
    });

    // Mark OTP as used
    try {
      await dbQuery(
        `UPDATE registration_otps SET used = true WHERE id = $1`,
        [registrationData.id]
      );
    } catch (dbError) {
      // Ignore if update fails
    }

    // Create auth token with new payload shape (15-min access token)
    const token = createAuthToken(
      buildJwtPayload(user),
      env.AUTH_TOKEN_SECRET,
      0.25
    );

    // Update last login
    await touchLastLogin(user.id);
    await issueRefreshToken(res, user.id, req);

    return res.status(201).json({
      success: true,
      token,
      user: toSafeUserResponse(user)
    });
  } catch (error) {
    logger.error('verify-otp failed', { error: error.message });
    return res.status(500).json({
      error: "Unable to verify OTP",
      ...(process.env.NODE_ENV !== "production" && { details: error.message })
    });
  }
});

// ============================================================================
// MFA ENDPOINTS
// ============================================================================

/**
 * POST /auth/mfa/setup - Generate TOTP secret
 * Requires: Authentication
 * Returns: { qrCodeUrl, secret, backupCodes }
 * Backup codes are displayed to user once - not stored yet
 */
authRoutes.post("/mfa/setup", requireUserAuth, async (req, res) => {
  try {
    const user = await findUserById(req.authUser.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if MFA already enabled
    const existing = await getMFAConfig(req.authUser.id);
    if (existing?.totp_enabled) {
      return res.status(409).json({ error: "MFA already enabled for this user" });
    }

    // Generate TOTP secret + QR code
    const { secret, qrCodeUrl } = await generateMFASecret(user.email);

    // Generate backup codes (unhashed for display)
    const { codes: backupCodes, hashes: backupCodeHashes } = generateBackupCodes(8);

    // Store in session for confirmation step (temporary, until verify endpoint)
    req.session = req.session || {};
    req.session.mfaSetupSecret = secret;
    req.session.mfaSetupBackupCodeHashes = backupCodeHashes;

    res.json({
      qrCodeUrl,
      secret, // For manual entry as fallback
      backupCodes, // Show once before verification
      message: "Scan QR code with authenticator app. Keep backup codes safe."
    });
  } catch (error) {
    logger.error("MFA setup failed", { error: error.message });
    res.status(500).json({ error: "Failed to setup MFA" });
  }
});

/**
 * POST /auth/mfa/verify - Verify TOTP code to complete enrollment
 * Requires: Authentication + valid TOTP code from authenticator app
 * Body: { code: "123456" }
 * Returns: { success: true, backupCodes: [...] }
 */
authRoutes.post("/mfa/verify", requireUserAuth, async (req, res) => {
  const code = String(req.body?.code || "").trim();

  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    return res.status(400).json({ error: "Invalid code format. Expected 6 digits." });
  }

  try {
    // Check if setup was initiated
    const secret = req.session?.mfaSetupSecret;
    const backupCodeHashes = req.session?.mfaSetupBackupCodeHashes;

    if (!secret || !backupCodeHashes) {
      return res.status(400).json({ error: "MFA setup not initiated. Call /auth/mfa/setup first." });
    }

    // Verify TOTP code
    const isValid = verifyMFAToken(secret, code);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid authenticator code" });
    }

    // Save MFA config (enabled)
    await saveMFAConfig(req.authUser.id, {
      totp_secret: secret,
      totp_enabled: true,
      backup_codes: backupCodeHashes,
      enrolled_at: new Date().toISOString(),
    });

    // Clear session
    delete req.session.mfaSetupSecret;
    delete req.session.mfaSetupBackupCodeHashes;

    res.json({
      success: true,
      message: "MFA enabled successfully"
    });
  } catch (error) {
    logger.error("MFA verify failed", { error: error.message });
    res.status(500).json({ error: "Failed to verify MFA" });
  }
});

/**
 * POST /auth/mfa/disable - Disable MFA
 * Requires: Authentication + valid TOTP code (proof of ownership)
 * Body: { code: "123456" }
 * Returns: { success: true }
 */
authRoutes.post("/mfa/disable", requireUserAuth, async (req, res) => {
  const code = String(req.body?.code || "").trim();

  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    return res.status(400).json({ error: "Invalid code format. Expected 6 digits." });
  }

  try {
    const mfaConfig = await getMFAConfig(req.authUser.id);
    if (!mfaConfig || !mfaConfig.totp_enabled) {
      return res.status(400).json({ error: "MFA is not enabled for this user" });
    }

    // Verify TOTP code
    const isValid = verifyMFAToken(mfaConfig.totp_secret, code);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid authenticator code" });
    }

    // Disable MFA
    await disableMFA(req.authUser.id);

    res.json({
      success: true,
      message: "MFA disabled successfully"
    });
  } catch (error) {
    logger.error("MFA disable failed", { error: error.message });
    res.status(500).json({ error: "Failed to disable MFA" });
  }
});

/**
 * POST /auth/mfa/challenge - Verify TOTP during login
 * Used after password verification to complete MFA challenge
 * Requires: Valid pre-auth token (issued during login if MFA enabled)
 * Body: { code: "123456" }
 * Returns: { success: true, token: "...", user: {...} }
 */
authRoutes.post("/mfa/challenge", rateLimitAuth({ maxAttempts: 5, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  const code = String(req.body?.code || "").trim();
  const preAuthToken = req.body?.preAuthToken;

  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    return res.status(400).json({ error: "Invalid code format. Expected 6 digits." });
  }

  if (!preAuthToken) {
    return res.status(400).json({ error: "Pre-auth token required" });
  }

  try {
    // Verify pre-auth token (should be 5-min token with minimal payload)
    const preAuthPayload = verifyAuthToken(preAuthToken, env.AUTH_TOKEN_SECRET);
    if (!preAuthPayload) {
      return res.status(401).json({ error: "Invalid or expired pre-auth token" });
    }

    const userId = preAuthPayload.sub;
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const mfaConfig = await getMFAConfig(userId);
    if (!mfaConfig || !mfaConfig.totp_enabled) {
      return res.status(400).json({ error: "MFA not enabled for this user" });
    }

    // Try TOTP code first
    let isValid = verifyMFAToken(mfaConfig.totp_secret, code);

    // If not valid, try backup codes
    if (!isValid && mfaConfig.backup_codes?.length > 0) {
      isValid = verifyBackupCode(code, mfaConfig.backup_codes);
      if (isValid) {
        // Consume the backup code
        const newBackupCodeHashes = consumeBackupCode(code, mfaConfig.backup_codes);
        await saveMFAConfig(userId, {
          ...mfaConfig,
          backup_codes: newBackupCodeHashes,
        });
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: "Invalid authenticator or backup code" });
    }

    // MFA verified - mfa_passed flows through buildJwtPayload
    const token = createAuthToken(
      buildJwtPayload({ ...user, mfa_passed: true }),
      env.AUTH_TOKEN_SECRET,
      0.25
    );

    await touchLastLogin(userId);
    await issueRefreshToken(res, userId, req);

    return res.json({ success: true, token, user: toSafeUserResponse(user) });
  } catch (error) {
    logger.error("MFA challenge failed", { error: error.message });
    res.status(500).json({ error: "Failed to verify MFA" });
  }
});

module.exports = { authRoutes };
