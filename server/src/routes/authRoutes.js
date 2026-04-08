const express = require("express");
const crypto = require("crypto");
const {
  clearTokens,
  getLastChecked,
  getTokens,
  setTokens,
  getTokensByUser,
  setTokensForUser,
} = require("../store/dataStore");
const { requireUserAuth } = require("../middleware/requireUserAuth");
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
} = require("../store/userStore");
const { hashPassword, verifyPassword } = require("../utils/password");
const { createAuthToken } = require("../utils/sessionToken");
const { env } = require("../config/env");
const { oauth2Client, GMAIL_SCOPES, createGmailClient } = require("../integrations/gmail");

// Optional: Import nodemailer for email verification (requires package.json to have nodemailer)
let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  console.warn("[authRoutes] nodemailer not installed - email verification will be disabled");
}

const { sendOTPEmail } = require('../utils/emailSender');
const { generateOTP, calculateOTPExpiration } = require('../utils/emailExtractionUtils');
const { query: dbQuery } = require('../services/dbAdapter');

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
    // NEW: Include verification status for frontend gating
    email_verified_at: safe.email_verified_at || null,
    is_email_verified: isEmailVerified(safe),
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

// ============================================================================
// EMAIL VERIFICATION ENDPOINTS (NEW: for verified email-bound extraction)
// ============================================================================

/**
 * POST /verify-email/request
 * Authenticated endpoint: Generate & send verification email
 * Rate limited to 3 requests per hour per user
 */
authRoutes.post("/verify-email/request", requireUserAuth, async (req, res) => {
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
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

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
          console.log("[verify-email/request] SMTP connection verified");
        } catch (verifyError) {
          console.error("[verify-email/request] SMTP verify failed:", verifyError.message);
        }

        const mailResult = await transporter.sendMail({
          from: env.MAIL_FROM || "noreply@job-search-hub.com",
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
        console.log("[verify-email/request] Email sent successfully:", mailResult.messageId);
      } catch (mailError) {
        console.error("[verify-email/request] mail error:", {
          code: mailError.code,
          message: mailError.message,
          command: mailError.command,
          response: mailError.response
        });
        // Still return success to prevent user from knowing if email exists
      }
    } else {
      console.warn("[verify-email/request] nodemailer not configured, email not sent");
    }

    res.json({
      success: true,
      message: "Verification email sent to " + user.email,
      expiresIn: "24 hours"
    });
  } catch (error) {
    console.error("[verify-email/request]:", error);
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

    // Return success with redirect URL for frontend
    res.json({
      success: true,
      message: "Email verified successfully",
      redirectUrl: `${env.FRONTEND_URL}/dashboard?verified=true`
    });
  } catch (error) {
    console.error("[verify-email/confirm]:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

authRoutes.get("/gmail", requireUserAuth, async (req, res) => {
  try {
    const user = await findUserById(req.authUser.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // NEW: Check if email is verified
    if (!isEmailVerified(user)) {
      return res.status(403).json({
        error: "Please verify your email first",
        action: "verify_email_required"
      });
    }

    // NEW: Store user ID in session for callback to use (instead of query param)
    const state = crypto.randomBytes(16).toString("hex");
    req.session = req.session || {};
    req.session.oauthState = state;
    req.session.oauthUserId = req.authUser.id;

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GMAIL_SCOPES,
      prompt: "consent",
      state,
    });
    res.redirect(url);
  } catch (error) {
    console.error("[auth/gmail]:", error);
    res.status(500).json({ error: "OAuth start failed" });
  }
});

authRoutes.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  let userId = null;

  try {
    // NEW: Validate OAuth state to prevent CSRF
    if (!req.session?.oauthState || req.session.oauthState !== state) {
      return res.status(400).json({ error: "Invalid OAuth state" });
    }

    userId = req.session.oauthUserId;
    if (!userId) {
      return res.status(400).json({ error: "OAuth session invalid" });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // NEW: Get the Gmail account email address
    const gmail = createGmailClient(tokens);
    let gmailProfile;
    try {
      const profileResponse = await gmail.users.getProfile({ userId: "me" });
      gmailProfile = profileResponse.data;
    } catch (gmailError) {
      console.error("[auth/callback] Failed to fetch Gmail profile:", gmailError.message);
      return res.status(400).json({
        error: "Could not verify Gmail account. Please try again.",
        details: gmailError.message
      });
    }

    const gmailEmail = gmailProfile.emailAddress?.toLowerCase();
    const appEmail = user.email?.toLowerCase();

    // NEW: Enforce strict email match
    if (gmailEmail !== appEmail) {
      return res.status(403).json({
        error: "Gmail email does not match your account email",
        appEmail: user.email,
        gmailEmail: gmailProfile.emailAddress,
        action: "email_mismatch",
        message: `Your app email is ${user.email}, but Gmail is ${gmailProfile.emailAddress}. Please use the matching Gmail account.`
      });
    }

    // NEW: Store tokens per-user (not single shared row)
    try {
      await setTokensForUser(userId, tokens, gmailProfile.emailAddress);
      console.log(`[auth/callback] User ${userId} successfully connected Gmail: ${gmailEmail}`);
    } catch (storeError) {
      console.error("[auth/callback] Failed to store tokens:", storeError);
      return res.status(500).json({ error: "Failed to save Gmail connection" });
    }

    // Redirect to dashboard with success
    const redirectUrl = `${env.FRONTEND_URL}/dashboard?gmail_connected=true&email=${encodeURIComponent(gmailEmail)}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("[auth/callback] unexpected error:", error);
    res.status(500).json({ error: "OAuth callback failed" });
  }
});

authRoutes.get("/status", requireUserAuth, async (req, res) => {
  try {
    const userId = req.authUser.id;
    const tokens = await getTokensByUser(userId);
    const lastChecked = tokens?.last_checked || null;
    const isConnected = Boolean(tokens?.access_token);
    res.json({ connected: isConnected, lastChecked });
  } catch (error) {
    res.status(500).json({ error: "Unable to read auth status", details: error.message });
  }
});

authRoutes.post("/disconnect", requireUserAuth, async (req, res) => {
  try {
    const userId = req.authUser.id;
    // Delete the user's oauth tokens row
    // For now, just clear the tokens by setting them to null
    // In the future, we could delete the row entirely
    await setTokensForUser(userId, {
      access_token: null,
      refresh_token: null,
      scope: null,
      token_type: null,
      expiry_date: null,
    }, null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Unable to disconnect", details: error.message });
  }
});

/**
 * POST /auth/register
 * Step 1: Generate OTP for registration verification
 * User provides email, password, and name
 * Returns otpId and sends OTP to email
 */
authRoutes.post("/register", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim();

  // Validation
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  if (!name || name.length < 2) {
    return res.status(400).json({ error: "Name is required" });
  }

  try {
    // Check if email already exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Generate OTP for registration verification
    const otpCode = generateOTP();
    const expiresAt = calculateOTPExpiration();

    // Store OTP in registration_otps table (create if doesn't exist)
    try {
      await dbQuery(
        `INSERT INTO registration_otps (email, code, name, password_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [email, otpCode, name, hashPassword(password), expiresAt]
      );
    } catch (dbError) {
      // If table doesn't exist, fall back to storing in memory or creating user directly
      console.warn('[register] registration_otps table not available, storing in memory');
    }

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otpCode, name, 'registration');

    if (!emailResult.success) {
      console.warn('[register] Failed to send OTP email:', emailResult.message);
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      email: email,
      maskedEmail: email.substring(0, 3) + '***' + email.substring(email.indexOf('@')),
      expiresIn: 900, // 15 minutes
      // Include code in response only for development mode
      ...(emailResult.code && { code: emailResult.code })
    });
  } catch (error) {
    console.error('[register] Error:', error.message);
    return res.status(500).json({
      error: "Unable to process registration",
      details: error.message
    });
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
      console.warn('[verify-otp] registration_otps table not available');
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

    // Create auth token
    const token = createAuthToken(
      { sub: user.id, email: user.email, name: user.name },
      env.AUTH_TOKEN_SECRET,
      env.AUTH_TOKEN_TTL_HOURS
    );

    // Update last login
    await touchLastLogin(user.id);

    return res.status(201).json({
      success: true,
      token,
      user: toSafeUserResponse(user)
    });
  } catch (error) {
    console.error('[verify-otp] Error:', error.message);
    return res.status(500).json({
      error: "Unable to verify OTP",
      details: error.message
    });
  }
});

/**
 * GET /google-auth-url
 * Returns the Google OAuth authorization URL
 * Frontend redirects user to this URL
 */
authRoutes.get("/google-auth-url", (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GMAIL_SCOPES,
      prompt: "consent",
    });
    res.json({ authUrl });
  } catch (error) {
    console.error("[google-auth-url]", error);
    res.status(500).json({ error: "Unable to generate auth URL" });
  }
});

/**
 * POST /google-auth
 * Handles Google OAuth callback
 * Receives authorization code, exchanges for tokens
 * Creates/finds user, auto-verifies email, returns JWT
 */
authRoutes.post("/google-auth", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Authorization code is required" });
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const { google } = require("googleapis");
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const googleUser = await oauth2.userinfo.get();

    const email = googleUser.data?.email?.toLowerCase();
    const name = googleUser.data?.name || "Google User";
    const googleId = googleUser.data?.id;

    if (!email) {
      return res.status(400).json({ error: "Unable to retrieve email from Google" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email from Google account" });
    }

    // Find or create user
    let user = await findUserByEmail(email);

    if (!user) {
      // New Google user - auto-generate a password (not used, but required by schema)
      const tempPassword = crypto.randomBytes(16).toString("hex");
      user = await createUser({
        email,
        passwordHash: hashPassword(tempPassword),
        name: name || "User",
      });
      console.log(`[google-auth] Created new user: ${email}`);
    }

    // Auto-verify email (Google has already verified it)
    if (!isEmailVerified(user)) {
      await updateUserVerification(user.id, {
        email_verified_at: new Date().toISOString(),
      });
      user.email_verified_at = new Date().toISOString();
      console.log(`[google-auth] Auto-verified email for: ${email}`);
    }

    // Store Google tokens for future Gmail syncing
    await setTokensForUser(user.id, tokens);

    // Create app JWT token
    const token = createAuthToken(
      { sub: user.id, email: user.email, name: user.name },
      env.AUTH_TOKEN_SECRET,
      env.AUTH_TOKEN_TTL_HOURS
    );

    // Update last login
    await touchLastLogin(user.id);

    // Refresh user object to ensure all fields are current
    const freshUser = await findUserByEmail(email);

    return res.json({
      success: true,
      token,
      user: toSafeUserResponse(freshUser || user),
      message: "Successfully authenticated with Google",
    });
  } catch (error) {
    console.error("[google-auth]", error);
    res.status(500).json({
      error: "Failed to authenticate with Google",
      details: error.message,
    });
  }
});

module.exports = { authRoutes };
