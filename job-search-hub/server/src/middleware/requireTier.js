const { env } = require("../config/env");

// Tier hierarchy - index = level (higher index = higher tier)
const TIER_ORDER = ["free", "pro", "elite", "admin"];

/**
 * requireTier(tier, featureLabel) - returns Express middleware that:
 * 1. Checks req.user.role is at least the required tier level
 * 2. Checks plan_expires is null (lifetime) or in the future (unix timestamp seconds)
 * 3. If fails: 402 { error: 'upgrade_required', min_tier, feature }
 *
 * Usage:
 *   router.get('/sync', requireUserAuth, requireTier('pro', 'gmail_sync'), handler)
 *
 * Tier hierarchy: free < pro < elite < admin
 * requireTier('pro') allows: pro, elite, admin
 * requireTier('elite') allows: elite, admin
 * requireTier('admin') allows: admin only
 */
function requireTier(tier, featureLabel) {
  const minIndex = TIER_ORDER.indexOf(tier);

  if (minIndex === -1) {
    throw new Error(`[requireTier] Unknown tier: "${tier}". Valid tiers: ${TIER_ORDER.join(", ")}`);
  }

  return function tierMiddleware(req, res, next) {
    // req.user is attached by requireUserAuth from the JWT payload
    const userRole = req.user?.role || "free";
    const planExpires = req.user?.plan_expires;

    const userIndex = TIER_ORDER.indexOf(userRole);

    // Check role level
    if (userIndex < minIndex) {
      return res.status(402).json({
        error: "upgrade_required",
        min_tier: tier,
        feature: featureLabel || tier,
      });
    }

    // Check plan expiry (only applies to paid tiers - free has no expiry)
    // plan_expires is a unix timestamp (seconds). null means lifetime/no expiry.
    if (planExpires !== null && planExpires !== undefined) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (planExpires <= nowSeconds) {
        return res.status(402).json({
          error: "upgrade_required",
          min_tier: tier,
          feature: featureLabel || tier,
          reason: "plan_expired",
        });
      }
    }

    return next();
  };
}

/**
 * Gmail sync is a Pro feature. When ALLOW_FREE_TIER_GMAIL_SYNC is true (default in non-production),
 * free users can still connect Gmail and run sync for local testing.
 */
function requireTierGmailSync(req, res, next) {
  if (env.ALLOW_FREE_TIER_GMAIL_SYNC) {
    return next();
  }
  return requireTier("pro", "gmail_sync")(req, res, next);
}

module.exports = { requireTier, requireTierGmailSync, TIER_ORDER };
