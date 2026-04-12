/**
 * Input sanitization utilities for preventing XSS and injection attacks.
 * Applied to user-submitted text before storage.
 */

const HTML_ENTITY_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

const HTML_ENTITY_RE = /[&<>"'/]/g;

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(HTML_ENTITY_RE, (char) => HTML_ENTITY_MAP[char] || char);
}

function stripHtmlTags(str) {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "");
}

function sanitizeText(str) {
  if (typeof str !== "string") return str;
  return stripHtmlTags(str).trim();
}

function sanitizeObject(obj, fields) {
  if (!obj || typeof obj !== "object") return obj;
  const sanitized = { ...obj };
  for (const field of fields) {
    if (typeof sanitized[field] === "string") {
      sanitized[field] = sanitizeText(sanitized[field]);
    }
  }
  return sanitized;
}

module.exports = { escapeHtml, stripHtmlTags, sanitizeText, sanitizeObject };
