import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DashboardWrapper from "./pages/DashboardWrapper";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import { useAuth } from "./auth/AuthContext";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing, user } = useAuth();

  if (isInitializing) {
    return <div className="auth-loading">Loading your workspace...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // NEW: Enforce email verification before accessing dashboard
  if (!user?.is_email_verified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <div className="auth-loading">Loading your workspace...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/login"
          element={(
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          )}
        />
        <Route
          path="/verify-email"
          element={(
            <ProtectedRoute>
              <VerifyEmailPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/profile"
          element={(
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/:route/*"
          element={(
            <ProtectedRoute>
              <DashboardWrapper />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
