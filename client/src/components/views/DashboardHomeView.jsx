const CARD_ITEMS = [
  { label: "Total Applied", key: "total", tone: "tone-blue" },
  { label: "In Progress", key: "active", tone: "tone-purple" },
  { label: "Offers", key: "offers", tone: "tone-green" },
  { label: "Contacts", key: "contacts", tone: "tone-gold" },
];

import { useState } from "react";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";

export default function DashboardHomeView({
  greetingText,
  firstName,
  isHealthy,
  BACKEND_URL,
  loading,
  syncing,
  connected,
  connectedFromCallback,
  successText,
  errorText,
  stats,
  weeklySummaryDisplay,
  recentApplications,
  upcomingFollowUps,
  needsFollowUpJobs,
  pipelineColumns,
  dailyApplicationsSeries,
  isEmailVerified,
  onRefresh,
  onConnectGmail,
  onDisconnect,
  onSync,
  onNavigateView,
  onChangeDailyRange,
}) {
  const [selectedDaysRange, setSelectedDaysRange] = useState(7);
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
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

      <section className="sync-box">
        <div>
          <h3>Gmail Auto Sync</h3>
          <p>
            {isHealthy
              ? `Backend is connected at ${BACKEND_URL}.`
              : "Deploy backend first, then update your BACKEND URL to start live sync."}
          </p>
        </div>
        <span className="sync-badge">{isHealthy ? "Backend Connected" : "Set BACKEND URL first"}</span>
      </section>

      <section className="control-row">
        <button type="button" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
        <button
          type="button"
          onClick={onConnectGmail}
          disabled={!isEmailVerified || !isHealthy}
          title={!isEmailVerified ? "Verify your email in Profile first" : "Connect Gmail account"}
        >
          {connected ? "Gmail Connected" : "Connect Gmail"}
        </button>
        <button type="button" onClick={onDisconnect} disabled={!connected}>
          Disconnect
        </button>
        <button type="button" onClick={onSync} disabled={!connected || syncing || !isEmailVerified}>
          {syncing ? "Syncing..." : "Sync Jobs"}
        </button>
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
