import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../auth/AuthContext";
import { BACKEND_URL } from "../api/backend";
import FormInput from "../components/shared/FormInput";
import { loginSchema, registerSchema } from "../utils/validationSchemas";
import styles from "./LoginPage.module.css";

const GOOGLE_ERROR_MESSAGES = {
  google_requires_password:
    "This account uses two-factor authentication. Sign in with your email and password, then complete MFA.",
  google_signin_failed: "Google sign-in did not finish. Try again or use email and password.",
};

export default function LoginPage() {
  const { isAuthenticated, login, register: registerUser, completeMFAChallenge } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [preAuthToken, setPreAuthToken] = useState(null);

  // Initialize react-hook-form with appropriate schema based on mode
  const currentSchema = mode === "login" ? loginSchema : registerSchema;
  const {
    register: formRegister,
    handleSubmit,
    formState: { errors, isSubmitting: rhfSubmitting },
    reset,
    watch,
    setError,
  } = useForm({
    resolver: zodResolver(currentSchema),
    mode: "onSubmit", // Only validate on submit, reduces visual clutter
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    const code = searchParams.get("error");
    if (!code || !GOOGLE_ERROR_MESSAGES[code]) return;
    setApiError(GOOGLE_ERROR_MESSAGES[code]);
    const next = new URLSearchParams(searchParams);
    next.delete("error");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Reset form when switching modes
  useEffect(() => {
    reset();
    setApiError("");
  }, [mode, reset]);

  function continueWithGoogle() {
    window.location.assign(`${BACKEND_URL}/auth/google`);
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(data) {
    setApiError("");
    setSubmitting(true);

    try {
      if (mode === "register") {
        const { firstName, lastName, email: registerEmail, password: registerPassword } = data;
        await registerUser(`${firstName} ${lastName}`, registerEmail, registerPassword);
      } else {
        const { email: loginEmail, password: loginPassword } = data;
        await login(loginEmail, loginPassword);
      }
    } catch (err) {
      if (err.code === "mfa_required" && err.preAuthToken) {
        setPreAuthToken(err.preAuthToken);
        setMfaStep(true);
        setApiError("");
      } else {
        setApiError(err.message || "Unable to continue");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event) {
    event.preventDefault();
    setApiError("");
    setSubmitting(true);
    try {
      await completeMFAChallenge(mfaCode, preAuthToken);
    } catch (err) {
      setApiError(err.message || "Invalid MFA code");
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
            {mfaStep
              ? "Two-factor authentication required."
              : mode === "login" 
                ? "Sign in to your Job Search Hub workspace." 
                : "Create your account to get started."}
          </p>

          {!mfaStep && apiError && <div className={styles.error}>{apiError}</div>}

          {/* Mode Switch */}
          {!mfaStep && <div className={styles.modeSwitch}>
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
          </div>}

          {!mfaStep && (
            <>
              <button type="button" className={styles.googleButton} onClick={continueWithGoogle}>
                <span className={styles.googleIcon} aria-hidden />
                Continue with Google
              </button>
              <div className={styles.divider}>
                <span className={styles.dividerLine} />
                <span className={styles.dividerText}>or</span>
                <span className={styles.dividerLine} />
              </div>
              <p className={styles.oauthHint}>
                Use email and password, or Google above. After you are in the app, connect Gmail from Settings if your
                plan includes inbox sync.
              </p>
            </>
          )}

          {/* MFA Challenge Step */}
          {mfaStep && (
            <form className={styles.form} onSubmit={handleMfaSubmit}>
              <p style={{ marginBottom: "1rem", color: "var(--text-secondary, #555)", fontSize: "0.9rem" }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Verification Code</label>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className={styles.input}
                    maxLength={6}
                    autoFocus
                    required
                    style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "1.5rem" }}
                  />
                </div>
              </div>

              {apiError && <div className={styles.error}>{apiError}</div>}

              <button type="submit" className={styles.submitButton} disabled={submitting || mfaCode.length !== 6}>
                {submitting ? "Verifying..." : "Verify"}
              </button>

              <button
                type="button"
                onClick={() => { setMfaStep(false); setPreAuthToken(null); setMfaCode(""); setApiError(""); }}
                style={{ marginTop: "0.75rem", background: "none", border: "none", color: "var(--text-secondary, #666)", cursor: "pointer", fontSize: "0.875rem" }}
              >
                Back to login
              </button>
            </form>
          )}

          {/* Form */}
          {!mfaStep && <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
            {mode === "register" && (
              <>
                <FormInput
                  label="First Name"
                  placeholder="Your first name"
                  {...formRegister("firstName")}
                  error={errors.firstName}
                  required
                />
                <FormInput
                  label="Last Name"
                  placeholder="Your last name"
                  {...formRegister("lastName")}
                  error={errors.lastName}
                  required
                />
              </>
            )}

            <FormInput
              label="Email"
              type="email"
              placeholder="you@example.com"
              {...formRegister("email")}
              error={errors.email}
              autoComplete="email"
              required
            />

            <div className={styles.inputGroup}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                  className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
                  {...formRegister("password")}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
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
              {errors.password && (
                <span className={styles.error} role="alert">
                  {errors.password.message}
                </span>
              )}
            </div>

            {mode === "register" && (
              <>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Confirm Password</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ""}`}
                      {...formRegister("confirmPassword")}
                      autoComplete="new-password"
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
                  {errors.confirmPassword && (
                    <span className={styles.error} role="alert">
                      {errors.confirmPassword.message}
                    </span>
                  )}
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      {...formRegister("terms")}
                      className={styles.checkbox}
                    />
                    <span>
                      I accept the Terms of Service and Privacy Policy
                    </span>
                  </label>
                  {errors.terms && (
                    <span className={styles.error} role="alert">
                      {errors.terms.message}
                    </span>
                  )}
                </div>
              </>
            )}

            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={submitting || rhfSubmitting}
            >
              {submitting || rhfSubmitting ? "Please wait..." : mode === "register" ? "Create Account" : "Sign In"}
            </button>
          </form>}


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
