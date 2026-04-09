import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BACKEND_URL } from "../api/backend";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { isAuthenticated, login, register } = useAuth();
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

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError("");
    window.location.href = `${BACKEND_URL}/auth/gmail`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "register") {
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
    <div className={styles.container}>
      {/* Left Panel - Branding */}
      <div className={styles.leftPanel}>
        <div className={styles.brandingContent}>
          <div className={styles.logoIcon}>
            <div className={styles.logoIconInner} />
          </div>
          <h1 className={styles.brandTitle}>Job Search Hub</h1>
          <p className={styles.brandTagline}>
            Track applications, automate outreach, and land your dream job faster.
          </p>
          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <span className={styles.checkIcon} />
              <span>Kanban board to track all applications</span>
            </li>
            <li className={styles.featureItem}>
              <span className={styles.checkIcon} />
              <span>Gmail sync for automatic updates</span>
            </li>
            <li className={styles.featureItem}>
              <span className={styles.checkIcon} />
              <span>AI-powered interview preparation</span>
            </li>
            <li className={styles.featureItem}>
              <span className={styles.checkIcon} />
              <span>Smart reminders and follow-ups</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <h2 className={styles.greeting}>{greeting}</h2>
          <p className={styles.subtitle}>
            {mode === "login" 
              ? "Sign in to your Job Search Hub workspace." 
              : "Create your account to get started."}
          </p>

          {/* Mode Switch */}
          <div className={styles.modeSwitch}>
            <button
              type="button"
              className={`${styles.modeButton} ${mode === "login" ? styles.active : ""}`}
              onClick={() => setMode("login")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`${styles.modeButton} ${mode === "register" ? styles.active : ""}`}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || submitting}
            className={styles.googleButton}
          >
            <span className={styles.googleIcon} />
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or continue with email</span>
            <span className={styles.dividerLine} />
          </div>

          {/* Form */}
          <form className={styles.form} onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>Full Name</label>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={styles.input}
                    required
                  />
                </div>
              </div>
            )}

            <div className={styles.inputGroup}>
              <label className={styles.label}>Email</label>
              <div className={styles.inputWrapper}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={styles.input}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={styles.input}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "◉" : "○"}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>Confirm Password</label>
                <div className={styles.inputWrapper}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className={styles.input}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? "◉" : "○"}
                  </button>
                </div>
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}

            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={submitting || googleLoading}
            >
              {submitting ? "Please wait..." : mode === "register" ? "Create Account" : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <div className={styles.footer}>
            By continuing, you agree to our{" "}
            <a href="/terms">Terms of Service</a> and{" "}
            <a href="/privacy">Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
