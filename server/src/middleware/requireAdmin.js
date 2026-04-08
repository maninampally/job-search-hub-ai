const { env } = require("../config/env");

/**
 * requireAdmin() - returns Express middleware that:
 * 1. Checks req.user.role === 'admin'
 * 2. Checks req.user.mfa_passed === true (admins must always have MFA)
 * 3. Optionally checks IP against ADMIN_IP_ALLOWLIST env var (comma-separated IPs)
 *    If ADMIN_IP_ALLOWLIST is empty, all IPs are allowed.
 *
 * Must be used AFTER requireUserAuth (which attaches req.user).
 *
 * Usage:
 *   router.get('/admin/users', requireUserAuth, requireAdmin(), handler)
 */
function requireAdmin() {
  return function adminMiddleware(req, res, next) {
    const userRole = req.user?.role;
    const mfaPassed = req.user?.mfa_passed;

    // Check admin role
    if (userRole !== "admin") {
      return res.status(403).json({
        error: "forbidden",
        reason: "admin_required",
      });
    }

    // Check MFA - admins must always pass MFA challenge
    if (!mfaPassed) {
      return res.status(403).json({
        error: "forbidden",
        reason: "mfa_required",
      });
    }

    // Check IP allowlist if configured
    const allowlist = env.ADMIN_IP_ALLOWLIST || "";
    if (allowlist.trim()) {
      const allowedIps = allowlist
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);

      // Get client IP - respect X-Forwarded-For if behind a trusted proxy
      // In production this should be set by the load balancer/proxy layer
      const clientIp = req.ip || req.connection?.remoteAddress || "";

      // Normalize IPv6 loopback to IPv4 loopback for easier comparison in dev
      const normalizedIp = clientIp === "::1" ? "127.0.0.1" : clientIp.replace(/^::ffff:/, "");

      if (!allowedIps.includes(normalizedIp)) {
        return res.status(403).json({
          error: "forbidden",
          reason: "ip_not_allowed",
        });
      }
    }

    return next();
  };
}

module.exports = { requireAdmin };
