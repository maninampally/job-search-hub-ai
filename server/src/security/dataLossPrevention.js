/**
 * Data Loss Prevention (DLP) - Consolidated module
 * Re-exports from dlp.js which is the canonical implementation.
 * Kept for backward compatibility with existing imports.
 */
const { sanitizeEmailForAI, sanitizeEmailSubject } = require("./dlp");

function validateEmailLength(emailBody, maxChars = 10000) {
  if (!emailBody) return true;
  return String(emailBody).length <= maxChars;
}

module.exports = {
  sanitizeEmailForAI,
  sanitizeEmailSubject,
  validateEmailLength,
};
