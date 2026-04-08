import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/backend';

// Query keys for React Query
export const queryKeys = {
  jobs: () => ['jobs'],
  jobDetail: (id) => ['jobs', id],
  syncStatus: () => ['sync-status'],
  sessions: () => ['sessions'],
  user: () => ['user'],
  plan: () => ['plan'],
  auditLog: (page) => ['audit-log', page],
  users: (page) => ['users', page],
};

// ============================================================================
// JOBS QUERIES & MUTATIONS
// ============================================================================

export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs(),
    queryFn: async () => {
      const response = await api.getJobs();
      return response.jobs || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
  });
}

export function useSyncJobs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.syncJobs(),
    onSuccess: (data) => {
      // Invalidate and refetch jobs after sync
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.syncStatus() });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, updates }) => api.updateJob(jobId, updates),
    onSuccess: (data, { jobId }) => {
      // Update cache with new job data
      queryClient.setQueryData(queryKeys.jobDetail(jobId), data.job);
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs() });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId) => api.deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs() });
    },
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: queryKeys.syncStatus(),
    queryFn: () => api.getSyncStatus(),
    refetchInterval: 2000, // Poll every 2 seconds
    staleTime: 0,
  });
}

// ============================================================================
// SESSION QUERIES & MUTATIONS
// ============================================================================

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions(),
    queryFn: async () => {
      const response = await api.getSessions();
      return response.sessions || [];
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId) => api.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
    },
  });
}

export function useDeleteOtherSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.deleteOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
    },
  });
}

// ============================================================================
// BILLING & PLANS QUERIES
// ============================================================================

export function useBillingPlan() {
  return useQuery({
    queryKey: queryKeys.plan(),
    queryFn: async () => {
      const response = await api.getBillingPlan();
      return response;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useCheckoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tier) => api.createCheckoutSession(tier),
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => api.getBillingPortal(),
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
  });
}

// ============================================================================
// ADMIN QUERIES & MUTATIONS
// ============================================================================

export function useAdminUsers(page = 1) {
  return useQuery({
    queryKey: queryKeys.users(page),
    queryFn: async () => {
      const response = await api.getAdminUsers({ page });
      return response;
    },
    enabled: false, // Requires admin middleware
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }) => api.updateUserRole(userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useAdminAuditLog(page = 1) {
  return useQuery({
    queryKey: queryKeys.auditLog(page),
    queryFn: async () => {
      const response = await api.getAuditLog({ page });
      return response;
    },
    enabled: false, // Requires admin middleware
  });
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => api.getAdminMetrics(),
    enabled: false, // Requires admin middleware
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================================================
// FOLLOW-UP NUDGES QUERIES
// ============================================================================

export function useFollowUpNudges() {
  return useQuery({
    queryKey: ['follow-up-nudges'],
    queryFn: () => api.getFollowUpNudges(),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}
