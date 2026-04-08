import { create } from 'zustand';
import * as api from '../api/backend';

/**
 * Jobs store - manages job applications state
 * Synced from backend via react-query
 */
export const useJobsStore = create((set, get) => ({
  // State
  jobs: [],
  filteredJobs: [],
  isLoading: false,
  isSyncing: false,
  syncStatus: null,
  error: null,
  selectedJobId: null,

  // Filter state
  filters: {
    status: null, // null = all, or specific status
    search: '', // text search on title/company
  },

  // Actions
  setJobs: (jobs) => {
    set({ jobs });
    get().applyFilters();
  },

  addJob: (job) => {
    set((state) => ({
      jobs: [...state.jobs, job],
    }));
    get().applyFilters();
  },

  updateJob: (jobId, updates) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId ? { ...job, ...updates } : job
      ),
    }));
    get().applyFilters();
  },

  deleteJob: (jobId) => {
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== jobId),
    }));
    get().applyFilters();
  },

  setSelectedJob: (jobId) => set({ selectedJobId: jobId }),

  // Filters
  setFilterStatus: (status) => {
    set((state) => ({
      filters: { ...state.filters, status },
    }));
    get().applyFilters();
  },

  setFilterSearch: (search) => {
    set((state) => ({
      filters: { ...state.filters, search },
    }));
    get().applyFilters();
  },

  applyFilters: () => {
    const { jobs, filters } = get();
    let filtered = jobs;

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter((job) => job.status === filters.status);
    }

    // Filter by search text
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          (job.title?.toLowerCase() || '').includes(q) ||
          (job.company?.toLowerCase() || '').includes(q)
      );
    }

    set({ filteredJobs: filtered });
  },

  // API calls
  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getJobs();
      set({
        jobs: response.jobs || [],
        isLoading: false,
      });
      get().applyFilters();
      return { success: true };
    } catch (error) {
      const errorMsg = error.message || 'Failed to fetch jobs';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  syncGmail: async () => {
    set({ isSyncing: true, error: null });
    try {
      const response = await api.syncJobs();
      set({
        isSyncing: false,
        syncStatus: response,
      });
      // Refresh jobs after sync
      await get().fetchJobs();
      return { success: true };
    } catch (error) {
      const errorMsg = error?.body?.error || error.message || 'Sync failed';
      set({ error: errorMsg, isSyncing: false });
      return { success: false, error: errorMsg };
    }
  },

  updateJobStatus: async (jobId, newStatus) => {
    try {
      const response = await api.updateJob(jobId, { status: newStatus });
      if (response.job) {
        get().updateJob(jobId, { status: newStatus });
        return { success: true };
      }
      throw new Error('Status update failed');
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  deleteJobAction: async (jobId) => {
    try {
      await api.deleteJob(jobId);
      get().deleteJob(jobId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Poll sync status
  pollSyncStatus: async () => {
    try {
      const response = await api.getSyncStatus();
      set({ syncStatus: response });
      return response;
    } catch (error) {
      console.error('Failed to poll sync status:', error);
      return null;
    }
  },

  // Get unique statuses for filter dropdown
  getStatusOptions: () => {
    const { jobs } = get();
    const statuses = new Set(jobs.map((job) => job.status).filter(Boolean));
    return Array.from(statuses).sort();
  },

  // Get job counts by status
  getStatusCounts: () => {
    const { jobs } = get();
    const counts = {};
    jobs.forEach((job) => {
      const status = job.status || 'no-status';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  },

  // Get job by ID
  getJobById: (jobId) => {
    const { jobs } = get();
    return jobs.find((job) => job.id === jobId) || null;
  },
}));
