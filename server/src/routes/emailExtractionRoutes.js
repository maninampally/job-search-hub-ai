/**
 * Email Extraction Routes
 * Endpoints for OTP verification flow and email verification token verification
 * POST /api/extract/request-otp — Begin OTP verification flow
 * POST /api/extract/verify-otp — Verify OTP code
 * POST /api/extract/verify-email — Complete email verification token flow
 * GET /api/extract/status — Check extraction status
 * GET /api/extract/audit-log — View audit log (admin)
 */

const express = require('express');
const { requireUserAuth } = require('../middleware/requireUserAuth');
const { getClientIP, getUserAgent } = require('../utils/requestUtils');
const {
  requestOTP,
  verifyOTP,
  generateVerificationLink,
  verifyEmailToken,
  getExtractionStatus,
  getAuditLog
} = require('../services/emailExtractionService');

const router = express.Router();

/**
 * POST /api/extract/request-otp
 * Request an OTP code for email extraction verification
 * Rate limited to 1 request per minute per user
 * Body: { email }
 */
router.post('/request-otp', requireUserAuth, async (req, res) => {
  const { email } = req.body;
  const userId = req.user.id;
  const ipAddress = getClientIP(req);
  const userAgent = getUserAgent(req);

  // Validate input
  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Email is required'
      }
    });
  }

  try {
    const result = await requestOTP(req.db, userId, email, ipAddress, userAgent);
    
    if (result.error) {
      const statusCode = result.error.code === 'RATE_LIMITED' ? 429 : 400;
      return res.status(statusCode).json(result);
    }

    // In production, send OTP via email here
    // await sendOTPEmail(email, result.code);
    // Then remove result.code before responding

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in request-otp endpoint:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to request OTP'
      }
    });
  }
});

/**
 * POST /api/extract/verify-otp
 * Verify the OTP code provided by user
 * Enforces max 5 attempts, then 15-minute lockout
 * Body: { code }
 */
router.post('/verify-otp', requireUserAuth, async (req, res) => {
  const { code } = req.body;
  const userId = req.user.id;
  const ipAddress = getClientIP(req);
  const userAgent = getUserAgent(req);

  // Validate input
  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'OTP code is required'
      }
    });
  }

  try {
    const result = await verifyOTP(req.db, userId, code, ipAddress, userAgent);

    if (result.error) {
      const statusCode = result.error.code === 'ACCOUNT_LOCKED' ? 429 : 400;
      return res.status(statusCode).json(result);
    }

    // OTP verified — generate verification link for next step
    const linkResult = await generateVerificationLink(req.db, userId, req.user.email, ipAddress, userAgent);

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      nextStep: 'email_verification',
      verificationLink: {
        token: linkResult.token,
        expiresIn: linkResult.expiresIn
      }
    });
  } catch (error) {
    console.error('Error in verify-otp endpoint:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to verify OTP'
      }
    });
  }
});

/**
 * POST /api/extract/verify-email
 * Complete the email verification process
 * Token-based verification for distributed authentication
 * Body: { token }
 */
router.post('/verify-email', requireUserAuth, async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;
  const ipAddress = getClientIP(req);
  const userAgent = getUserAgent(req);

  // Validate input
  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Verification token is required'
      }
    });
  }

  try {
    const result = await verifyEmailToken(req.db, userId, token, ipAddress, userAgent);

    if (result.error) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in verify-email endpoint:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to verify email'
      }
    });
  }
});

/**
 * GET /api/extract/status
 * Check current extraction verification status
 * Returns OTP verification state and extraction enabled state
 */
router.get('/status', requireUserAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await getExtractionStatus(req.db, userId);

    if (result.error) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in status endpoint:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get extraction status'
      }
    });
  }
});

/**
 * GET /api/extract/audit-log
 * Retrieve audit log for user (compliance/security monitoring)
 * Query params: limit (default 50)
 */
router.get('/audit-log', requireUserAuth, async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  try {
    const result = await getAuditLog(req.db, userId, limit);

    if (result.error) {
      return res.status(500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in audit-log endpoint:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to retrieve audit log'
      }
    });
  }
});

module.exports = { emailExtractionRoutes: router };
