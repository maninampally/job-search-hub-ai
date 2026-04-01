const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config/env");

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

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserProfile,
  updateUserPassword,
  touchLastLogin,
  stripPasswordHash,
};
