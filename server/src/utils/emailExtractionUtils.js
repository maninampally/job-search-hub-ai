/**
 * Email Extraction Utilities
 * OTP generation, token creation, email validation, and security utilities
 */

import crypto from 'crypto';

/**
 * Generate a 6-digit OTP code
 * Uses cryptographically secure random number generation
 * @returns {string} 6-digit OTP code
 */
export function generateOTP() {
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  return code;
}

/**
 * Generate a unique email verification token
 * Uses random bytes encoded as hex string
 * @returns {string} Unique verification token
 */
export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate email format
 * RFC 5322 simplified validation
 * @param {string} email - Email to validate
 * @returns {boolean} true if valid email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if OTP is expired
 * @param {Date} expiresAt - Expiration timestamp
 * @returns {boolean} true if expired
 */
export function isOTPExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

/**
 * Check if verification token is expired
 * @param {Date} expiresAt - Expiration timestamp
 * @returns {boolean} true if expired
 */
export function isTokenExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

/**
 * Calculate OTP expiration (15 minutes from now)
 * @returns {Date} Expiration timestamp
 */
export function calculateOTPExpiration() {
  const now = new Date();
  return new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
}

/**
 * Calculate verification token expiration (24 hours from now)
 * @returns {Date} Expiration timestamp
 */
export function calculateTokenExpiration() {
  const now = new Date();
  return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
}

/**
 * Calculate lockout expiration (15 minutes from now after max attempts)
 * @returns {Date} Lockout expiration timestamp
 */
export function calculateLockoutExpiration() {
  const now = new Date();
  return new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
}

/**
 * Check if user is currently locked out from OTP attempts
 * @param {Date|null} blockedUntil - Lockout timestamp or null
 * @returns {boolean} true if currently locked out
 */
export function isLockedOut(blockedUntil) {
  if (!blockedUntil) return false;
  return new Date() < new Date(blockedUntil);
}

/**
 * Get remaining lockout time in seconds
 * @param {Date|null} blockedUntil - Lockout timestamp or null
 * @returns {number} Seconds remaining, or 0 if not locked out
 */
export function getRemainingLockoutTime(blockedUntil) {
  if (!blockedUntil) return 0;
  const remaining = new Date(blockedUntil) - new Date();
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Sanitize email for security (remove whitespace, lowercase)
 * @param {string} email - Email to sanitize
 * @returns {string} Sanitized email
 */
export function sanitizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Mask email for display in UI (e.g., "u***@example.com")
 * @param {string} email - Email to mask
 * @returns {string} Masked email
 */
export function maskEmail(email) {
  const [local, domain] = email.split('@');
  const masked = local.charAt(0) + '*'.repeat(Math.min(3, local.length - 1));
  return `${masked}@${domain}`;
}

/**
 * Hash email for verification lookups (one-way)
 * @param {string} email - Email to hash
 * @returns {string} SHA256 hash of email
 */
export function hashEmail(email) {
  return crypto.createHash('sha256').update(sanitizeEmail(email)).digest('hex');
}

/**
 * Validate OTP format
 * @param {string} code - OTP code to validate
 * @returns {boolean} true if valid 6-digit format
 */
export function isValidOTPFormat(code) {
  return /^\d{6}$/.test(code);
}

/**
 * Extract domain from email
 * @param {string} email - Email address
 * @returns {string} Domain part of email
 */
export function getEmailDomain(email) {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1] : null;
}

/**
 * Format error response
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {any} details - Additional error details
 * @returns {Object} Formatted error object
 */
export function formatErrorResponse(code, message, details = null) {
  return {
    error: {
      code,
      message,
      ...(details && { details })
    }
  };
}
