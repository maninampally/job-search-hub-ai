/**
 * Request Utilities
 * Helper functions for extracting request metadata (IP address, user agent, etc.)
 */

/**
 * Get client IP address from request
 * Handles proxies and load balancers
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  // Check for IP from a proxy
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; return the first
    return forwarded.split(',')[0].trim();
  }

  // Fallback to direct connection IP
  return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}

/**
 * Get user agent from request
 * @param {Object} req - Express request object
 * @returns {string} User agent string
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

/**
 * Get browser/OS info from user agent
 * @param {string} userAgent - User agent string
 * @returns {Object} Browser and OS info
 */
function parseBrowserInfo(userAgent) {
  // Simple parsing; consider using ua-parser-js for production
  const isChrome = /Chrome/.test(userAgent);
  const isFirefox = /Firefox/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !isChrome;
  const isWindows = /Windows/.test(userAgent);
  const isMac = /Macintosh|Mac OS X/.test(userAgent);
  const isLinux = /Linux/.test(userAgent);
  const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);

  return {
    browser: isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Other',
    os: isWindows ? 'Windows' : isMac ? 'Mac' : isLinux ? 'Linux' : 'Other',
    isMobile
  };
}

/**
 * Format client info for logging
 * @param {Object} req - Express request object
 * @returns {Object} Formatted client info
 */
function getClientInfo(req) {
  const userAgent = getUserAgent(req);
  const browser = parseBrowserInfo(userAgent);

  return {
    ip: getClientIP(req),
    userAgent,
    browser: browser.browser,
    os: browser.os,
    isMobile: browser.isMobile
  };
}

module.exports = {
  getClientIP,
  getUserAgent,
  parseBrowserInfo,
  getClientInfo
};
