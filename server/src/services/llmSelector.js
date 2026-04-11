/**
 * LLM Provider Selector
 * Automatically selects the best LLM for each tier:
 * - Free: No AI (extraction disabled)
 * - Pro: Gemini 2.5 Flash-Lite ($0.00012/extraction)
 * - Elite: Claude Sonnet 4.6 primary, Gemini fallback ($0.009/extraction)
 * - Admin: Claude Sonnet 4.6
 */

const { env } = require("../config/env");
const { logger } = require("../utils/logger");

/**
 * Get LLM provider configuration for tier-based AI extraction
 * @param {string} userRole - User tier: 'free', 'pro', 'elite', 'admin'
 * @returns {object} { primary: {provider, model}, fallback: {provider, model} }
 */
function getLlmProviderConfig(userRole) {
  const role = String(userRole || "free").toLowerCase();

  // Free tier: no AI unless explicitly allowed (same providers as Pro when keys exist)
  if (role === "free") {
    if (env.ALLOW_FREE_TIER_AI_EXTRACTION) {
      return {
        enabled: true,
        primary: {
          provider: "openai",
          model: "gpt-4o-mini",
          cost: "$0.00015 per extraction",
          accuracy: "95%",
        },
        fallback: {
          provider: "gemini",
          model: env.GEMINI_MODEL || "gemini-2.5-flash-lite",
          cost: "$0.00012 per extraction",
          accuracy: "92%",
        },
        reason: "Free tier AI extraction enabled via ALLOW_FREE_TIER_AI_EXTRACTION",
      };
    }
    return {
      enabled: false,
      primary: null,
      fallback: null,
      reason: "Free tier does not include AI features",
    };
  }

  // Pro tier: OpenAI GPT-4o Mini (best price/quality for job extraction)
  if (role === "pro") {
    return {
      enabled: true,
      primary: {
        provider: "openai",
        model: "gpt-4o-mini",
        cost: "$0.00015 per extraction",
        accuracy: "95%",
      },
      fallback: {
        provider: "gemini",
        model: "gemini-2.5-flash-lite",
        cost: "$0.00012 per extraction",
        accuracy: "92%",
      },
      reason: "Pro tier: OpenAI GPT-4o Mini with Gemini fallback",
    };
  }

  // Elite tier: Claude Sonnet 4.6 primary, Gemini fallback
  if (role === "elite" || role === "admin") {
    return {
      enabled: true,
      primary: {
        provider: "anthropic",
        model: env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        cost: "$0.009 per extraction",
        accuracy: "99%",
      },
      fallback: {
        provider: "gemini",
        model: "gemini-2.5-flash-lite",
        cost: "$0.00012 per extraction",
        accuracy: "92%",
      },
      reason: `${role === "admin" ? "Admin" : "Elite"} tier: Claude Sonnet 4.6 primary with Gemini fallback`,
    };
  }

  // Unknown role defaults to free
  logger.warn("Unknown user role, defaulting to free tier", { userRole });
  return {
    enabled: false,
    primary: null,
    fallback: null,
    reason: "Unknown role defaults to free tier (no AI)",
  };
}

/**
 * Check if an API key exists for the given provider
 * @param {string} provider - 'gemini', 'anthropic', 'openai'
 * @returns {boolean}
 */
function isProviderAvailable(provider) {
  const p = String(provider || "").toLowerCase();

  if (p === "gemini") {
    return !!(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim());
  }

  if (p === "anthropic") {
    return !!(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim());
  }

  if (p === "openai") {
    return !!(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim());
  }

  return false;
}

/**
 * Get the recommended LLM provider for extraction with availability check
 * Returns primary if available, otherwise fallback if available
 * @param {string} userRole - User tier
 * @param {object} options - { preferFallback: false }
 * @returns {object} { provider, model, cost, accuracy, isAvailable } or null
 */
function getRecommendedLlm(userRole, options = {}) {
  const config = getLlmProviderConfig(userRole);

  if (!config.enabled) {
    return null;
  }

  const { preferFallback } = options;

  // Try primary first
  if (!preferFallback && config.primary) {
    if (isProviderAvailable(config.primary.provider)) {
      return {
        ...config.primary,
        isAvailable: true,
        source: "primary",
      };
    }

    logger.warn("Primary LLM provider not available", {
      provider: config.primary.provider,
      userRole,
    });
  }

  // Fall back to fallback if available
  if (config.fallback && isProviderAvailable(config.fallback.provider)) {
    logger.info("Using fallback LLM provider", {
      provider: config.fallback.provider,
      userRole,
    });
    return {
      ...config.fallback,
      isAvailable: true,
      source: "fallback",
    };
  }

  // Nothing available
  logger.error("No LLM providers available for extraction", {
    userRole,
    primaryProvider: config.primary?.provider,
    fallbackProvider: config.fallback?.provider,
  });

  return null;
}

/**
 * Validate that required API keys are present based on enabled tiers
 * Call during app startup
 */
function validateLlmConfiguration() {
  const hasEliteUsers = true; // Assume you'll have elite users
  const hasProUsers = true; // Assume you'll have pro users

  const errors = [];

  if (hasEliteUsers && !isProviderAvailable("anthropic")) {
    errors.push("Elite tier enabled but ANTHROPIC_API_KEY not configured");
  }

  if ((hasProUsers || hasEliteUsers) && !isProviderAvailable("gemini")) {
    errors.push("Pro/Elite tiers enabled but GEMINI_API_KEY not configured");
  }

  if (errors.length > 0) {
    const msg = `LLM Configuration Issues:\n  - ${errors.join("\n  - ")}`;
    if (env.ENVIRONMENT === "production") {
      throw new Error(msg);
    }
    logger.warn(msg);
  }

  logger.info("LLM Configuration validated", {
    geminIAvailable: isProviderAvailable("gemini"),
    anthropicAvailable: isProviderAvailable("anthropic"),
    openaiAvailable: isProviderAvailable("openai"),
  });
}

module.exports = {
  getLlmProviderConfig,
  isProviderAvailable,
  getRecommendedLlm,
  validateLlmConfiguration,
};

