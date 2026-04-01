import { useState, useEffect } from "react";
import { getJobEmails } from "../api/backend";

export default function EmailLogTab({
  jobId,
  formatEmailDate,
  getEmailTypeClass,
  onEmailDoubleClick,
}) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEmails() {
      setLoading(true);
      setError("");
      try {
        const result = await getJobEmails(jobId);
        if (result.success && Array.isArray(result.data)) {
          setEmails(result.data);
        } else {
          setError("Unable to load emails from backend");
          setEmails([]);
        }
      } catch (err) {
        setError("Unable to load emails from backend");
        setEmails([]);
      } finally {
        setLoading(false);
      }
    }

    if (jobId) {
      loadEmails();
    }
  }, [jobId]);

  if (loading) {
    return (
      <div className="email-log-tab">
        <p className="muted">Loading email log...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="email-log-tab">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="email-log-tab">
      <h3>Email Log</h3>
      {emails.length === 0 ? (
        <p className="muted">No emails found for this job.</p>
      ) : (
        <div className="email-log-timeline">
          <div className="email-timeline-line" />
          {emails.map((email, index) => (
            <article
              key={email.id || `email-${index}`}
              className="email-log-card"
              onDoubleClick={() => onEmailDoubleClick?.(email)}
              style={{ cursor: "pointer" }}
            >
              <div className="email-timeline-dot-wrap">
                <span
                  className={`email-timeline-dot ${getEmailTypeClass?.(email.type) || "email-type-auto"}`}
                />
              </div>
              <div className="email-log-content">
                <div className="email-log-header">
                  <div>
                    <p className="email-sender-name">{email.from_name || email.from || "Unknown Sender"}</p>
                    <p className="email-sender-address">{email.from || ""}</p>
                  </div>
                  <p className="email-date-text">{formatEmailDate?.(email.date || email.created_at) || "Unknown Date"}</p>
                </div>
                <p className="email-subject">
                  <strong>{email.subject || "No Subject"}</strong>
                </p>
                <p className="email-preview">{email.preview || email.body || "No message available"}</p>
                <div className="control-row">
                  <span className={`chip ${getEmailTypeClass?.(email.type) || "email-type-auto"}`}>
                    {email.type || "Auto / Tracking"}
                  </span>
                  <span className={`chip ${email.is_real ? "email-real-badge" : "email-auto-badge"}`}>
                    {email.is_real ? "Real Email" : "Auto / Tracking"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
