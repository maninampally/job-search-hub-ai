import { useState, useEffect } from "react";
import { getJobTimeline } from "../api/backend";

export default function TimelineTab({ jobId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTimeline() {
      setLoading(true);
      setError("");
      try {
        const result = await getJobTimeline(jobId);
        if (result.success && Array.isArray(result.data)) {
          setTimeline(result.data);
        } else {
          setError("Unable to load timeline from backend");
          setTimeline([]);
        }
      } catch (err) {
        setError("Unable to load timeline from backend");
        setTimeline([]);
      } finally {
        setLoading(false);
      }
    }

    if (jobId) {
      loadTimeline();
    }
  }, [jobId]);

  function formatTimelineDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="timeline-tab">
        <p className="muted">Loading timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="timeline-tab">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="timeline-tab">
      <h3>Status Timeline</h3>
      {timeline.length === 0 ? (
        <p className="muted">No status changes recorded yet.</p>
      ) : (
        <div className="timeline-stepper">
          <div className="timeline-line" />
          {timeline.map((event, index) => (
            <div key={event.id || `timeline-${index}`} className="timeline-event">
              <div className="timeline-marker">
                <span className="timeline-dot" />
              </div>
              <div className="timeline-content">
                <div className="event-header">
                  <h4>
                    <span className={`status-badge status-${event.to_status?.toLowerCase() || "unknown"}`}>
                      {event.to_status || "Unknown"}
                    </span>
                  </h4>
                  <p className="event-date">{formatTimelineDate(event.changed_at || event.created_at)}</p>
                </div>
                {event.trigger && (
                  <p className="event-trigger">
                    <strong>Via:</strong> {event.trigger}
                  </p>
                )}
                {event.notes && <p className="event-notes">{event.notes}</p>}
                {event.from_status && (
                  <p className="event-transition">
                    <small>
                      {event.from_status} → {event.to_status}
                    </small>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
