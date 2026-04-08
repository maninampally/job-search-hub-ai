import { create } from 'zustand';
import * as api from '../api/backend';

/**
 * Auth store - manages user authentication state
 * Access token stored in memory (never localStorage)
 * Refresh token in httpOnly cookie (handled by backend)
 */
export const useAuthStore = create((set, get) => ({
  // State
  user: null,
  accessToken: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
  mfaChallengeRequired: false,
  preAuthToken: null,

  // Actions
  setUser: (user) => set({ user }),
  setAccessToken: (token) => set({ accessToken: token, isAuthenticated: !!token }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setMFAChallenge: (required, preAuthToken = null) =>
    set({ mfaChallengeRequired: required, preAuthToken }),

  // Login flow
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.loginUser({ email, password });

      // Check if MFA is required
      if (response.error === 'mfa_required') {
        set({
          mfaChallengeRequired: true,
          preAuthToken: response.preAuthToken,
          isLoading: false,
        });
        return { success: false, requiresMFA: true, preAuthToken: response.preAuthToken };
      }

      // Normal login - set tokens and user
      if (response.token && response.user) {
        set({
          user: response.user,
          accessToken: response.token,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      }

      throw new Error('Invalid login response');
    } catch (error) {
      const errorMsg = error.message || 'Login failed';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  // MFA challenge
  completeMFAChallenge: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const preAuthToken = get().preAuthToken;
      if (!preAuthToken) {
        throw new Error('Pre-auth token missing');
      }

      const response = await api.verifyMFAChallenge(code, preAuthToken);

      if (response.token && response.user) {
        set({
          user: response.user,
          accessToken: response.token,
          isAuthenticated: true,
          mfaChallengeRequired: false,
          preAuthToken: null,
          isLoading: false,
        });
        return { success: true };
      }

      throw new Error('MFA verification failed');
    } catch (error) {
      const errorMsg = error.message || 'MFA verification failed';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  // Register flow
  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.registerUser({ name, email, password });

      if (response.token && response.user) {
        set({
          user: response.user,
          accessToken: response.token,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      }

      throw new Error('Invalid registration response');
    } catch (error) {
      const errorMsg = error.message || 'Registration failed';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  // Logout
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.logoutUser();
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        mfaChallengeRequired: false,
        preAuthToken: null,
        isLoading: false,
      });
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear state even if API call fails
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return { success: false };
    }
  },

  // Silent refresh (called by backend interceptor)
  refreshToken: async () => {
    try {
      const response = await api.refreshAccessToken();
      if (response.token) {
        set({ accessToken: response.token });
        return response.token;
      }
      // Token refresh failed - user needs to re-login
      set({
        accessToken: null,
        isAuthenticated: false,
        user: null,
      });
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      set({
        accessToken: null,
        isAuthenticated: false,
        user: null,
      });
      return null;
    }
  },

  // Update user profile
  updateProfile: async (updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.updateMyProfile(updates);
      if (response.user) {
        set({ user: response.user, isLoading: false });
        return { success: true };
      }
      throw new Error('Profile update failed');
    } catch (error) {
      const errorMsg = error.message || 'Profile update failed';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      await api.changePassword({ currentPassword, newPassword });
      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const errorMsg = error.message || 'Password change failed';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },
}));

// Export token getter/setter for use in api middleware
export function getAccessToken() {
  return useAuthStore.getState().accessToken;
}

export function setAccessToken(token) {
  useAuthStore.getState().setAccessToken(token);
}
