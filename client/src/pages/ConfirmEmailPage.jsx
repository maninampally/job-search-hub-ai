import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "../api/backend";

/**
 * Public page - no auth required.
 * Handles the email verification link clicked from the user's inbox.
 */
export default function ConfirmEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the link.");
      return;
    }

    async function confirm() {
      try {
        const res = await fetch(
          `${BACKEND_URL}/auth/verify-email/confirm?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
          setMessage("Your email has been verified successfully!");
          setTimeout(() => navigate("/login", { replace: true }), 3000);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed. The link may have expired.");
        }
      } catch {
        setStatus("error");
        setMessage("Could not reach the server. Please try again later.");
      }
    }

    confirm();
  }, [token, navigate]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, -apple-system, sans-serif",
      background: "#f8fafc",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: "3rem 2.5rem",
        maxWidth: 440,
        width: "100%",
        textAlign: "center",
        border: "1px solid #e2e8f0",
      }}>
        {status === "verifying" && (
          <>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>&#9203;</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>
              Verifying your email...
            </h1>
            <p style={{ color: "#64748b" }}>Please wait a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "#dcfce7",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1rem", fontSize: "1.5rem", color: "#16a34a",
            }}>&#10003;</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>
              Email Verified
            </h1>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>{message}</p>
            <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Redirecting to login...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "#fee2e2",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1rem", fontSize: "1.5rem", color: "#dc2626",
            }}>&#10007;</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>
              Verification Failed
            </h1>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>{message}</p>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "0.75rem 1.5rem", background: "#1e293b", color: "#fff",
                border: "none", borderRadius: 8, fontSize: "0.95rem",
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
