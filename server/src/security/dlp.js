/**
 * Data Loss Prevention (DLP) - Email Sanitization for AI
 * Before sending emails/attachments to Gemini or other AI services,
 * remove PII to comply with data privacy rules.
 */

const { logger } = require("../utils/logger");

const PII_PATTERNS = {
  // Credit/debit card: 13-19 digits
  creditCard: /\b(?:\d{4}[\s-]?){3}\d{4,6}\b/g,

  // Social Security Number: XXX-XX-XXXX
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

  // Phone: +1-XXX-XXX-XXXX or (XXX) XXX-XXXX or XXX-XXX-XXXX
  phone: /\b(?:\+?1[\s-]?)?\(?[0-9]{3}\)?[\s-]?[0-9]{3}[\s-]?[0-9]{4}\b/g,

  // Passport/ID: varies, but common patterns
  passport: /\b(?:passport|id|drivers?[\s-]?lic|ssn|tin|ein)[\s:]*[A-Z0-9]{6,20}\b/gi,

  // Bank account: assuming 8-17 digits
  bankAccount: /\b(?:account|acct|routing)[\s:]*\b[\d\s-]{8,20}\b/gi,

  // Coordinates/GPS (privacy risk in hiring)
  coordinates: /\b[-+]?([0-9]{1,3}\.[0-9]{6,}),\s?[-+]?([0-9]{1,3}\.[0-9]{6,})\b/g,
};

const REPLACEMENT_PATTERNS = {
  // Replace multi-line sensitive sections (cover letters often include salary/performance)
  salary: /\b(?:salary|compensation|pay|wage|hourly)[\s:]*\$?[\d,\.]+(\s?(?:k|million|hour|year))?\b/gi,

  // Performance reviews
  performance: /(?:performance|appraisal|review)\s*:?[^.!?]*[.!?]/gi,
};

/**
 * Sanitize email/content for safe AI processing
 * @param {string} text - Email body/attachment content
 * @param {object} options - { removeAttachments: bool, redactionChar: string }
 * @returns {string} Sanitized text
 */
function sanitizeEmailForAI(text, options = {}) {
  if (!text || typeof text !== "string") {
    return "";
  }

  const { redactionChar = "[REDACTED]", logRemoved = false } = options;
  let sanitized = text;
  const removed = [];

  // Apply PII pattern replacements
  for (const [patternName, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = sanitized.match(pattern);
    if (matches) {
      removed.push(`${patternName}: ${matches.length} occurrence(s)`);
      sanitized = sanitized.replace(pattern, redactionChar);
    }
  }

  // Apply sensitive content replacements (less aggressive)
  for (const [patternName, pattern] of Object.entries(REPLACEMENT_PATTERNS)) {
    const matches = sanitized.match(pattern);
    if (matches) {
      removed.push(`${patternName}: ${matches.length} occurrence(s)`);
      sanitized = sanitized.replace(pattern, redactionChar);
    }
  }

  // Log what was removed (in debug mode)
  if (logRemoved && removed.length > 0) {
    logger.debug("Email sanitized for AI", {
      removed,
      textLengthBefore: text.length,
      textLengthAfter: sanitized.length,
    });
  }

  return sanitized;
}

/**
 * Sanitize email subject line (usually safe but check for sensitive markers)
 * @param {string} subject - Email subject
 * @returns {string} Sanitized subject
 */
function sanitizeEmailSubject(subject) {
  if (!subject || typeof subject !== "string") {
    return "";
  }

  // Remove salary/comp mentions
  return subject
    .replace(/\[confidential\]|\[private\]|\[secret\]/gi, "[REDACTED]")
    .replace(/salary|comp|pay/gi, "[REDACTED]");
}

module.exports = { sanitizeEmailForAI, sanitizeEmailSubject };
