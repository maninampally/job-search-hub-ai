const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");

const localUserStorePath = path.resolve(__dirname, "../../data/users-local-store.json");

function createInitialStore() {
  return {
    users: [],
  };
}

function loadLocalStore() {
  try {
    if (!fs.existsSync(localUserStorePath)) {
      return createInitialStore();
    }

    const parsed = JSON.parse(fs.readFileSync(localUserStorePath, "utf-8"));
    return {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
    };
  } catch {
    return createInitialStore();
  }
}

function saveLocalStore(store) {
  try {
    const dir = path.dirname(localUserStorePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(localUserStorePath, JSON.stringify(store, null, 2));
  } catch {
    // best effort
  }
}

const localStore = loadLocalStore();
const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabase ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) : null;
let allowSupabaseUsersTable = Boolean(supabase);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function stripPasswordHash(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function localFindByEmail(email) {
  const normalized = normalizeEmail(email);
  return localStore.users.find((item) => normalizeEmail(item.email) === normalized) || null;
}

function localFindById(id) {
  return localStore.users.find((item) => item.id === id) || null;
}

function localCreateUser({ email, passwordHash, name }) {
  const now = new Date().toISOString();
  const user = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    email: normalizeEmail(email),
    passwordHash,
    name: String(name || "User").trim() || "User",
    headline: "",
    location: "",
    bio: "",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    email_verified_at: now,
  };

  localStore.users.push(user);
  saveLocalStore(localStore);
  return user;
}

function localUpdateProfile(userId, patch = {}) {
  const index = localStore.users.findIndex((item) => item.id === userId);
  if (index < 0) return null;

  const current = localStore.users[index];
  const next = {
    ...current,
    name: patch.name !== undefined ? String(patch.name || "").trim() || current.name : current.name,
    headline: patch.headline !== undefined ? String(patch.headline || "").trim() : current.headline,
    location: patch.location !== undefined ? String(patch.location || "").trim() : current.location,
    bio: patch.bio !== undefined ? String(patch.bio || "").trim() : current.bio,
    updatedAt: new Date().toISOString(),
  };

  localStore.users[index] = next;
  saveLocalStore(localStore);
  return next;
}

function localTouchLastLogin(userId) {
  const index = localStore.users.findIndex((item) => item.id === userId);
  if (index < 0) return;

  localStore.users[index] = {
    ...localStore.users[index],
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveLocalStore(localStore);
}

function localUpdatePassword(userId, passwordHash) {
  const index = localStore.users.findIndex((item) => item.id === userId);
  if (index < 0) return null;

  const nextUser = {
    ...localStore.users[index],
    passwordHash,
    updatedAt: new Date().toISOString(),
  };

  localStore.users[index] = nextUser;
  saveLocalStore(localStore);
  return nextUser;
}

function isMissingUsersTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("app_users") &&
    (
      message.includes("does not exist") ||
      message.includes("not found") ||
      message.includes("could not find the table")
    )
  );
}

function mapDbToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name || "User",
    headline: row.headline || "",
    location: row.location || "",
    bio: row.bio || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || null,
    role: row.role || "free",
    plan_expires: row.plan_expires || null,
    email_verified_at: row.email_verified_at || null,
    email_verification_token_hash: row.email_verification_token_hash || null,
    email_verification_sent_at: row.email_verification_sent_at || null,
    email_verification_attempts: row.email_verification_attempts || 0,
    is_suspended: row.is_suspended || false,
  };
}

async function withSupabaseFallback(task, fallbackTask) {
  if (!allowSupabaseUsersTable || !supabase) {
    return fallbackTask();
  }

  try {
    return await task();
  } catch (error) {
    if (isMissingUsersTableError(error)) {
      allowSupabaseUsersTable = false;
      return fallbackTask();
    }
    throw error;
  }
}

async function findUserByEmail(email) {
  return withSupabaseFallback(
    async () => {
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .eq("email", normalizeEmail(email))
        .maybeSingle();
      if (error) throw error;
      return mapDbToUser(data);
    },
    async () => localFindByEmail(email)
  );
}

async function findUserById(userId) {
  return withSupabaseFallback(
    async () => {
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return mapDbToUser(data);
    },
    async () => localFindById(userId)
  );
}

async function createUser(payload) {
  return withSupabaseFallback(
    async () => {
      const now = new Date().toISOString();
      const row = {
        email: normalizeEmail(payload.email),
        password_hash: payload.passwordHash,
        name: String(payload.name || "User").trim() || "User",
        headline: "",
        location: "",
        bio: "",
        created_at: now,
        updated_at: now,
        email_verified_at: now,
      };
      const { data, error } = await supabase.from("app_users").insert(row).select("*").single();
      if (error) throw error;
      return mapDbToUser(data);
    },
    async () => localCreateUser(payload)
  );
}

async function updateUserProfile(userId, patch) {
  return withSupabaseFallback(
    async () => {
      const dbPatch = { updated_at: new Date().toISOString() };
      if (patch.name !== undefined) dbPatch.name = String(patch.name || "").trim() || "User";
      if (patch.headline !== undefined) dbPatch.headline = String(patch.headline || "").trim();
      if (patch.location !== undefined) dbPatch.location = String(patch.location || "").trim();
      if (patch.bio !== undefined) dbPatch.bio = String(patch.bio || "").trim();

      const { data, error } = await supabase
        .from("app_users")
        .update(dbPatch)
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return mapDbToUser(data);
    },
    async () => localUpdateProfile(userId, patch)
  );
}

async function touchLastLogin(userId) {
  return withSupabaseFallback(
    async () => {
      const { error } = await supabase
        .from("app_users")
        .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
    },
    async () => {
      localTouchLastLogin(userId);
    }
  );
}

async function updateUserPassword(userId, passwordHash) {
  return withSupabaseFallback(
    async () => {
      const { data, error } = await supabase
        .from("app_users")
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return mapDbToUser(data);
    },
    async () => localUpdatePassword(userId, passwordHash)
  );
}

// ============================================================================
// EMAIL VERIFICATION HELPERS (added for verified email-bound extraction)
// ============================================================================

async function getUserByVerificationTokenHash(tokenHash) {
  if (!tokenHash) return null;

  return withSupabaseFallback(
    async () => {
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .eq("email_verification_token_hash", tokenHash)
        .maybeSingle();
      if (error) throw error;
      return mapDbToUser(data);
    },
    async () => {
      const user = localStore.users.find(u => u.email_verification_token_hash === tokenHash);
      return user || null;
    }
  );
}

async function updateUserVerification(userId, options = {}) {
  const { tokenHash = null, verifiedAt = null } = options;

  return withSupabaseFallback(
    async () => {
      const updatePayload = { updated_at: new Date().toISOString() };
      if (verifiedAt !== undefined) updatePayload.email_verified_at = verifiedAt;
      if (tokenHash !== undefined) updatePayload.email_verification_token_hash = tokenHash;

      const { data, error } = await supabase
        .from("app_users")
        .update(updatePayload)
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return mapDbToUser(data);
    },
    async () => {
      const user = localStore.users.find(u => u.id === userId);
      if (user) {
        if (verifiedAt !== undefined) user.email_verified_at = verifiedAt;
        if (tokenHash !== undefined) user.email_verification_token_hash = tokenHash;
        user.updated_at = new Date().toISOString();
        saveLocalStore(localStore);
      }
      return user || null;
    }
  );
}

async function setEmailVerificationTokenHash(userId, tokenHash, sentAt = new Date()) {
  return withSupabaseFallback(
    async () => {
      // First get current user to increment attempts
      const { data: userData, error: getError } = await supabase
        .from("app_users")
        .select("email_verification_attempts")
        .eq("id", userId)
        .single();
      
      if (getError) throw getError;
      
      const currentAttempts = userData?.email_verification_attempts || 0;
      
      const { data, error } = await supabase
        .from("app_users")
        .update({
          email_verification_token_hash: tokenHash,
          email_verification_sent_at: sentAt.toISOString(),
          email_verification_attempts: currentAttempts + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return mapDbToUser(data);
    },
    async () => {
      const user = localStore.users.find(u => u.id === userId);
      if (user) {
        user.email_verification_token_hash = tokenHash;
        user.email_verification_sent_at = sentAt.toISOString();
        user.email_verification_attempts = (user.email_verification_attempts || 0) + 1;
        user.updated_at = new Date().toISOString();
        saveLocalStore(localStore);
      }
      return user || null;
    }
  );
}

function isEmailVerified(user) {
  return user?.email_verified_at !== null && user?.email_verified_at !== undefined;
}

// ============================================================================
// SESSION HELPERS (refresh token sessions in user_sessions table)
// ============================================================================

/**
 * Helper: detect when user_sessions table doesn't exist yet
 * so we can fail gracefully instead of crashing.
 */
function isMissingSessionsTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("user_sessions") &&
    (
      message.includes("does not exist") ||
      message.includes("not found") ||
      message.includes("could not find the table") ||
      message.includes("relation") ||
      message.includes("undefined")
    )
  );
}

/**
 * Insert a new session row into user_sessions.
 * Gracefully returns null if the table doesn't exist yet.
 */
async function createSession(userId, tokenHash, deviceFingerprint, ipAddress, userAgent, expiresAt) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("user_sessions").insert([{
      user_id: userId,
      token_hash: tokenHash,
      device_fingerprint: deviceFingerprint || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      expires_at: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }]).select("*").single();

    if (error) throw error;
    return data;
  } catch (error) {
    if (isMissingSessionsTableError(error)) {
      logger.warn("user_sessions table not found - session not stored");
      return null;
    }
    throw error;
  }
}

/**
 * Look up a session by token hash that hasn't expired.
 * Returns null if not found or table missing.
 */
async function getSessionByHash(tokenHash) {
  if (!supabase || !tokenHash) return null;
  try {
    const { data, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("token_hash", tokenHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    if (isMissingSessionsTableError(error)) {
      logger.warn("user_sessions table not found - cannot look up session");
      return null;
    }
    throw error;
  }
}

/**
 * Delete a specific session by id.
 * Gracefully no-ops if table missing.
 */
async function deleteSession(sessionId) {
  if (!supabase || !sessionId) return null;
  try {
    const { error } = await supabase
      .from("user_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) throw error;
    return true;
  } catch (error) {
    if (isMissingSessionsTableError(error)) {
      logger.warn("user_sessions table not found - cannot delete session");
      return null;
    }
    throw error;
  }
}

/**
 * Delete all sessions for a user (used on logout-all or theft detection).
 * Gracefully no-ops if table missing.
 */
async function deleteAllUserSessions(userId) {
  if (!supabase || !userId) return null;
  try {
    const { error } = await supabase
      .from("user_sessions")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } catch (error) {
    if (isMissingSessionsTableError(error)) {
      logger.warn("user_sessions table not found - cannot delete sessions");
      return null;
    }
    throw error;
  }
}

/**
 * Delete all sessions for a user EXCEPT the current one.
 * Used for "end all other sessions" feature.
 */
async function deleteOtherSessions(userId, currentSessionId) {
  if (!supabase || !userId) return null;
  try {
    let q = supabase
      .from("user_sessions")
      .delete()
      .eq("user_id", userId);

    if (currentSessionId) {
      q = q.neq("id", currentSessionId);
    }

    const { error } = await q;
    if (error) throw error;
    return true;
  } catch (error) {
    if (isMissingSessionsTableError(error)) {
      logger.warn("user_sessions table not found - cannot delete other sessions");
      return null;
    }
    throw error;
  }
}

/**
 * List all active sessions for a user (non-expired).
 * Returns empty array if table missing.
 */
async function listUserSessions(userId) {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from("user_sessions")
      .select("id, user_id, device_fingerprint, ip_address, user_agent, last_active, expires_at, created_at")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    if (isMissingSessionsTableError(error)) {
      logger.warn("user_sessions table not found - cannot list sessions");
      return [];
    }
    throw error;
  }
}

// ============================================================================
// MFA CONFIG HELPERS
// ============================================================================

/**
 * Get MFA config for a user
 * Returns: { totp_secret, totp_enabled, backup_codes, enrolled_at } or null
 */
async function getMFAConfig(userId) {
  // Try Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('mfa_config')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data) {
        return {
          totp_secret: data.totp_secret,
          totp_enabled: data.totp_enabled,
          backup_codes: data.backup_codes ? JSON.parse(data.backup_codes) : [],
          enrolled_at: data.enrolled_at,
        };
      }

      if (error?.code !== 'PGRST116') {
        // Not "no rows" error
        throw error;
      }
    } catch (error) {
      logger.warn("mfa_config table lookup failed", { error: error.message });
    }
  }

  // Fallback to local store
  const user = localFindById(userId);
  if (user?.mfa_config) {
    return user.mfa_config;
  }

  return null;
}

/**
 * Save or update MFA config for a user
 */
async function saveMFAConfig(userId, { totp_secret, totp_enabled, backup_codes, enrolled_at }) {
  // Try Supabase first
  if (supabase) {
    try {
      const { error } = await supabase
        .from('mfa_config')
        .upsert({
          user_id: userId,
          totp_secret,
          totp_enabled: Boolean(totp_enabled),
          backup_codes: backup_codes ? JSON.stringify(backup_codes) : null,
          enrolled_at: enrolled_at || new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
      return;
    } catch (error) {
      logger.warn("mfa_config save failed", { error: error.message });
    }
  }

  // Fallback to local store
  const index = localStore.users.findIndex((u) => u.id === userId);
  if (index >= 0) {
    localStore.users[index].mfa_config = {
      totp_secret,
      totp_enabled: Boolean(totp_enabled),
      backup_codes: backup_codes || [],
      enrolled_at: enrolled_at || new Date().toISOString(),
    };
    saveLocalStore(localStore);
  }
}

/**
 * Disable MFA for a user
 */
async function disableMFA(userId) {
  // Try Supabase first
  if (supabase) {
    try {
      const { error } = await supabase
        .from('mfa_config')
        .update({ totp_enabled: false })
        .eq('user_id', userId);

      if (error) throw error;
      return;
    } catch (error) {
      logger.warn("mfa disable failed", { error: error.message });
    }
  }

  // Fallback to local store
  const index = localStore.users.findIndex((u) => u.id === userId);
  if (index >= 0) {
    if (localStore.users[index].mfa_config) {
      localStore.users[index].mfa_config.totp_enabled = false;
      saveLocalStore(localStore);
    }
  }
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserProfile,
  updateUserPassword,
  touchLastLogin,
  stripPasswordHash,
  // Verification helpers
  getUserByVerificationTokenHash,
  updateUserVerification,
  setEmailVerificationTokenHash,
  isEmailVerified,
  // Session helpers
  createSession,
  getSessionByHash,
  deleteSession,
  deleteAllUserSessions,
  deleteOtherSessions,
  listUserSessions,
  // MFA helpers
  getMFAConfig,
  saveMFAConfig,
  disableMFA,
};
