import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredAuthToken,
  getCurrentUser,
  getStoredAuthToken,
  loginUser,
  registerUser,
  setStoredAuthToken,
} from "../api/backend";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      const token = getStoredAuthToken();
      if (!token) {
        if (isMounted) setIsInitializing(false);
        return;
      }

      try {
        const payload = await getCurrentUser();
        if (isMounted) {
          setUser(payload?.user || null);
        }
      } catch {
        clearStoredAuthToken();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(email, password) {
    const payload = await loginUser({ email, password });
    setStoredAuthToken(payload?.token || "");
    setUser(payload?.user || null);
    return payload?.user || null;
  }

  async function register(name, email, password) {
    const payload = await registerUser({ name, email, password });
    setStoredAuthToken(payload?.token || "");
    setUser(payload?.user || null);
    return payload?.user || null;
  }

  function logout() {
    clearStoredAuthToken();
    setUser(null);
  }

  async function refreshUser() {
    const payload = await getCurrentUser();
    setUser(payload?.user || null);
    return payload?.user || null;
  }

  // NEW: Helper to check if email is verified
  function isEmailVerified() {
    return user?.is_email_verified || false;
  }

  // NEW: Get verification status
  function getVerificationStatus() {
    return {
      isVerified: Boolean(user?.email_verified_at),
      verifiedAt: user?.email_verified_at || null,
    };
  }

  const value = useMemo(
    () => ({
      user,
      isInitializing,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshUser,
      isEmailVerified,
      getVerificationStatus,
    }),
    [user, isInitializing]
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
