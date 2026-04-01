const CARD_ITEMS = [
  { label: "Total Applied", key: "total", tone: "tone-blue" },
  { label: "In Progress", key: "active", tone: "tone-purple" },
  { label: "Offers", key: "offers", tone: "tone-green" },
  { label: "Contacts", key: "contacts", tone: "tone-gold" },
];

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
  onRefresh,
  onConnectGmail,
  onDisconnect,
  onSync,
}) {
  return (
    <>
      <header className="hero">
        <h1>{`${greetingText}, ${firstName}`}</h1>
        <p>Here is your job search overview</p>
      </header>

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
        <button type="button" onClick={onConnectGmail} disabled={!isHealthy}>
          Connect Gmail
        </button>
        <button type="button" onClick={onDisconnect} disabled={!connected}>
          Disconnect
        </button>
        <button type="button" onClick={onSync} disabled={!connected || syncing}>
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

      <section className="block">
        <h3>Weekly Summary</h3>
        <ul>
          <li>
            <strong>Applications:</strong> {weeklySummaryDisplay.applicationsThisWeek}
          </li>
          <li>
            <strong>Responses:</strong> {weeklySummaryDisplay.responsesThisWeek}
          </li>
          <li>
            <strong>Interviews:</strong> {weeklySummaryDisplay.interviewsThisWeek}
          </li>
          <li>
            <strong>Stalled Jobs:</strong> {weeklySummaryDisplay.stalledJobs}
          </li>
        </ul>
      </section>

      <section className="two-col">
        <article className="block">
          <h3>Recent Applications</h3>
          {recentApplications.length === 0 ? (
            <p>No jobs tracked yet</p>
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
            <p>No reminders set</p>
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
            <p>No stale applications right now</p>
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
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
