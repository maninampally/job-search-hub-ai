import JobListView from "../JobListView";
import EmailLogTab from "../EmailLogTab";
import TimelineTab from "../TimelineTab";

const PIPELINE_ORDER = ["Wishlist", "Applied", "Screening", "Interview", "Offer", "Rejected"];

export default function JobTrackerView({
  jobs,
  filteredJobs,
  jobTrackerColumns,
  resumes,
  loading,
  syncing,
  connected,
  expandedJobs,
  activeDetailTab,
  draggedJobId,
  activeEmailModal,
  editingJobId,
  jobForm,
  searchQuery,
  jobSmartView,
  statusFilter,
  successText,
  errorText,
  onToggleJobExpanded,
  onSetJobDetailTab,
  onJobDragStart,
  onJobDragEnd,
  onStatusChange,
  onEditJob,
  onMarkImported,
  onDelete,
  onSaveJob,
  onJobInput,
  onCancelEditJob,
  onSync,
  onLoadDashboard,
  onAttachResume,
  onEmailCardDoubleClick,
  onCloseEmailModal,
  onSearchChange,
  onSmartViewChange,
  onStatusFilterChange,
  mergeEmails,
  getStatusChipClass,
  getEmailTypeClass,
  formatEmailDate,
  getEmailIdentity,
}) {
  function renderJobTrackerCard(job) {
    const emails = mergeEmails([], job.emails || []);
    const isExpanded = Boolean(expandedJobs[job.id]);
    const hasUnreadRealEmail = emails.some((email) => email.isReal && !email.isRead);

    return (
      <article
        key={job.id}
        className={`tracker-card card-${getStatusChipClass(job.status || "Wishlist")} ${
          "is-draggable"
        } ${draggedJobId === job.id ? "is-dragging" : ""}`}
        draggable={true}
        onDragStart={() => onJobDragStart(job.id)}
        onDragEnd={onJobDragEnd}
      >
        <header
          className="tracker-card-header"
          role="button"
          tabIndex={0}
          onClick={() => onToggleJobExpanded(job.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleJobExpanded(job.id);
            }
          }}
        >
          <div>
            <h4>{job.role || "Unknown Role"}</h4>
            <p>
              <strong>{job.company || "Unknown Company"}</strong>
            </p>
            <p>{job.location || "Location not set"}</p>
            <p>Applied: {job.appliedDate || "Unknown"}</p>
          </div>
          <div className="tracker-card-badges">
            <span className={`chip ${getStatusChipClass(job.status || "Wishlist")}`}>
              {job.status || "Wishlist"}
            </span>
            <span className="chip email-count-badge">
              {emails.length} emails
              {hasUnreadRealEmail && <span className="email-unread-dot" />}
            </span>
          </div>
        </header>

        {isExpanded && (
          <>
            <p>{job.recruiterName || "Recruiter not available"}</p>

            <div className="job-detail-tabs">
              <div className="tabs-header">
                <button
                  type="button"
                  className={`tab-button ${(activeDetailTab[job.id] || "summary") === "summary" ? "active" : ""}`}
                  onClick={() => onSetJobDetailTab(job.id, "summary")}
                >
                  Summary
                </button>
                <button
                  type="button"
                  className={`tab-button ${activeDetailTab[job.id] === "emails" ? "active" : ""}`}
                  onClick={() => onSetJobDetailTab(job.id, "emails")}
                >
                  Email Log
                </button>
                <button
                  type="button"
                  className={`tab-button ${activeDetailTab[job.id] === "timeline" ? "active" : ""}`}
                  onClick={() => onSetJobDetailTab(job.id, "timeline")}
                >
                  Timeline
                </button>
              </div>

              <div className="tabs-content">
                {(activeDetailTab[job.id] || "summary") === "summary" && (
                  <div className="email-thread-panel">
                    {emails.length === 0 ? (
                      <p className="muted">No emails yet — will auto-populate from Gmail</p>
                    ) : (
                      <div className="email-timeline">
                        <div className="email-timeline-line" />
                        {emails.map((email) => (
                          <article
                            key={getEmailIdentity(email) || email.id}
                            className={`email-mini-card ${email.isReal ? "email-real" : "email-auto"}`}
                            onDoubleClick={() => onEmailCardDoubleClick(job.id, email)}
                            title="Double-click to read full email"
                          >
                            <div className="email-timeline-dot-wrap">
                              <span className={`email-timeline-dot ${getEmailTypeClass(email.type)}`} />
                            </div>
                            <div className="email-mini-content">
                              <div className="email-mini-top">
                                <div>
                                  <p className="email-sender-name">{email.fromName || "Unknown Sender"}</p>
                                  <p className="email-sender-address">{email.from || ""}</p>
                                </div>
                                <p className="email-date-text">{formatEmailDate(email.date)}</p>
                              </div>
                              <p className="email-subject">{email.subject || "No subject"}</p>
                              <p className="email-preview">{email.body || email.preview || "No message available"}</p>
                              <div className="control-row">
                                <span className={`chip ${getEmailTypeClass(email.type)}`}>
                                  {email.type || "Auto / Tracking"}
                                </span>
                                <span className={`chip ${email.isReal ? "email-real-badge" : "email-auto-badge"}`}>
                                  {email.isReal ? "Real email" : "Auto / Tracking email"}
                                </span>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeDetailTab[job.id] === "emails" && (
                  <EmailLogTab
                    jobId={job.id}
                    formatEmailDate={formatEmailDate}
                    getEmailTypeClass={getEmailTypeClass}
                    onEmailDoubleClick={(email) => onEmailCardDoubleClick(job.id, email)}
                  />
                )}

                {activeDetailTab[job.id] === "timeline" && (
                  <TimelineTab jobId={job.id} />
                )}
              </div>
            </div>

            {activeEmailModal && activeEmailModal.jobId === job.id && (
              <div className="email-modal-overlay" onClick={onCloseEmailModal}>
                <section className="email-modal" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="email-modal-close" onClick={onCloseEmailModal}>
                    ×
                  </button>
                  <h3>{activeEmailModal.email.subject || "No subject"}</h3>
                  <p>
                    <strong>{activeEmailModal.email.fromName || "Unknown Sender"}</strong>
                  </p>
                  <p>{activeEmailModal.email.from || ""}</p>
                  <p className="muted">{formatEmailDate(activeEmailModal.email.date)}</p>
                  <div className="control-row">
                    <span className={`chip ${getEmailTypeClass(activeEmailModal.email.type)}`}>
                      {activeEmailModal.email.type || "Auto / Tracking"}
                    </span>
                    <span className={`chip ${activeEmailModal.email.isReal ? "email-real-badge" : "email-auto-badge"}`}>
                      {activeEmailModal.email.isReal ? "Real email" : "Auto / Tracking email"}
                    </span>
                  </div>
                  <pre className="email-modal-body">{activeEmailModal.email.body || "No body text available"}</pre>
                </section>
              </div>
            )}

            <div className="resume-attachment-section" style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
                Attach Resume for this Role
              </label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <select
                  value={job.attachedResumeId || ""}
                  onChange={(event) => onAttachResume(job.id, event.target.value)}
                  disabled={false}
                  style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ddd" }}
                >
                  <option value="">-- No resume attached --</option>
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.name} ({resume.mimeType === "application/pdf" ? "PDF" : "DOCX"})
                    </option>
                  ))}
                </select>
                {job.attachedResumeId && (
                  <p style={{ margin: "0", fontSize: "12px", color: "#667eea", fontWeight: "500" }}>
                    ✓ Attached
                  </p>
                )}
              </div>
            </div>

            <div className="control-row">
              <select
                value={job.status || "Wishlist"}
                onChange={(event) => onStatusChange(job.id, event.target.value)}
                disabled={false}
              >
                {PIPELINE_ORDER.map((status) => (
                  <option key={`${job.id}-${status}`} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => onEditJob(job)} disabled={false}>
                Edit
              </button>
              <button
                type="button"
                disabled={Boolean(job.imported)}
                onClick={() => onMarkImported(job.id)}
              >
                {job.imported ? "Imported" : "Mark Imported"}
              </button>
              <button
                type="button"
                className="danger-btn"
                disabled={false}
                onClick={() => onDelete(job.id)}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </article>
    );
  }

  return (
    <section className="module-panel">
      <header className="module-header">
        <div>
          <h1>Job Tracker</h1>
          <p>Live jobs from backend when available, demo data otherwise.</p>
        </div>
        <div className="control-row">
          <button type="button" onClick={onLoadDashboard} disabled={loading}>
            Refresh
          </button>
          <button type="button" onClick={onSync} disabled={!connected || syncing}>
            {syncing ? "Syncing..." : "Sync Jobs"}
          </button>
        </div>
      </header>

      {successText && <div className="inline-note success">{successText}</div>}
      {errorText && <div className="inline-note error">{errorText}</div>}

      <form className="job-form" onSubmit={onSaveJob}>
        <input
          value={jobForm.company}
          onChange={(event) => onJobInput("company", event.target.value)}
          placeholder="Company *"
        />
        <input
          value={jobForm.role}
          onChange={(event) => onJobInput("role", event.target.value)}
          placeholder="Role *"
        />
        <select
          value={jobForm.status}
          onChange={(event) => onJobInput("status", event.target.value)}
        >
          {PIPELINE_ORDER.map((status) => (
            <option key={`job-form-${status}`} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={jobForm.appliedDate}
          onChange={(event) => onJobInput("appliedDate", event.target.value)}
          placeholder="Application date"
        />
        <input
          value={jobForm.location}
          onChange={(event) => onJobInput("location", event.target.value)}
          placeholder="Location"
        />
        <input
          className="job-notes"
          value={jobForm.notes}
          onChange={(event) => onJobInput("notes", event.target.value)}
          placeholder="Notes"
        />
        <button type="submit">{editingJobId ? "Update Job" : "Add Job"}</button>
        {editingJobId && (
          <button type="button" onClick={onCancelEditJob}>
            Cancel
          </button>
        )}
      </form>

      <div className="filters-row">
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search company, role, status"
        />
        <select value={jobSmartView} onChange={(event) => onSmartViewChange(event.target.value)}>
          <option value="All">Smart View: All</option>
          <option value="Needs Follow-up">Smart View: Needs Follow-up</option>
          <option value="Interview This Week">Smart View: Interview This Week</option>
        </select>
        <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
          <option value="All">All Statuses</option>
          {PIPELINE_ORDER.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="status-legend">
        {PIPELINE_ORDER.map((status) => (
          <span key={`legend-${status}`} className={`chip ${getStatusChipClass(status)}`}>
            {status}
          </span>
        ))}
      </div>

      <JobListView 
        jobs={jobTrackerColumns.map(col => col.jobs).flat()}
        resumes={resumes}
        onJobUpdate={onLoadDashboard}
        onDeleteJob={onDelete}
      />

      {filteredJobs.length === 0 && <p className="muted">No jobs match the current filters.</p>}
    </section>
  );
}
