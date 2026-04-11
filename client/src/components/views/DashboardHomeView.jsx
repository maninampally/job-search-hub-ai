const CARD_ITEMS = [
  { label: "Total Applied", key: "total", tone: "tone-blue" },
  { label: "In Progress", key: "active", tone: "tone-purple" },
  { label: "Offers", key: "offers", tone: "tone-green" },
  { label: "Contacts", key: "contacts", tone: "tone-gold" },
];

import { useState, useEffect, useCallback } from "react";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import { getDailyReport } from "../../api/backend";

export default function DashboardHomeView({
  greetingText,
  firstName,
  isHealthy,
  BACKEND_URL,
  loading,
  syncing,
  connected,
  connectedFromCallback,
  gmailSyncAllowed = true,
  successText,
  errorText,
  stats,
  weeklySummaryDisplay,
  recentApplications,
  upcomingFollowUps,
  needsFollowUpJobs,
  pipelineColumns,
  dailyApplicationsSeries,
  onRefresh,
  onRunSyncPreset,
  onNavigateView,
  onChangeDailyRange,
  onOpenBilling,
}) {
  const [selectedDaysRange, setSelectedDaysRange] = useState(7);
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [syncPreset, setSyncPreset] = useState("now");
  const [dailyReport, setDailyReport] = useState(null);
  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [dailyReportHours, setDailyReportHours] = useState(24);

  const fetchDailyReport = useCallback(async (hours) => {
    setDailyReportLoading(true);
    try {
      const res = await getDailyReport(hours);
      if (res.ok) setDailyReport(res.data);
    } catch { /* ignore */ }
    setDailyReportLoading(false);
  }, []);

  useEffect(() => { fetchDailyReport(dailyReportHours); }, [dailyReportHours, fetchDailyReport]);

  const followUpRate = stats.active > 0
    ? Math.round((needsFollowUpJobs.length / stats.active) * 100)
    : 0;

  const weeklyKpis = [
    { label: "Applications", value: weeklySummaryDisplay.applicationsThisWeek, tone: "kpi-indigo" },
    { label: "Responses", value: weeklySummaryDisplay.responsesThisWeek, tone: "kpi-teal" },
    { label: "Interviews", value: weeklySummaryDisplay.interviewsThisWeek, tone: "kpi-violet" },
    { label: "Stalled", value: weeklySummaryDisplay.stalledJobs, tone: "kpi-amber" },
  ];

  const navigateTo = (view) => {
    if (typeof onNavigateView === "function") onNavigateView(view);
  };

  return (
    <>
      <header className="hero">
        <h1>{`${greetingText}, ${firstName}`}</h1>
        <p>Here is your job search command center for today</p>
      </header>

      <section className="quick-actions-grid">
        <article className="focus-card">
          <p className="focus-label">Today Focus</p>
          <h3>{connected ? "Keep your pipeline moving" : "Connect and import your first jobs"}</h3>
          <p>
            {connected
              ? `${needsFollowUpJobs.length} jobs need follow-up. Prioritize applications waiting for recruiter response.`
              : "Link Gmail once and start syncing applications directly into your tracker."}
          </p>
          <div className="focus-meta">
            <span className="focus-pill">{stats.active} active roles</span>
            <span className="focus-pill">{followUpRate}% follow-up pressure</span>
          </div>
        </article>

        <article className="quick-links-card">
          <p className="focus-label">Quick Jumps</p>
          <div className="quick-links">
            <button type="button" onClick={() => navigateTo("Job Tracker")}>Open Tracker</button>
            <button type="button" onClick={() => navigateTo("Contacts")}>Review Contacts</button>
            <button type="button" onClick={() => navigateTo("Reminders")}>Check Reminders</button>
          </div>
        </article>
      </section>

      <section className="sync-box inbox-summary">
        <div>
          <h3>Backend and inbox</h3>
          <p>
            {isHealthy ? (
              <>
                API is reachable at {BACKEND_URL}. Gmail:{" "}
                <strong>{connected ? "connected" : "not connected"}</strong>
                {!gmailSyncAllowed && " (upgrade required for sync)"}. Manage Gmail, disconnect, and email
                extraction under Settings.
              </>
            ) : (
              <>
                Point <code>VITE_BACKEND_URL</code> at your API and ensure it is running. Current target:{" "}
                {BACKEND_URL}.
              </>
            )}
          </p>
        </div>
        <div className="inbox-summary-actions" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <span className="sync-badge">{isHealthy ? "Backend ready" : "Check backend"}</span>
          <button type="button" onClick={onRefresh} disabled={loading}>
            Refresh data
          </button>
          <button type="button" onClick={() => onNavigateView("Settings")}>
            Open Settings
          </button>
          {gmailSyncAllowed && connected && (
            <>
              <select
                value={syncPreset}
                onChange={(event) => setSyncPreset(event.target.value)}
                disabled={syncing}
                title="Choose sync window"
              >
                <option value="now">Sync now (since last auto sync)</option>
                <option value="6m">Sync 6M</option>
                <option value="3m">Sync 3M</option>
                <option value="1m">Sync 1M</option>
                <option value="1w">Sync 1W</option>
                <option value="3d">Sync 3D</option>
                <option value="1d">Sync 1D</option>
              </select>
              <button
                type="button"
                onClick={() => typeof onRunSyncPreset === "function" && onRunSyncPreset(syncPreset)}
                disabled={syncing || typeof onRunSyncPreset !== "function"}
                title="Run selected sync window"
              >
                {syncing ? "Syncing…" : "Run sync"}
              </button>
            </>
          )}
          {!gmailSyncAllowed && (
            <button type="button" onClick={onOpenBilling}>
              View plans
            </button>
          )}
        </div>
      </section>

      {connectedFromCallback && <div className="inline-note success">Gmail connected successfully.</div>}
      {successText && <div className="inline-note success">{successText}</div>}
      {errorText && <div className="inline-note error">{errorText}</div>}

      <section className="overview-cards">
        {CARD_ITEMS.map((card) => (
          <article key={card.key} className={`overview-card ${card.tone}`}>
            <p>{card.label}</p>
            <strong>{stats[card.key]}</strong>
          </article>
        ))}
        <article className="overview-card tone-blue">
          <p>Weekly Applications</p>
          <strong>{weeklySummaryDisplay.applicationsThisWeek}</strong>
        </article>
      </section>

      <section className="block chart-block">
        <div className="chart-header">
          <h3>Daily Applications</h3>
          <div className="range-picker">
            <select 
              value={isCustomRange ? "custom" : selectedDaysRange} 
              onChange={(e) => {
                const value = e.target.value;
                if (value === "custom") {
                  setIsCustomRange(true);
                } else {
                  const newDays = parseInt(value);
                  setSelectedDaysRange(newDays);
                  setIsCustomRange(false);
                  if (typeof onChangeDailyRange === "function") {
                    onChangeDailyRange(newDays);
                  }
                }
              }}
              className="range-selector"
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days (3 months)</option>
              <option value="custom">Custom Range</option>
            </select>
            {isCustomRange && (
              <div className="custom-date-inputs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="date-input"
                />
                <span className="date-separator">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="date-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof onChangeDailyRange === "function") {
                      onChangeDailyRange(null, customStartDate, customEndDate);
                    }
                  }}
                  className="btn-apply-range"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
        {dailyApplicationsSeries && dailyApplicationsSeries.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyApplicationsSeries} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                tickFormatter={(date) => {
                  const [, m, d] = date.split("-");
                  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]} ${parseInt(d)}`;
                }}
              />
              <YAxis 
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                type="number"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "var(--bg-surface)", 
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                }}
                labelStyle={{ color: "var(--text-primary)" }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="var(--indigo-600)" 
                dot={{ fill: "var(--indigo-600)", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted">No application data available for the selected range.</p>
        )}
      </section>

      <section className="block">
        <h3>Weekly Summary</h3>
        <div className="weekly-kpis">
          {weeklyKpis.map((kpi) => (
            <article key={kpi.label} className={`weekly-kpi ${kpi.tone}`}>
              <p>{kpi.label}</p>
              <strong>{kpi.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="block daily-report-section">
        <div className="chart-header">
          <h3>Daily Sync Report</h3>
          <select
            value={dailyReportHours}
            onChange={(e) => setDailyReportHours(Number(e.target.value))}
            className="range-selector"
          >
            <option value={12}>Last 12 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={48}>Last 48 Hours</option>
            <option value={72}>Last 3 Days</option>
            <option value={168}>Last 7 Days</option>
          </select>
        </div>
        {dailyReportLoading ? (
          <p className="muted">Loading report...</p>
        ) : !dailyReport ? (
          <p className="muted">No report data available. Run a sync first.</p>
        ) : (
          <>
            <div className="weekly-kpis" style={{ marginBottom: "1rem" }}>
              <article className="weekly-kpi kpi-indigo">
                <p>Emails Processed</p>
                <strong>{dailyReport.summary?.emailsProcessed ?? 0}</strong>
              </article>
              <article className="weekly-kpi kpi-teal">
                <p>Jobs Created</p>
                <strong>{dailyReport.summary?.jobsCreated ?? 0}</strong>
              </article>
              <article className="weekly-kpi kpi-violet">
                <p>Status Changes</p>
                <strong>{dailyReport.summary?.statusChanges ?? 0}</strong>
              </article>
            </div>

            {dailyReport.emailsByType && Object.keys(dailyReport.emailsByType).length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>Emails by Type</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {Object.entries(dailyReport.emailsByType).map(([type, count]) => (
                    <span key={type} className="focus-pill">{type}: {count}</span>
                  ))}
                </div>
              </div>
            )}

            {dailyReport.newJobs && dailyReport.newJobs.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>New Jobs</h4>
                <ul>
                  {dailyReport.newJobs.map((j, i) => (
                    <li key={i}>
                      <strong>{j.role || "Unknown Role"}</strong> at {j.company || "N/A"} - {j.status}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dailyReport.statusChanges && dailyReport.statusChanges.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>Status Changes</h4>
                <ul>
                  {dailyReport.statusChanges.map((sc, i) => (
                    <li key={i}>
                      <strong>{sc.company}</strong> - {sc.role}: {sc.from || "New"} → {sc.to}
                      <span className="muted" style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                        {new Date(sc.date).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dailyReport.recentEmails && dailyReport.recentEmails.length > 0 && (
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Recent Emails ({dailyReport.recentEmails.length})
                </summary>
                <ul style={{ marginTop: "0.5rem" }}>
                  {dailyReport.recentEmails.map((em, i) => (
                    <li key={i} style={{ marginBottom: "0.25rem" }}>
                      <strong>{em.company}</strong> - {em.subject?.slice(0, 60)}
                      <span className="muted" style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                        {em.type} - {new Date(em.date).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      <section className="two-col">
        <article className="block">
          <h3>Recent Applications</h3>
          {recentApplications.length === 0 ? (
            <div className="empty-inline">
              <p>No jobs tracked yet</p>
              <button type="button" onClick={() => navigateTo("Job Tracker")}>Add your first job</button>
            </div>
          ) : (
            <ul>
              {recentApplications.map((job) => (
                <li key={job.id}>
                  <strong>{job.role}</strong> · {job.company}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="block">
          <h3>Upcoming Follow Ups</h3>
          {upcomingFollowUps.length === 0 ? (
            <div className="empty-inline">
              <p>No reminders set</p>
              <button type="button" onClick={() => navigateTo("Reminders")}>Create reminder</button>
            </div>
          ) : (
            <ul>
              {upcomingFollowUps.map((job) => (
                <li key={`followup-${job.id}`}>
                  <strong>{job.company}</strong> · {job.status}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="block">
          <h3>Needs Follow-up (Smart)</h3>
          {needsFollowUpJobs.length === 0 ? (
            <p>Great momentum. No stale applications right now.</p>
          ) : (
            <ul>
              {needsFollowUpJobs.map((job) => (
                <li key={`smart-followup-${job.id}`}>
                  <strong>{job.company}</strong> · {job.role}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="pipeline-section">
        <h3>Pipeline</h3>
        <div className="pipeline-grid">
          {pipelineColumns.map((column) => (
            <article key={column.status} className="pipeline-col">
              <header>
                <h4>{column.status}</h4>
                <span>{column.jobs.length}</span>
              </header>
              {column.jobs.slice(0, 2).map((job) => (
                <div key={`${column.status}-${job.id}`} className="pipeline-card">
                  <strong>{job.role || "Unknown Role"}</strong>
                  <p>{job.company || "N/A"}</p>
                </div>
              ))}
              {column.jobs.length === 0 && <p className="pipeline-empty">No roles in this stage</p>}
            </article>
          ))}
        </div>
        <button
          type="button"
          className="pipeline-cta"
          onClick={() => navigateTo("Job Tracker")}
        >
          Open full pipeline in Job Tracker
        </button>
      </section>

    </>
  );
}
