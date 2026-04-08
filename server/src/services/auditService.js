/**
 * Audit Logging Service
 * Immutable record of all sensitive user actions for compliance + security investigations.
 * Logs: registration, login, password changes, role changes, deletion, OAuth connections, etc.
 */

const { query: dbQuery } = require("./dbAdapter");
const { logger } = require("../utils/logger");

/**
 * Write a record to the audit log
 * @param {object} auditEntry - { userId, adminId, action, resource, resourceId, metadata, ipAddress }
 * @returns {Promise<void>}
 */
async function logAuditEvent(auditEntry) {
  const { userId, adminId = null, action, resource, resourceId = null, metadata = {}, ipAddress } = auditEntry;

  if (!userId && !adminId) {
    logger.warn("auditEntry missing both userId and adminId", { action });
    return;
  }

  if (!action) {
    logger.warn("auditEntry missing action");
    return;
  }

  try {
    // Ensure audit_log table exists (create if needed during migration)
    await dbQuery(
      `INSERT INTO audit_log (user_id, admin_id, action, resource, resource_id, metadata, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        userId || null,
        adminId || null,
        action,
        resource || null,
        resourceId || null,
        JSON.stringify(metadata || {}),
        ipAddress || null,
      ]
    );

    logger.debug("Audit log entry recorded", { userId, action, resource });
  } catch (error) {
    // Don't fail the request if audit logging fails, but log the error
    logger.error("Failed to write audit log", {
      error: error.message,
      action,
      userId,
      resource,
    });
  }
}

/**
 * Log user registration
 */
async function auditRegister(userId, email, ipAddress) {
  await logAuditEvent({
    userId,
    action: "register",
    resource: "user",
    resourceId: userId,
    metadata: { email },
    ipAddress,
  });
}

/**
 * Log user login
 */
async function auditLogin(userId, email, ipAddress, mfaPassed = false) {
  await logAuditEvent({
    userId,
    action: "login",
    resource: "user",
    resourceId: userId,
    metadata: { email, mfaPassed },
    ipAddress,
  });
}

/**
 * Log password change
 */
async function auditPasswordChange(userId, email, ipAddress) {
  await logAuditEvent({
    userId,
    action: "password_changed",
    resource: "user",
    resourceId: userId,
    metadata: { email },
    ipAddress,
  });
}

/**
 * Log email verification
 */
async function auditEmailVerified(userId, email, ipAddress) {
  await logAuditEvent({
    userId,
    action: "email_verified",
    resource: "user",
    resourceId: userId,
    metadata: { email },
    ipAddress,
  });
}

/**
 * Log MFA setup
 */
async function auditMFASetup(userId, ipAddress) {
  await logAuditEvent({
    userId,
    action: "mfa_enabled",
    resource: "user",
    resourceId: userId,
    ipAddress,
  });
}

/**
 * Log MFA disable
 */
async function auditMFADisable(userId, ipAddress) {
  await logAuditEvent({
    userId,
    action: "mfa_disabled",
    resource: "user",
    resourceId: userId,
    ipAddress,
  });
}

/**
 * Log OAuth connection (Gmail)
 */
async function auditOAuthConnect(userId, provider, email, ipAddress) {
  await logAuditEvent({
    userId,
    action: "oauth_connected",
    resource: "oauth_token",
    metadata: { provider, email },
    ipAddress,
  });
}

/**
 * Log OAuth disconnection
 */
async function auditOAuthDisconnect(userId, provider, ipAddress) {
  await logAuditEvent({
    userId,
    action: "oauth_disconnected",
    resource: "oauth_token",
    metadata: { provider },
    ipAddress,
  });
}

/**
 * Log admin action: role change
 */
async function auditRoleChange(adminId, userId, oldRole, newRole, ipAddress) {
  await logAuditEvent({
    adminId,
    userId,
    action: "role_changed",
    resource: "user",
    resourceId: userId,
    metadata: { oldRole, newRole },
    ipAddress,
  });
}

/**
 * Log admin action: suspend user
 */
async function auditUserSuspend(adminId, userId, reason, ipAddress) {
  await logAuditEvent({
    adminId,
    userId,
    action: "user_suspended",
    resource: "user",
    resourceId: userId,
    metadata: { reason },
    ipAddress,
  });
}

/**
 * Log user account deletion
 */
async function auditUserDelete(userId, ipAddress) {
  await logAuditEvent({
    userId,
    action: "user_deleted",
    resource: "user",
    resourceId: userId,
    ipAddress,
  });
}

/**
 * Log failed login attempt (for security monitoring)
 */
async function auditFailedLogin(email, ipAddress, reason = "invalid_credentials") {
  await logAuditEvent({
    action: "login_failed",
    resource: "user",
    metadata: { email, reason },
    ipAddress,
  });
}

/**
 * Retrieve audit log for admin review
 * @param {object} filters - { userId, action, resource, limit, offset }
 */
async function getAuditLog(filters = {}) {
  const { userId, action, resource, limit = 50, offset = 0 } = filters;

  let query = `SELECT * FROM audit_log WHERE 1=1`;
  const params = [];
  let paramIndex = 1;

  if (userId) {
    query += ` AND (user_id = $${paramIndex} OR admin_id = $${paramIndex})`;
    params.push(userId);
    paramIndex++;
  }

  if (action) {
    query += ` AND action = $${paramIndex}`;
    params.push(action);
    paramIndex++;
  }

  if (resource) {
    query += ` AND resource = $${paramIndex}`;
    params.push(resource);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const result = await dbQuery(query, params);
    return result.rows || [];
  } catch (error) {
    logger.error("Failed to retrieve audit log", { error: error.message });
    return [];
  }
}

module.exports = {
  logAuditEvent,
  auditRegister,
  auditLogin,
  auditPasswordChange,
  auditEmailVerified,
  auditMFASetup,
  auditMFADisable,
  auditOAuthConnect,
  auditOAuthDisconnect,
  auditRoleChange,
  auditUserSuspend,
  auditUserDelete,
  auditFailedLogin,
  getAuditLog,
};
