const crypto = require("crypto");

// Cookie name used for refresh token
const REFRESH_COOKIE_NAME = "jsh_refresh";

function encodeBase64Url(value) {
  const source = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(source)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Create a signed JWT access token.
 * Payload shape: { sub, role="free", plan_expires=null, email_verified=false, mfa_passed=false, email?, name? }
 * Default TTL is 15 minutes (0.25 hours) per spec.
 */
function createAuthToken(payload, secret, ttlHours = 0.25) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = nowSeconds + Number(ttlHours || 0.25) * 60 * 60;
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    sub: payload.sub,
    role: payload.role || "free",
    plan_expires: payload.plan_expires !== undefined ? payload.plan_expires : null,
    email_verified: payload.email_verified !== undefined ? payload.email_verified : false,
    mfa_passed: payload.mfa_passed !== undefined ? payload.mfa_passed : false,
    // Optional fields - only include if provided
    ...(payload.email ? { email: payload.email } : {}),
    ...(payload.name ? { name: payload.name } : {}),
    iat: nowSeconds,
    exp,
  };

  const encodedHeader = encodeBase64Url(header);
  const encodedBody = encodeBase64Url(body);
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const signature = crypto
    .createHmac("sha256", String(secret || ""))
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${signature}`;
}

/**
 * Verify a JWT access token, returns payload with new shape including role, plan_expires, etc.
 * Returns null if invalid or expired.
 */
function verifyAuthToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedBody, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", String(secret || ""))
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedBody));
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate a refresh token.
 * Returns { token, hash } where token is 48-byte base64url and hash is sha256 hex.
 * The token is sent to the client; only the hash is stored in DB.
 */
function generateRefreshToken() {
  const token = crypto.randomBytes(48).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

/**
 * Set the refresh token as an httpOnly cookie.
 * - httpOnly: always
 * - secure: only in production
 * - sameSite: strict
 * - maxAge: 7 days
 * - path: /auth (scoped to auth routes only)
 */
function setRefreshCookie(res, token, isProd) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: Boolean(isProd),
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: "/auth",
  });
}

/**
 * Clear the refresh token cookie.
 */
function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "strict",
    path: "/auth",
  });
}

module.exports = {
  createAuthToken,
  verifyAuthToken,
  generateRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
};
