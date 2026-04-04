// Per-user sync state — each user gets their own lock
const state = {
  isSyncing: false,
  startedAt: null,
  lastCompletedAt: null,
  lastResult: null, // { scanned, processed }
  // NEW: Per-user locks for concurrent syncs
  userLocks: {}, // { userId: { isSyncing, startedAt, lastCompletedAt, lastResult } }
};

function getSyncStatus(userId = null) {
  // If userId provided, return user-specific status
  if (userId) {
    const userState = state.userLocks[userId] || {
      isSyncing: false,
      startedAt: null,
      lastCompletedAt: null,
      lastResult: null,
    };
    return userState;
  }
  
  // Legacy: return global status for backward compatibility
  return {
    isSyncing: state.isSyncing,
    startedAt: state.startedAt,
    lastCompletedAt: state.lastCompletedAt,
    lastResult: state.lastResult,
  };
}

/**
 * Acquire sync lock for a specific user
 * lockKey format: "sync_{userId}"
 * Returns true if lock acquired, false if already syncing
 */
function acquireSyncLock(lockKey = null) {
  // Extract userId from lockKey (format: "sync_{userId}")
  const userId = lockKey ? lockKey.replace(/^sync_/, '') : null;
  
  if (userId) {
    // Per-user locking
    if (!state.userLocks[userId]) {
      state.userLocks[userId] = {};
    }
    
    if (state.userLocks[userId].isSyncing) {
      return false;
    }
    
    state.userLocks[userId].isSyncing = true;
    state.userLocks[userId].startedAt = new Date().toISOString();
    return true;
  }
  
  // Legacy: global lock for backward compatibility
  if (state.isSyncing) return false;
  state.isSyncing = true;
  state.startedAt = new Date().toISOString();
  return true;
}

/**
 * Release sync lock for a specific user
 * lockKey format: "sync_{userId}"
 */
function releaseSyncLock(lockKey = null, result = null) {
  // Extract userId from lockKey
  const userId = lockKey ? lockKey.replace(/^sync_/, '') : null;
  
  if (userId) {
    // Per-user unlock
    if (!state.userLocks[userId]) {
      state.userLocks[userId] = {};
    }
    
    state.userLocks[userId].isSyncing = false;
    state.userLocks[userId].startedAt = null;
    state.userLocks[userId].lastCompletedAt = new Date().toISOString();
    if (result) state.userLocks[userId].lastResult = result;
    return;
  }
  
  // Legacy: global unlock for backward compatibility
  state.isSyncing = false;
  state.startedAt = null;
  state.lastCompletedAt = new Date().toISOString();
  if (result) state.lastResult = result;
}

module.exports = { getSyncStatus, acquireSyncLock, releaseSyncLock };
