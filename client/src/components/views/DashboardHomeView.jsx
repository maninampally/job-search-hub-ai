import { useMemo } from "react";
import {
  MdTrendingUp,
  MdWork,
  MdCalendarToday,
  MdEmojiEvents,
  MdCancel,
  MdStar,
  MdCalendarMonth,
  MdMarkEmailRead,
  MdSecurity,
  MdMail,
  MdBusiness,
  MdFilterList,
  MdOpenInNew,
} from "react-icons/md";

/* ── helpers ──────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function emailEventTitle(type) {
  switch (type) {
    case "Interview Scheduled": return "Interview scheduled";
    case "Offer Received":      return "Offer packet detected";
    case "Rejected":            return "Status: Rejected";
    case "Application Received":
    default:                    return "Extracted application";
  }
}

function EmailEventIcon({ type }) {
  const base = { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" };
  if (type === "Interview Scheduled") return <div style={base}><MdCalendarMonth size={15} /></div>;
  if (type === "Offer Received")      return <div style={base}><MdMarkEmailRead size={15} /></div>;
  if (type === "Rejected")            return <div style={base}><MdCancel size={15} /></div>;
  if (type === "DLP")                 return <div style={base}><MdSecurity size={15} /></div>;
  return <div style={base}><MdStar size={15} /></div>;
}

const STAGE_PILL_CLASS = {
  Wishlist:  "cc-stage-wishlist",
  Applied:   "cc-stage-applied",
  Screening: "cc-stage-screening",
  Interview: "cc-stage-interview",
  Offer:     "cc-stage-offer",
  Rejected:  "cc-stage-rejected",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ── component ────────────────────────────────────────── */
export default function DashboardHomeView({
  /* kept for API compat — topbar handles sync now */
  connected,
  connectedFromCallback,
  gmailSyncAllowed,
  successText,
  errorText,
  stats,
  weeklySummaryDisplay,
  recentApplications: _ra,
  upcomingFollowUps: _uf,
  needsFollowUpJobs,
  pipelineColumns,
  dailyApplicationsSeries,
  onRefresh: _r,
  onRunSyncPreset: _ors,
  onNavigateView,
  onOpenBilling,
  /* new */
  jobs = [],
}) {
  /* ── last-7-days bar chart data ──────────────────────── */
  const chartData = useMemo(() => {
    const countMap = {};
    for (const item of dailyApplicationsSeries || []) {
      countMap[item.date] = item.count;
    }
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      days.push({
        date: iso,
        label: DAY_LABELS[d.getDay()],
        isToday: i === 0,
        count: countMap[iso] || 0,
      });
    }
    return days;
  }, [dailyApplicationsSeries]);

  const maxCount = useMemo(
    () => Math.max(...chartData.map((d) => d.count), 1),
    [chartData]
  );

  /* ── AI extraction log (from job emails) ─────────────── */
  const extractionLog = useMemo(() => {
    const events = [];
    for (const job of jobs) {
      const emails = Array.isArray(job.emails) ? job.emails : [];
      for (const email of emails) {
        if (!email.date) continue;
        events.push({
          key: `${job.id}-${email.gmailId || email.id || Math.random().toString(36).slice(2)}`,
          type: email.type || "Application Received",
          title: emailEventTitle(email.type),
          subtitle: `${job.company || "Unknown"} · ${job.role || "Role"} · Stage set to ${job.status || "Applied"}`,
          date: email.date,
        });
      }
    }
    return events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  }, [jobs]);

  /* ── active jobs for table ──────────────────────────── */
  const activeTableJobs = useMemo(() => {
    const SHOW = ["Applied", "Screening", "Interview", "Offer"];
    return (pipelineColumns || [])
      .filter((col) => SHOW.includes(col.status))
      .flatMap((col) => col.jobs)
      .slice(0, 8);
  }, [pipelineColumns]);

  const navigate = (view) => {
    if (typeof onNavigateView === "function") onNavigateView(view);
  };

  /* KPI derived values */
  const rejections = (stats?.total || 0) - (stats?.active || 0) - (stats?.offers || 0);

  return (
    <>
      {/* ── Alerts ─────────────────────────────────────── */}
      {connectedFromCallback && (
        <div className="inline-note success" style={{ marginBottom: "1rem" }}>
          Gmail connected successfully.
        </div>
      )}
      {successText && (
        <div className="inline-note success" style={{ marginBottom: "1rem" }}>
          {successText}
        </div>
      )}
      {errorText && (
        <div className="inline-note error" style={{ marginBottom: "1rem" }}>
          {errorText}
        </div>
      )}

      {/* ── KPI Grid ────────────────────────────────────── */}
      <div className="cc-kpi-grid">
        {/* Total Applications */}
        <div className="cc-kpi-card">
          <div className="cc-kpi-top">
            <span className="cc-kpi-label">Total Applications</span>
            <span className="cc-kpi-icon"><MdWork size={18} /></span>
          </div>
          <div className="cc-kpi-value">{stats?.total ?? 0}</div>
          <div className="cc-kpi-note cc-success">
            <MdTrendingUp size={13} />
            +{weeklySummaryDisplay?.applicationsThisWeek ?? 0} this week
          </div>
        </div>

        {/* Active Interviews */}
        <div className="cc-kpi-card">
          <div className="cc-kpi-top">
            <span className="cc-kpi-label">Active Interviews</span>
            <span className="cc-kpi-icon"><MdCalendarToday size={18} /></span>
          </div>
          <div className="cc-kpi-value">{stats?.interviews ?? 0}</div>
          <div className="cc-kpi-note">
            {stats?.interviews > 0
              ? `${stats.interviews} upcoming`
              : "Keep applying to get interviews"}
          </div>
        </div>

        {/* Offers */}
        <div className="cc-kpi-card">
          <div className="cc-kpi-top">
            <span className="cc-kpi-label">Offers</span>
            <span className="cc-kpi-icon"><MdEmojiEvents size={18} /></span>
          </div>
          <div className="cc-kpi-value">{stats?.offers ?? 0}</div>
          <div className="cc-kpi-note">
            {stats?.offers > 0 ? "Awaiting your response" : "Keep pushing — offers ahead"}
          </div>
        </div>

        {/* Rejections */}
        <div className="cc-kpi-card">
          <div className="cc-kpi-top">
            <span className="cc-kpi-label">Rejections</span>
            <span className="cc-kpi-icon"><MdCancel size={18} /></span>
          </div>
          <div className="cc-kpi-value">{rejections > 0 ? rejections : 0}</div>
          <div className="cc-kpi-note">
            {needsFollowUpJobs?.length > 0
              ? `${needsFollowUpJobs.length} jobs need follow-up`
              : "Keep the pipeline moving"}
          </div>
        </div>
      </div>

      {/* ── Overview Middle: Chart + Log ─────────────────── */}
      <div className="cc-overview-middle">
        {/* Application Activity bar chart */}
        <div className="cc-section-card">
          <div className="cc-card-head">
            <h3 className="cc-card-title">Application Activity</h3>
            <span className="cc-card-meta">Last 7 Days</span>
          </div>
          <div className="cc-chart-body">
            <div className="cc-bar-chart">
              {chartData.map((day) => {
                const heightPct = maxCount > 0 ? Math.max((day.count / maxCount) * 100, 4) : 4;
                return (
                  <div key={day.date} className="cc-bar-col">
                    <div className="cc-bar-wrap">
                      <div
                        className={`cc-bar${day.isToday ? " cc-bar-active" : ""}`}
                        style={{ height: `${heightPct}%` }}
                      >
                        {day.isToday && day.count > 0 && (
                          <div className="cc-bar-tip">{day.count}</div>
                        )}
                      </div>
                    </div>
                    <div className={`cc-bar-label${day.isToday ? " cc-bar-label-active" : ""}`}>
                      {day.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent AI Extractions */}
        <div className="cc-section-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="cc-card-head">
            <h3 className="cc-card-title">Recent AI Extractions</h3>
            <span className="cc-card-meta" style={{ fontSize: "0.75rem" }}>ⓘ</span>
          </div>

          {extractionLog.length === 0 ? (
            <div className="cc-empty-state">
              {connected
                ? "No recent extractions. Run a sync to pull Gmail."
                : "Connect Gmail to start AI-powered email extraction."}
              {!connected && !gmailSyncAllowed && (
                <div style={{ marginTop: "0.5rem" }}>
                  <button type="button" onClick={onOpenBilling} style={{ fontSize: "0.8rem" }}>
                    View plans
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="cc-log-list" style={{ flex: 1 }}>
              {extractionLog.map((ev) => (
                <div key={ev.key} className="cc-log-row">
                  <div className="cc-log-icon">
                    <EmailEventIcon type={ev.type} />
                  </div>
                  <div className="cc-log-copy">
                    <div className="cc-log-title">{ev.title}</div>
                    <div className="cc-log-sub">{ev.subtitle}</div>
                  </div>
                  <div className="cc-log-time">{timeAgo(ev.date)}</div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="cc-log-footer"
            onClick={() => navigate("Job Tracker")}
          >
            View full sync log
          </button>
        </div>
      </div>

      {/* ── Active Applications Pipeline ─────────────────── */}
      <div className="cc-table-shell">
        <div className="cc-table-header">
          <h3 className="cc-card-title">Active Applications Pipeline</h3>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              className="cc-filter-btn"
              onClick={() => navigate("Job Tracker")}
            >
              <MdFilterList size={14} />
              Filter
            </button>
          </div>
        </div>

        {activeTableJobs.length === 0 ? (
          <div className="cc-empty-state">
            No active applications yet.{" "}
            <button
              type="button"
              className="cc-action-link"
              onClick={() => navigate("Job Tracker")}
            >
              Add your first job →
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="cc-data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Pipeline Stage</th>
                    <th>Source</th>
                    <th>Last Activity</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTableJobs.map((job) => {
                    const pillClass = STAGE_PILL_CLASS[job.status] || "cc-stage-applied";
                    const emailCount = Array.isArray(job.emails) ? job.emails.length : 0;
                    const latestEmail = Array.isArray(job.emails) && job.emails.length > 0
                      ? job.emails.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b)
                      : null;
                    return (
                      <tr key={job.id}>
                        <td>
                          <div className="cc-company-cell">
                            <div className="cc-company-logo">
                              <MdBusiness size={16} />
                            </div>
                            <div>
                              <div className="cc-company-name">{job.company || "—"}</div>
                              <div className="cc-company-note">
                                {emailCount > 0
                                  ? `${emailCount} message${emailCount > 1 ? "s" : ""} extracted`
                                  : "Manually added"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                          {job.role || "—"}
                        </td>
                        <td>
                          <span className={`cc-stage-pill ${pillClass}`}>
                            <span className="cc-stage-dot" />
                            {job.status || "Applied"}
                          </span>
                        </td>
                        <td>
                          <div className="cc-source-line">
                            <MdMail size={13} />
                            {emailCount > 0 ? "Gmail Sync" : "Manual"}
                          </div>
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>
                          {latestEmail ? timeAgo(latestEmail.date) : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="cc-action-link"
                            onClick={() => navigate("Job Tracker")}
                          >
                            <MdOpenInNew size={12} style={{ marginRight: 3 }} />
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="cc-view-all-btn"
              onClick={() => navigate("Job Tracker")}
            >
              View full pipeline in Job Tracker →
            </button>
          </>
        )}
      </div>
    </>
  );
}
