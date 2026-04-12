import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import DashboardWrapper from "./pages/DashboardWrapper";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./auth/AuthContext";
import { UpgradeModal } from "./components/auth/UpgradeModal";
import { MFASetupModal } from "./components/auth/MFASetupModal";
import { Toast } from "./components/shared/Toast";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { SkeletonDashboard } from "./components/shared/SkeletonLoader";

// Lazy load heavier pages - code splitting for performance
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const ConfirmEmailPage = lazy(() => import("./pages/ConfirmEmailPage"));
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard"));
const BillingPage = lazy(() => import("./components/views/BillingPage"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div style={{ padding: "2rem" }}>
      <SkeletonDashboard />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <div className="auth-loading">Loading your workspace...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isInitializing, user } = useAuth();

  if (isInitializing) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function HomeRedirect() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
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
    <ErrorBoundary>
      <BrowserRouter>
        <UpgradeModal />
        <MFASetupModal />
        <Toast />
        <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/terms" element={<Suspense fallback={<LoadingFallback />}><TermsPage /></Suspense>} />
        <Route path="/privacy" element={<Suspense fallback={<LoadingFallback />}><PrivacyPage /></Suspense>} />
        <Route path="/confirm-email" element={<Suspense fallback={<LoadingFallback />}><ConfirmEmailPage /></Suspense>} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <ProfilePage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <BillingPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Suspense fallback={<LoadingFallback />}>
                <AdminDashboard />
              </Suspense>
            </AdminRoute>
          }
        />
        <Route
          path="/:route/*"
          element={
            <ProtectedRoute>
              <DashboardWrapper />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
