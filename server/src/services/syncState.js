const state = {
  isSyncing: false,
  startedAt: null,
  lastCompletedAt: null,
  lastResult: null, // { scanned, processed }
};

function getSyncStatus() {
  return {
    isSyncing: state.isSyncing,
    startedAt: state.startedAt,
    lastCompletedAt: state.lastCompletedAt,
    lastResult: state.lastResult,
  };
}

function acquireSyncLock() {
  if (state.isSyncing) return false;
  state.isSyncing = true;
  state.startedAt = new Date().toISOString();
  return true;
}

function releaseSyncLock(result = null) {
  state.isSyncing = false;
  state.startedAt = null;
  state.lastCompletedAt = new Date().toISOString();
  if (result) state.lastResult = result;
}

module.exports = { getSyncStatus, acquireSyncLock, releaseSyncLock };
