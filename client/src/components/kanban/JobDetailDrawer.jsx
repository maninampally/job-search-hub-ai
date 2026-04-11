import { useState, useEffect } from 'react';
import { getJobTimeline } from '../../api/backend';
import styles from './JobDetailDrawer.module.css';

const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'emails', label: 'Emails' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'actions', label: 'Actions' },
];

/**
 * JobDetailDrawer - Slide-in panel showing job details
 */
export function JobDetailDrawer({
  job,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onAttachResume,
  resumes = [],
}) {
  const [activeTab, setActiveTab] = useState('summary');

  // Reset tab when job changes
  useEffect(() => {
    if (job) {
      setActiveTab('summary');
    }
  }, [job?.id]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!job) return null;

  const emails = job.emails || [];
  const statusClass = `status${job.status?.replace(/\s/g, '') || 'Wishlist'}`;

  return (
    <>
      {/* Overlay */}
      <div 
        className={`${styles.overlay} ${isOpen ? styles.open : ''}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`${styles.drawer} ${isOpen ? styles.open : ''}`}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.role}>{job.role || job.title || 'Untitled'}</h2>
            <p className={styles.company}>{job.company || 'Unknown Company'}</p>
            <div className={styles.metaRow}>
              <span className={`${styles.statusBadge} ${styles[statusClass]}`}>
                {job.status || 'Wishlist'}
              </span>
              {job.location && (
                <span className={styles.metaItem}>
                  <LocationIcon />
                  {job.location}
                </span>
              )}
              {job.applied_date && (
                <span className={styles.metaItem}>
                  <CalendarIcon />
                  {formatDate(job.applied_date)}
                </span>
              )}
            </div>
          </div>
          <button 
            type="button" 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close drawer"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === 'emails' && emails.length > 0 && ` (${emails.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={styles.content}>
          {activeTab === 'summary' && (
            <SummaryTab 
              job={job} 
              resumes={resumes}
              onAttachResume={onAttachResume}
            />
          )}
          {activeTab === 'emails' && (
            <EmailsTab emails={emails} />
          )}
          {activeTab === 'timeline' && (
            <UnifiedTimelineTab jobId={job.id} />
          )}
          {activeTab === 'actions' && (
            <ActionsTab 
              job={job}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Summary Tab
 */
function SummaryTab({ job, resumes, onAttachResume }) {
  return (
    <div>
      <section className={styles.summarySection}>
        <h3 className={styles.sectionTitle}>Details</h3>
        <div className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <div className={styles.detailLabel}>Company</div>
            <div className={styles.detailValue}>{job.company || '-'}</div>
          </div>
          <div className={styles.detailItem}>
            <div className={styles.detailLabel}>Role</div>
            <div className={styles.detailValue}>{job.role || job.title || '-'}</div>
          </div>
          <div className={styles.detailItem}>
            <div className={styles.detailLabel}>Location</div>
            <div className={styles.detailValue}>{job.location || '-'}</div>
          </div>
          <div className={styles.detailItem}>
            <div className={styles.detailLabel}>Applied Date</div>
            <div className={styles.detailValue}>
              {job.applied_date ? formatDate(job.applied_date) : '-'}
            </div>
          </div>
          <div className={styles.detailItem}>
            <div className={styles.detailLabel}>Recruiter</div>
            <div className={styles.detailValue}>{job.contact || job.recruiterName || '-'}</div>
          </div>
          <div className={styles.detailItem}>
            <div className={styles.detailLabel}>Salary Range</div>
            <div className={styles.detailValue}>{job.salary || '-'}</div>
          </div>
        </div>
      </section>

      {job.notes && (
        <section className={styles.summarySection}>
          <h3 className={styles.sectionTitle}>Notes</h3>
          <div className={styles.notes}>{job.notes}</div>
        </section>
      )}

      {resumes.length > 0 && (
        <section className={styles.summarySection}>
          <h3 className={styles.sectionTitle}>Attached Resume</h3>
          <select
            value={job.attachedResumeId || ''}
            onChange={(e) => onAttachResume?.(job.id, e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              background: '#ffffff',
            }}
          >
            <option value="">-- No resume attached --</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.name}
              </option>
            ))}
          </select>
        </section>
      )}
    </div>
  );
}

/**
 * Emails Tab
 */
function EmailsTab({ emails }) {
  if (emails.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <MailIcon />
        </div>
        <div className={styles.emptyTitle}>No emails yet</div>
        <div className={styles.emptyText}>
          Emails will appear here once synced from Gmail
        </div>
      </div>
    );
  }

  return (
    <div className={styles.emailList}>
      {emails.map((email, index) => (
        <div 
          key={email.id || index} 
          className={`${styles.emailCard} ${!email.isRead ? styles.unread : ''}`}
        >
          <div className={styles.emailHeader}>
            <span className={styles.emailFrom}>{email.fromName || email.from || 'Unknown'}</span>
            <span className={styles.emailDate}>{formatDate(email.date)}</span>
          </div>
          <div className={styles.emailSubject}>{email.subject || 'No subject'}</div>
          <div className={styles.emailPreview}>
            {email.preview || email.body?.substring(0, 100) || 'No preview available'}
          </div>
          <span className={`${styles.emailTypeBadge} ${email.isReal ? styles.emailTypeReal : styles.emailTypeAuto}`}>
            {email.isReal ? 'Real' : 'Auto'}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Unified Timeline Tab - fetches status changes + emails from backend
 */
function UnifiedTimelineTab({ jobId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    setLoading(true);
    getJobTimeline(jobId)
      .then((res) => {
        if (!cancelled) setTimeline(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [jobId]);

  if (loading) {
    return <div className={styles.emptyState}><div className={styles.emptyText}>Loading timeline...</div></div>;
  }

  if (timeline.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}><ClockIcon /></div>
        <div className={styles.emptyTitle}>No activity yet</div>
        <div className={styles.emptyText}>Timeline events will appear as your application progresses</div>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      {timeline.map((event, index) => (
        <div
          key={index}
          className={`${styles.timelineItem} ${index === timeline.length - 1 ? styles.current : ''}`}
        >
          <div className={styles.timelineDot} style={event.type === 'email' ? { background: '#6366f1' } : { background: '#10b981' }} />
          <div className={styles.timelineDate}>{formatDateTime(event.date)}</div>
          <div className={styles.timelineContent}>
            {event.type === 'email' ? (
              <>
                <strong style={{ fontSize: '11px', color: '#6366f1', textTransform: 'uppercase' }}>Email</strong>
                <span style={{ marginLeft: 6 }}>{event.title}</span>
                {event.from && <div style={{ fontSize: '12px', color: '#6b7280' }}>From: {event.from}</div>}
              </>
            ) : (
              <>
                <strong style={{ fontSize: '11px', color: '#10b981', textTransform: 'uppercase' }}>Status</strong>
                <span style={{ marginLeft: 6 }}>{event.title}</span>
                {event.detail && <div style={{ fontSize: '12px', color: '#6b7280' }}>{event.detail}</div>}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Actions Tab
 */
function ActionsTab({ job, onEdit, onDelete, onStatusChange }) {
  const statuses = ['Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected'];

  return (
    <div className={styles.actionsList}>
      <button 
        type="button" 
        className={`${styles.actionButton} ${styles.primary}`}
        onClick={() => onEdit?.(job)}
      >
        <span className={styles.actionIcon}><EditIcon /></span>
        Edit Job Details
      </button>

      <div style={{ marginTop: '8px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
          Change Status
        </label>
        <select
          value={job.status || 'Wishlist'}
          onChange={(e) => onStatusChange?.(job.id, e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            background: '#ffffff',
          }}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <button 
        type="button" 
        className={styles.actionButton}
        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(job.company + ' ' + job.role + ' interview questions')}`, '_blank')}
      >
        <span className={styles.actionIcon}><SearchIcon /></span>
        Research Interview Questions
      </button>

      <button 
        type="button" 
        className={styles.actionButton}
        onClick={() => window.open(`https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(job.company)}`, '_blank')}
      >
        <span className={styles.actionIcon}><GlassIcon /></span>
        View on Glassdoor
      </button>

      <button 
        type="button" 
        className={`${styles.actionButton} ${styles.danger}`}
        onClick={() => {
          if (window.confirm('Are you sure you want to delete this job?')) {
            onDelete?.(job.id);
          }
        }}
      >
        <span className={styles.actionIcon}><TrashIcon /></span>
        Delete Job
      </button>
    </div>
  );
}

// Helper functions
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Icons
function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function GlassIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default JobDetailDrawer;
