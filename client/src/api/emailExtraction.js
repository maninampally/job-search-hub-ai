/**
 * Email Extraction API Connector
 * Frontend API client for email extraction verification endpoints
 * Handles OTP flow, email verification, and status checks
 */

import { BACKEND_URL, getStoredAuthToken } from './backend.js';

/**
 * Helper to make authenticated API calls
 */
async function apiFetch(endpoint, options = {}) {
  const token = getStoredAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Request failed with status ${response.status}`);
  }

  return data;
}

/**
 * Request OTP for email extraction verification
 * @param {string} email - Email address to verify
 * @returns {Promise<Object>} OTP request response
 */
export async function requestOTP(email) {
  try {
    const response = await apiFetch('/api/extract/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return response;
  } catch (error) {
    return {
      error: {
        code: 'REQUEST_FAILED',
        message: error.message || 'Failed to request OTP'
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
    const response = await apiFetch('/api/extract/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return response;
  } catch (error) {
    return {
      error: {
        code: 'VERIFICATION_FAILED',
        message: error.message || 'Failed to verify OTP'
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
    const response = await apiFetch('/api/extract/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return response;
  } catch (error) {
    return {
      error: {
        code: 'VERIFICATION_FAILED',
        message: error.message || 'Failed to verify email'
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
    const response = await apiFetch('/api/extract/status', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    return {
      error: {
        code: 'STATUS_FAILED',
        message: error.message || 'Failed to get extraction status'
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
    const response = await apiFetch(`/api/extract/audit-log?limit=${Math.min(limit, 100)}`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    return {
      error: {
        code: 'AUDIT_FAILED',
        message: error.message || 'Failed to retrieve audit log'
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
