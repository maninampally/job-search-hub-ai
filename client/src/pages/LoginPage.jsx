import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getGoogleAuthUrl, authenticateWithGoogle } from "../api/backend";

export default function LoginPage() {
  const { isAuthenticated, login, register, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Handle Google OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;

    async function handleGoogleCallback() {
      try {
        setGoogleLoading(true);
        const result = await authenticateWithGoogle(code);
        if (result.token) {
          // Store token and refresh user context
          localStorage.setItem("jsh_auth_token", result.token);
          await refreshUser();
          // Remove code from URL
          window.history.replaceState({}, document.title, "/login");
        }
      } catch (err) {
        setError(err.message || "Google authentication failed");
        setGoogleLoading(false);
      }
    }

    handleGoogleCallback();
  }, [searchParams, refreshUser]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleGoogleSignIn() {
    try {
      setGoogleLoading(true);
      setError("");
      const result = await getGoogleAuthUrl();
      if (result.authUrl) {
        // Redirect to Google OAuth
        window.location.href = result.authUrl;
      }
    } catch (err) {
      setError(err.message || "Unable to start Google login");
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "register") {
        // Validate password confirmation
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setSubmitting(false);
          return;
        }
        if (password.length < 8) {
          setError("Password must be at least 8 characters");
          setSubmitting(false);
          return;
        }
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || "Unable to continue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{greeting}</h1>
        <p>Sign in to open your Job Search Hub workspace.</p>

        <div className="auth-mode-switch">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Register
          </button>
        </div>

        {/* Google OAuth Button */}
        <div style={{ marginTop: "1.375rem" }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || submitting}
            className="google-signin-button"
          >
            {googleLoading ? "Redirecting to Google..." : "🔐 Continue with Google"}
          </button>
          <div style={{ textAlign: "center", margin: "0.875rem 0", color: "var(--text-muted)" }}>
            or
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Full Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </label>

          {mode === "register" && (
            <label>
              Confirm Password
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={submitting || googleLoading}>
            {submitting ? "Please wait..." : mode === "register" ? "Create Account" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
