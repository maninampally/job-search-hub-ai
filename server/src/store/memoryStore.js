const store = {
  tokens: null,
  jobs: [],
  lastChecked: null,
  processedIds: new Set(),
};

module.exports = { store };
