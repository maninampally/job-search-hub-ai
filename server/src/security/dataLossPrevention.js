/**
 * Data Loss Prevention (DLP) — Sanitize email bodies before sending to Claude API
 * Masks PII: SSN, credit cards, passwords, banking info, passport numbers
 */

function sanitizeEmailForAI(emailBody) {
  if (!emailBody) return "";

  let sanitized = String(emailBody);

  // Mask Social Security Numbers (XXX-XX-XXXX)
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_MASKED]");

  // Mask Credit Card numbers (XXXX-XXXX-XXXX-XXXX or without dashes)
  sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CREDIT_CARD_MASKED]");

  // Mask Bank Account numbers (optional with route numbers)
  sanitized = sanitized.replace(/\b\d{8,17}\b(?=\s|$|\.)/g, (match) => {
    // Only mask if it looks like an account number (8-17 digits in context)
    if (match.length >= 8 && match.length <= 17) {
      return "[ACCOUNT_MASKED]";
    }
    return match;
  });

  // Mask passport numbers
  sanitized = sanitized.replace(/\b[A-Z]{1,2}\d{6,9}\b/g, "[PASSPORT_MASKED]");

  // Mask driver license numbers
  sanitized = sanitized.replace(/\b[A-Z]{1,2}\d{5,8}\b/g, "[LICENSE_MASKED]");

  // Mask common password patterns (avoid false positives)
  sanitized = sanitized.replace(/password\s*[:=]\s*[^\s]+/gi, "password: [PASSWORD_MASKED]");
  sanitized = sanitized.replace(/pwd\s*[:=]\s*[^\s]+/gi, "pwd: [PASSWORD_MASKED]");

  // Mask API keys and tokens (common patterns)
  sanitized = sanitized.replace(/['"](pk_live|pk_test|sk_live|sk_test)[_\w]*['"]/g, "[API_KEY_MASKED]");
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_-]+/g, "Bearer [TOKEN_MASKED]");

  // Mask phone numbers (optional, often less sensitive but can be included)
  // Uncomment if needed: sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE_MASKED]");

  // Mask email addresses (optional, often less sensitive in job context)
  // Uncomment if needed: sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_MASKED]");

  return sanitized;
}

/**
 * Validate that email body doesn't exceed Claude token limits
 * Claude Sonnet max: ~200k tokens, but we'll cap at ~10k chars for safety
 */
function validateEmailLength(emailBody, maxChars = 10000) {
  if (!emailBody) return true;
  return String(emailBody).length <= maxChars;
}

module.exports = {
  sanitizeEmailForAI,
  validateEmailLength,
};
