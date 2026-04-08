import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { confirmEmailVerification, requestEmailVerification } from "../api/backend";
import "../styles/app.css";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, refreshUser } = useAuth();
  
  const [status, setStatus] = useState("idle"); // idle, loading, success, error, requesting
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [autoSentEmail, setAutoSentEmail] = useState(false);

  // Auto-verify if token in URL
  useEffect(() => {
    if (!token) {
      return;
    }

    async function autoVerify() {
      try {
        setStatus("loading");
        const result = await confirmEmailVerification(token);
        
        if (result.success) {
          setStatus("success");
          setMessage("Email verified successfully! Redirecting...");
          
          // Refresh user to get updated verification status
          await refreshUser();
          
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate("/dashboard?verified=true");
          }, 2000);
        }
      } catch (err) {
        setStatus("error");
        setError(err.message || "Verification failed");
      }
    }

    autoVerify();
  }, [token, refreshUser, navigate]);

  // Auto-send verification email on first page load (if no token and email not verified)
  useEffect(() => {
    if (token || autoSentEmail || user?.email_verified_at) {
      return;
    }

    async function autoSendEmail() {
      try {
        setStatus("requesting");
        setAutoSentEmail(true);
        const result = await requestEmailVerification();
        
        if (result.success) {
          setMessage(result.message || `Verification email sent to ${user?.email}`);
          setStatus("idle");
        }
      } catch (err) {
        setStatus("idle");
        setError(err.message || "Failed to send verification email");
      }
    }

    // Small delay to ensure user context is fully loaded
    const timer = setTimeout(autoSendEmail, 500);
    return () => clearTimeout(timer);
  }, [token, autoSentEmail, user?.email, user?.email_verified_at]);

  async function handleRequestVerification() {
    try {
      setStatus("requesting");
      setError("");
      const result = await requestEmailVerification();
      
      if (result.success) {
        setMessage(result.message || `Verification email sent to ${user?.email}`);
        setTimeout(() => {
          setStatus("idle");
        }, 5000);
      }
    } catch (err) {
      setStatus("idle");
      setError(err.message || "Failed to send verification email");
    }
  }

  // Redirect if already verified
  if (user?.email_verified_at) {
    useEffect(() => {
      navigate("/dashboard");
    }, []);
  }

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    useEffect(() => {
      navigate("/login");
    }, []);
  }

  if (status === "success") {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>✓ Email Verified</h1>
          <p>{message}</p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "1rem" }}>
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Verifying Email...</h1>
          <p>Please wait while we verify your email address.</p>
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <div className="spinner" style={{ display: "inline-block" }}>
              ⏳
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Verify Your Email</h1>
        <p>
          To set up Gmail integration and start extracting job opportunities,
          please verify your email address.
        </p>
        
        <div style={{ marginTop: "1.5rem" }}>
          {error && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "#fee",
                color: "#c33",
                borderRadius: "4px",
                marginBottom: "1rem",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "#efe",
                color: "#3c3",
                borderRadius: "4px",
                marginBottom: "1rem",
                fontSize: "14px",
              }}
            >
              {message}
            </div>
          )}

          <div style={{ marginTop: "1.5rem" }}>
            <button
              onClick={handleRequestVerification}
              disabled={status === "requesting"}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "16px",
                cursor: status === "requesting" ? "not-allowed" : "pointer",
                opacity: status === "requesting" ? 0.6 : 1,
              }}
            >
              {status === "requesting" ? "Sending..." : "Send Verification Email"}
            </button>
          </div>

          <div style={{ marginTop: "1rem", fontSize: "14px", color: "#666" }}>
            <p>📧 We'll send a verification link to:</p>
            <p style={{ fontWeight: "bold", color: "#333" }}>{user?.email}</p>
          </div>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "12px",
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
              fontSize: "13px",
              color: "#666",
              lineHeight: "1.6",
            }}
          >
            <p style={{ margin: 0, marginBottom: "8px" }}>
              <strong>Rate Limit:</strong> You can request up to 3 verification
              emails per hour.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Expires:</strong> Verification links expire in 24 hours.
            </p>
          </div>

          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                padding: "8px 16px",
                backgroundColor: "transparent",
                color: "#007bff",
                border: "1px solid #007bff",
                borderRadius: "4px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
