/**
 * Email Extraction Service
 * Handles OTP verification, email verification tokens, and extraction consent flow
 * Manages security policies: lockouts, expiration, one-time use, audit logging
 */

import { v4 as uuidv4 } from 'uuid';
import {
  generateOTP,
  generateVerificationToken,
  isValidEmail,
  isOTPExpired,
  isTokenExpired,
  calculateOTPExpiration,
  calculateTokenExpiration,
  calculateLockoutExpiration,
  isLockedOut,
  getRemainingLockoutTime,
  sanitizeEmail,
  maskEmail,
  isValidOTPFormat,
  formatErrorResponse
} from '../utils/emailExtractionUtils.js';

const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Request OTP for email extraction consent
 * Validates email, checks rate limits, logs action
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {string} email - Email address
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Promise<Object>} Result with status and masked email
 */
export async function requestOTP(db, userId, email, ipAddress, userAgent) {
  const sanitized = sanitizeEmail(email);

  // Validation
  if (!isValidEmail(sanitized)) {
    await logAuditAction(db, userId, 'otp_requested', 'failed', ipAddress, userAgent, 'Invalid email format');
    return formatErrorResponse('INVALID_EMAIL', 'Invalid email format');
  }

  try {
    // Check if user is locked out
    const user = await db.query('SELECT * FROM app_users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return formatErrorResponse('USER_NOT_FOUND', 'User not found');
    }

    // Clean up expired OTP records (optional, but recommended)
    await db.query(
      'DELETE FROM otp_verifications WHERE user_id = $1 AND expires_at < now()',
      [userId]
    );

    // Check for recent OTP requests (rate limiting: max 1 per minute)
    const recentOTP = await db.query(
      `SELECT * FROM otp_verifications 
       WHERE user_id = $1 AND created_at > now() - interval '1 minute'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (recentOTP.rows.length > 0) {
      await logAuditAction(db, userId, 'otp_requested', 'failed', ipAddress, userAgent, 'Rate limited: OTP requested too soon');
      return formatErrorResponse('RATE_LIMITED', 'OTP requested too soon. Please wait 1 minute before requesting another.');
    }

    // Get most recent OTP verification record
    const lastOtp = await db.query(
      `SELECT * FROM otp_verifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    // Check lockout status
    if (lastOtp.rows.length > 0 && lastOtp.rows[0].blocked_until) {
      if (isLockedOut(lastOtp.rows[0].blocked_until)) {
        const remainingTime = getRemainingLockoutTime(lastOtp.rows[0].blocked_until);
        await logAuditAction(db, userId, 'otp_requested', 'failed', ipAddress, userAgent, `Account locked out for ${remainingTime}s`);
        return formatErrorResponse('ACCOUNT_LOCKED', `Account locked. Try again in ${remainingTime} seconds.`, { retryAfter: remainingTime });
      }
    }

    // Generate new OTP
    const code = generateOTP();
    const expiresAt = calculateOTPExpiration();

    // Insert OTP into database
    const result = await db.query(
      `INSERT INTO otp_verifications (user_id, code, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, code`,
      [userId, code, expiresAt]
    );

    // Log audit action
    await logAuditAction(db, userId, 'otp_requested', 'success', ipAddress, userAgent);

    // Return response with masked email and OTP (in dev/test only; remove in production)
    return {
      success: true,
      message: 'OTP sent to your email',
      maskedEmail: maskEmail(sanitized),
      expiresIn: 900, // 15 minutes in seconds
      // NOTE: In production, send OTP via email and don't return it
      // For testing/dev, optionally return code
      code // REMOVE IN PRODUCTION
    };
  } catch (error) {
    console.error('Error in requestOTP:', error);
    await logAuditAction(db, userId, 'otp_requested', 'failed', ipAddress, userAgent, error.message);
    return formatErrorResponse('ERROR', 'Failed to request OTP');
  }
}

/**
 * Verify OTP code
 * Validates format, checks expiration, enforces attempt limits, applies lockouts
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {string} code - OTP code to verify
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Promise<Object>} Result with success status
 */
export async function verifyOTP(db, userId, code, ipAddress, userAgent) {
  // Validate format
  if (!isValidOTPFormat(code)) {
    return formatErrorResponse('INVALID_FORMAT', 'OTP must be 6 digits');
  }

  try {
    // Get most recent OTP for user
    const otpResult = await db.query(
      `SELECT * FROM otp_verifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (otpResult.rows.length === 0) {
      await logAuditAction(db, userId, 'otp_verified', 'failed', ipAddress, userAgent, 'No OTP found');
      return formatErrorResponse('NO_OTP', 'No OTP request found. Request a new one.');
    }

    const otp = otpResult.rows[0];

    // Check if already used
    if (otp.used) {
      await logAuditAction(db, userId, 'otp_verified', 'failed', ipAddress, userAgent, 'OTP already used');
      return formatErrorResponse('OTP_USED', 'OTP has already been used');
    }

    // Check if expired
    if (isOTPExpired(otp.expires_at)) {
      await logAuditAction(db, userId, 'otp_verified', 'failed', ipAddress, userAgent, 'OTP expired');
      return formatErrorResponse('OTP_EXPIRED', 'OTP has expired. Request a new one.');
    }

    // Check lockout status
    if (isLockedOut(otp.blocked_until)) {
      const remainingTime = getRemainingLockoutTime(otp.blocked_until);
      await logAuditAction(db, userId, 'otp_verified', 'failed', ipAddress, userAgent, `Account locked for ${remainingTime}s`);
      return formatErrorResponse('ACCOUNT_LOCKED', `Account locked. Try again in ${remainingTime} seconds.`, { retryAfter: remainingTime });
    }

    // Verify code
    if (otp.code !== code) {
      const newAttempts = otp.attempts + 1;
      let blockedUntil = null;

      // Apply lockout after max attempts
      if (newAttempts >= MAX_OTP_ATTEMPTS) {
        blockedUntil = calculateLockoutExpiration();
        await db.query(
          `UPDATE otp_verifications SET attempts = $1, blocked_until = $2 WHERE id = $3`,
          [newAttempts, blockedUntil, otp.id]
        );
        await logAuditAction(db, userId, 'otp_verified', 'failed', ipAddress, userAgent, `Wrong code. Account locked (${MAX_OTP_ATTEMPTS} attempts reached)`);
        return formatErrorResponse('ACCOUNT_LOCKED', `Too many failed attempts. Account locked for 15 minutes.`);
      }

      // Increment attempt counter
      await db.query(
        `UPDATE otp_verifications SET attempts = $1 WHERE id = $2`,
        [newAttempts, otp.id]
      );

      const remainingAttempts = MAX_OTP_ATTEMPTS - newAttempts;
      await logAuditAction(db, userId, 'otp_verified', 'failed', ipAddress, userAgent, `Wrong code (${remainingAttempts} attempts left)`);
      return formatErrorResponse('INVALID_CODE', `Invalid OTP. ${remainingAttempts} attempts remaining.`, { attemptsRemaining: remainingAttempts });
    }

    // Mark OTP as used
    await db.query(
      `UPDATE otp_verifications SET used = true WHERE id = $1`,
      [otp.id]
    );

    // Update user extraction status
    await db.query(
      `UPDATE app_users SET otp_verified = true, extraction_verified_at = now() WHERE id = $1`,
      [userId]
    );

    // Log audit action
    await logAuditAction(db, userId, 'otp_verified', 'success', ipAddress, userAgent);

    return {
      success: true,
      message: 'OTP verified successfully',
      nextStep: 'email_verification'
    };
  } catch (error) {
    console.error('Error in verifyOTP:', error);
    await logAuditAction(db, userId, 'otp_verified', 'failed', ipAddress, userAgent, error.message);
    return formatErrorResponse('ERROR', 'Failed to verify OTP');
  }
}

/**
 * Generate and send email verification link
 * Creates a UUID token, stores it, and returns token for email notification
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {string} email - Email address (already verified via OTP)
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Promise<Object>} Link token for email notification
 */
export async function generateVerificationLink(db, userId, email, ipAddress, userAgent) {
  try {
    const sanitized = sanitizeEmail(email);
    const token = generateVerificationToken();
    const expiresAt = calculateTokenExpiration();

    // Insert token into database
    await db.query(
      `INSERT INTO email_verify_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    // Log audit action
    await logAuditAction(db, userId, 'link_sent', 'success', ipAddress, userAgent);

    return {
      success: true,
      message: 'Verification link generated',
      token,
      email: sanitized,
      expiresIn: 86400 // 24 hours in seconds
    };
  } catch (error) {
    console.error('Error in generateVerificationLink:', error);
    await logAuditAction(db, userId, 'link_sent', 'failed', ipAddress, userAgent, error.message);
    return formatErrorResponse('ERROR', 'Failed to generate verification link');
  }
}

/**
 * Verify email verification token
 * Confirms token, marks as used, enables extraction
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {string} token - Verification token
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Promise<Object>} Verification result
 */
export async function verifyEmailToken(db, userId, token, ipAddress, userAgent) {
  try {
    // Find token
    const tokenResult = await db.query(
      `SELECT * FROM email_verify_tokens 
       WHERE user_id = $1 AND token = $2`,
      [userId, token]
    );

    if (tokenResult.rows.length === 0) {
      await logAuditAction(db, userId, 'link_verified', 'failed', ipAddress, userAgent, 'Token not found');
      return formatErrorResponse('INVALID_TOKEN', 'Invalid verification token');
    }

    const tokenRecord = tokenResult.rows[0];

    // Check if already used
    if (tokenRecord.used) {
      await logAuditAction(db, userId, 'link_verified', 'failed', ipAddress, userAgent, 'Token already used');
      return formatErrorResponse('TOKEN_USED', 'Verification token has already been used');
    }

    // Check if expired
    if (isTokenExpired(tokenRecord.expires_at)) {
      await logAuditAction(db, userId, 'link_verified', 'failed', ipAddress, userAgent, 'Token expired');
      return formatErrorResponse('TOKEN_EXPIRED', 'Verification token has expired');
    }

    // Mark token as used
    await db.query(
      `UPDATE email_verify_tokens SET used = true WHERE id = $1`,
      [tokenRecord.id]
    );

    // Enable extraction for user
    await db.query(
      `UPDATE app_users SET email_extraction_enabled = true WHERE id = $1`,
      [userId]
    );

    // Log audit action
    await logAuditAction(db, userId, 'enabled', 'success', ipAddress, userAgent);

    return {
      success: true,
      message: 'Email extraction enabled successfully',
      extractionEnabled: true
    };
  } catch (error) {
    console.error('Error in verifyEmailToken:', error);
    await logAuditAction(db, userId, 'link_verified', 'failed', ipAddress, userAgent, error.message);
    return formatErrorResponse('ERROR', 'Failed to verify email token');
  }
}

/**
 * Get extraction status for user
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Current extraction status
 */
export async function getExtractionStatus(db, userId) {
  try {
    const result = await db.query(
      `SELECT id, email, otp_verified, email_extraction_enabled, extraction_verified_at 
       FROM app_users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return formatErrorResponse('USER_NOT_FOUND', 'User not found');
    }

    const user = result.rows[0];
    return {
      success: true,
      status: {
        otpVerified: user.otp_verified || false,
        emailExtractionEnabled: user.email_extraction_enabled || false,
        verifiedAt: user.extraction_verified_at || null,
        email: user.email
      }
    };
  } catch (error) {
    console.error('Error in getExtractionStatus:', error);
    return formatErrorResponse('ERROR', 'Failed to get extraction status');
  }
}

/**
 * Log audit action for compliance and security monitoring
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {string} action - Action type
 * @param {string} status - success or failed
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @param {string} errorMessage - Error details if failed
 * @returns {Promise<void>}
 */
export async function logAuditAction(db, userId, action, status, ipAddress, userAgent, errorMessage = null) {
  try {
    await db.query(
      `INSERT INTO extraction_audit_log (user_id, action, status, ip_address, user_agent, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, status, ipAddress, userAgent, errorMessage]
    );
  } catch (error) {
    console.error('Error logging audit action:', error);
  }
}

/**
 * Get audit log for user (admin/compliance view)
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {number} limit - Max records to return
 * @returns {Promise<Object>} Audit log records
 */
export async function getAuditLog(db, userId, limit = 50) {
  try {
    const result = await db.query(
      `SELECT id, user_id, action, status, ip_address, timestamp, error_message
       FROM extraction_audit_log
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [userId, limit]
    );

    return {
      success: true,
      records: result.rows
    };
  } catch (error) {
    console.error('Error getting audit log:', error);
    return formatErrorResponse('ERROR', 'Failed to retrieve audit log');
  }
}
