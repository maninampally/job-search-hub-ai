/**
 * Token Encryption — AES-256-GCM encryption for OAuth tokens
 * Encrypts tokens before storage in Supabase
 * Decrypts tokens during refresh and sync
 */

const crypto = require("crypto");
const { env } = require("../config/env");

/**
 * Encrypt token using AES-256-GCM
 * Returns: { iv, encryptedData, authTag } as base64 strings
 */
function encryptToken(token, encryptionKey = null) {
  if (!token) return null;

  const key = encryptionKey || getEncryptionKey();
  if (!key) {
    console.warn("[TokenEncryption] No encryption key available, storing plaintext (dev mode)");
    return { plaintext: token };
  }

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(JSON.stringify(token), "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString("base64"),
      encryptedData: encrypted,
      authTag: authTag.toString("base64"),
    };
  } catch (error) {
    console.error("[TokenEncryption] Encryption failed:", error.message);
    throw error;
  }
}

/**
 * Decrypt token using AES-256-GCM
 */
function decryptToken(encryptedObj, encryptionKey = null) {
  if (!encryptedObj) return null;

  // Fallback for dev mode (plaintext)
  if (encryptedObj.plaintext) {
    return encryptedObj.plaintext;
  }

  const key = encryptionKey || getEncryptionKey();
  if (!key) {
    console.warn("[TokenEncryption] No encryption key available");
    return null;
  }

  try {
    const iv = Buffer.from(encryptedObj.iv, "base64");
    const authTag = Buffer.from(encryptedObj.authTag, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedObj.encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("[TokenEncryption] Decryption failed:", error.message);
    throw error;
  }
}

/**
 * Get encryption key from env or generate one
 * KEY MUST be exactly 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey() {
  const keyEnv = env.TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY;

  if (!keyEnv) {
    // Dev mode: generate random key (will be different each restart)
    console.warn("[TokenEncryption] TOKEN_ENCRYPTION_KEY not set, using random key (dev mode only)");
    return crypto.randomBytes(32);
  }

  try {
    // Try to parse as hex string (32 bytes = 64 hex chars)
    if (keyEnv.length === 64) {
      return Buffer.from(keyEnv, "hex");
    }

    // Try to parse as base64
    if (keyEnv.length > 40 && keyEnv.length < 100) {
      const buffer = Buffer.from(keyEnv, "base64");
      if (buffer.length === 32) {
        return buffer;
      }
    }

    // Hash the string to 32 bytes
    return crypto.createHash("sha256").update(keyEnv).digest();
  } catch (error) {
    console.error("[TokenEncryption] Invalid key format:", error.message);
    return null;
  }
}

module.exports = {
  encryptToken,
  decryptToken,
  getEncryptionKey,
};
