import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuthStore, getAccessToken, setAccessToken } from "../stores/authStore";
import { getCurrentUser, refreshAccessToken } from "../api/backend";

const AuthContext = createContext(null);

export { getAccessToken, setAccessToken };

export function AuthProvider({ children }) {
  const [isInitializing, setIsInitializing] = useState(true);

  // Subscribe to zustand store for user and auth state
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const mfaChallengeRequired = useAuthStore((state) => state.mfaChallengeRequired);
  const setUser = useAuthStore((state) => state.setUser);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const completeMFAChallenge = useAuthStore((state) => state.completeMFAChallenge);

  useEffect(() => {
    let isMounted = true;

    // On mount: silently attempt to refresh using the httpOnly cookie.
    // refreshAccessToken() returns null (not a throw) when no cookie exists.
    async function bootstrapAuth() {
      try {
        const payload = await refreshAccessToken();
        if (isMounted) {
          if (payload?.token) {
            setAccessToken(payload.token);
            setUser(payload.user || null);
          } else {
            // No cookie / expired - normal unauthenticated state
            setAccessToken(null);
            setUser(null);
          }
        }
      } catch (err) {
        // Network error or unexpected server error - treat as logged out
        if (isMounted) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Helper: check if current user's email is verified
  function isEmailVerified() {
    return Boolean(user?.is_email_verified || user?.email_verified_at);
  }

  // Helper: get verification status details
  function getVerificationStatus() {
    return {
      isVerified: Boolean(user?.is_email_verified || user?.email_verified_at),
      verifiedAt: user?.email_verified_at || null,
      isPending: !user?.is_email_verified && !user?.email_verified_at,
    };
  }

  async function refreshUser() {
    const me = await getCurrentUser();
    if (me?.user) {
      setUser(me.user);
    }
    return me;
  }

  // Backwards-compatible wrappers for pages that expect thrown errors.
  async function loginOrThrow(email, password) {
    const result = await login(email, password);
    if (!result?.success) {
      if (result?.requiresMFA) {
        const err = new Error("mfa_required");
        err.code = "mfa_required";
        err.preAuthToken = result.preAuthToken;
        throw err;
      }
      throw new Error(result?.error || "Login failed");
    }
    return result;
  }

  async function registerOrThrow(name, email, password) {
    const result = await register(name, email, password);
    if (!result?.success) {
      throw new Error(result?.error || "Registration failed");
    }
    return result;
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isInitializing,
      isLoading,
      authError,
      mfaChallengeRequired,
      isEmailVerified,
      getVerificationStatus,
      login: loginOrThrow,
      register: registerOrThrow,
      logout,
      completeMFAChallenge,
      refreshUser,
      setUser,
      setAccessToken,
    }),
    [
      user,
      isAuthenticated,
      isInitializing,
      isLoading,
      authError,
      mfaChallengeRequired,
      logout,
      completeMFAChallenge,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
