/**
 * Token Encryption Utility
 * Encrypts OAuth tokens (Google access/refresh tokens) before storing in DB.
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * Key derivation & storage:
 * - ENCRYPTION_KEY env var should be 32 bytes, hex-encoded
 * - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const crypto = require("crypto");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");

// Encryption parameters
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // AES block size
const AUTH_TAG_LENGTH = 16; // GCM authentication tag length

/**
 * Encrypt a token/secret using AES-256-GCM
 * @param {string} plaintext - Token or secret to encrypt
 * @returns {{ encrypted: string, iv: string }} - IV and encrypted data (both hex)
 * @throws {Error} if encryption key not configured
 */
function encryptToken(plaintext) {
  const encryptionKey = env.TOKEN_ENCRYPTION_KEY;

  if (!encryptionKey || encryptionKey.length === 0) {
    logger.warn("TOKEN_ENCRYPTION_KEY not configured - tokens will be stored unencrypted");
    return { encrypted: plaintext, iv: null, unencrypted: true };
  }

  try {
    // Convert hex key to buffer
    const keyBuffer = Buffer.from(encryptionKey, "hex");
    if (keyBuffer.length !== 32) {
      throw new Error(`Encryption key must be 32 bytes (256 bits), got ${keyBuffer.length}`);
    }

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return IV + auth tag + encrypted data (concatenated)
    const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;

    return { encrypted: combined, iv: iv.toString("hex"), unencrypted: false };
  } catch (error) {
    logger.error("Token encryption failed", { error: error.message });
    throw error;
  }
}

/**
 * Decrypt a token/secret
 * @param {string} encryptedData - Combined IV + auth tag + encrypted data (hex)
 * @returns {string} - Decrypted plaintext
 * @throws {Error} if decryption fails or key not configured
 */
function decryptToken(encryptedData) {
  const encryptionKey = env.TOKEN_ENCRYPTION_KEY;

  if (!encryptionKey) {
    // If unencrypted and no key, return as-is (legacy support)
    logger.warn("TOKEN_ENCRYPTION_KEY not configured - assuming tokens are unencrypted");
    return encryptedData;
  }

  try {
    // Convert hex key to buffer
    const keyBuffer = Buffer.from(encryptionKey, "hex");
    if (keyBuffer.length !== 32) {
      throw new Error(`Encryption key must be 32 bytes (256 bits), got ${keyBuffer.length}`);
    }

    // Extract IV (first 32 hex chars = 16 bytes)
    const iv = Buffer.from(encryptedData.substring(0, 32), "hex");

    // Extract auth tag (next 32 hex chars = 16 bytes)
    const authTag = Buffer.from(encryptedData.substring(32, 64), "hex");

    // Extract encrypted data (rest)
    const encrypted = encryptedData.substring(64);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let plaintext = decipher.update(encrypted, "hex", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
  } catch (error) {
    logger.error("Token decryption failed", { error: error.message });
    throw error;
  }
}

/**
 * Generate a secure encryption key (for setup/diagnostics)
 * @returns {string} 32-byte key as hex string
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  encryptToken,
  decryptToken,
  generateEncryptionKey,
  ALGORITHM,
};
