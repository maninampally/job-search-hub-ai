/**
 * Email Extraction API Connector
 * Frontend API client for email extraction verification endpoints
 * Handles OTP flow, email verification, and status checks
 */

import api from './backend.js';

/**
 * Request OTP for email extraction verification
 * @param {string} email - Email address to verify
 * @returns {Promise<Object>} OTP request response
 */
export async function requestOTP(email) {
  try {
    const response = await api.post('/extract/request-otp', { email });
    return response.data;
  } catch (error) {
    return {
      error: {
        code: error.response?.data?.error?.code || 'REQUEST_FAILED',
        message: error.response?.data?.error?.message || 'Failed to request OTP'
      }
    };
  }
}

/**
 * Verify OTP code
 * @param {string} code - 6-digit OTP code
 * @returns {Promise<Object>} OTP verification response
 */
export async function verifyOTP(code) {
  try {
    const response = await api.post('/extract/verify-otp', { code });
    return response.data;
  } catch (error) {
    const errorData = error.response?.data?.error || {};
    return {
      error: {
        code: errorData.code || 'VERIFICATION_FAILED',
        message: errorData.message || 'Failed to verify OTP',
        details: errorData.details
      }
    };
  }
}

/**
 * Verify email verification token
 * Token is typically received from a link in email
 * @param {string} token - Email verification token
 * @returns {Promise<Object>} Email verification response
 */
export async function verifyEmailToken(token) {
  try {
    const response = await api.post('/extract/verify-email', { token });
    return response.data;
  } catch (error) {
    return {
      error: {
        code: error.response?.data?.error?.code || 'VERIFICATION_FAILED',
        message: error.response?.data?.error?.message || 'Failed to verify email'
      }
    };
  }
}

/**
 * Get current extraction status for user
 * @returns {Promise<Object>} Extraction status response
 */
export async function getExtractionStatus() {
  try {
    const response = await api.get('/extract/status');
    return response.data;
  } catch (error) {
    return {
      error: {
        code: error.response?.data?.error?.code || 'STATUS_FAILED',
        message: error.response?.data?.error?.message || 'Failed to get extraction status'
      }
    };
  }
}

/**
 * Get audit log for email extraction (security/compliance)
 * @param {number} limit - Max number of records to retrieve (default 50, max 100)
 * @returns {Promise<Object>} Audit log response
 */
export async function getAuditLog(limit = 50) {
  try {
    const response = await api.get('/extract/audit-log', {
      params: { limit: Math.min(limit, 100) }
    });
    return response.data;
  } catch (error) {
    return {
      error: {
        code: error.response?.data?.error?.code || 'AUDIT_FAILED',
        message: error.response?.data?.error?.message || 'Failed to retrieve audit log'
      }
    };
  }
}

/**
 * Resend OTP (rate-limited to 1 per minute)
 * @param {string} email - Email address
 * @returns {Promise<Object>} OTP request response
 */
export async function resendOTP(email) {
  // Same as requestOTP but with user feedback suggesting they wait if rate-limited
  return requestOTP(email);
}

/**
 * Check if extraction is already enabled for user
 * @returns {Promise<boolean>} true if extraction is enabled
 */
export async function isExtractionEnabled() {
  const status = await getExtractionStatus();
  return status.success && status.status?.emailExtractionEnabled === true;
}

/**
 * Format error message for display
 * @param {Object} error - Error object from API response
 * @returns {string} User-friendly error message
 */
export function formatErrorMessage(error) {
  if (!error) return 'An unknown error occurred';

  const { code, message, details } = error;

  // Add helpful messages for specific error codes
  const messages = {
    'INVALID_EMAIL': 'Please enter a valid email address',
    'INVALID_CODE': 'Please check the code and try again',
    'INVALID_FORMAT': 'OTP must be 6 digits',
    'OTP_EXPIRED': 'This OTP has expired. Please request a new one',
    'TOKEN_EXPIRED': 'This verification link has expired. Please request a new one',
    'ACCOUNT_LOCKED': 'Too many failed attempts. Please wait before trying again',
    'RATE_LIMITED': 'Please wait a moment before requesting again',
    'NO_OTP': 'No OTP request found. Please start over',
    'INVALID_TOKEN': 'This verification link is invalid',
    'TOKEN_USED': 'This verification link has already been used',
    'USER_NOT_FOUND': 'User not found. Please contact support',
    'ERROR': 'An error occurred. Please try again later'
  };

  return messages[code] || message || 'An error occurred';
}
