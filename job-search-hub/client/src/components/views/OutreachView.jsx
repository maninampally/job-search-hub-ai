import { useState } from 'react';
import styles from './OutreachView.module.css';

function formatOutreachDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function extractUserNotes(entry) {
  const raw = String(entry?.message || entry?.notes || '');
  const cleaned = raw
    .split('\n')
    .filter((line) => !/^(Contact|Company|Status):\s*/i.test(line))
    .join('\n')
    .trim();
  return cleaned || null;
}

const METHOD_STYLES = {
  LinkedIn: styles.methodLinkedIn,
  Email: styles.methodEmail,
  Phone: styles.methodPhone,
  WhatsApp: styles.methodWhatsApp,
};

const STATUS_STYLES = {
  Sent: styles.statusSent,
  Replied: styles.statusReplied,
  'No Response': styles.statusNoResponse,
  Scheduled: styles.statusScheduled,
};

export default function OutreachView({
  outreachForm,
  outreachEntries = [],
  successText,
  errorText,
  onAddOutreach,
  onOutreachInput,
  onUpdateOutreachStatus,
  onDeleteOutreach,
}) {
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Calculate stats
  const totalCount = outreachEntries.length;
  const repliedCount = outreachEntries.filter(e => e.status === 'Replied' || e.response_received).length;
  const pendingCount = outreachEntries.filter(e => e.status === 'Sent' || (!e.status && !e.response_received)).length;
  const noResponseCount = outreachEntries.filter(e => e.status === 'No Response').length;

  // Filter entries
  const filteredEntries = outreachEntries.filter((entry) => {
    const contact = entry.contact || '';
    const company = entry.company || '';
    const status = entry.status || (entry.response_received ? 'Replied' : 'Sent');
    
    const matchesSearch = searchQuery === '' || 
      contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddOutreach(e);
    setShowForm(false);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Outreach</h1>
          <p>Track all outreach attempts and responses</p>
        </div>
        <button 
          type="button" 
          className={styles.addButton}
          onClick={() => setShowForm(!showForm)}
        >
          <PlusIcon />
          New Outreach
        </button>
      </header>

      {/* Alerts */}
      {successText && <div className={`${styles.alert} ${styles.alertSuccess}`}>{successText}</div>}
      {errorText && <div className={`${styles.alert} ${styles.alertError}`}>{errorText}</div>}

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Outreach</div>
          <div className={`${styles.statValue} ${styles.statValueBlue}`}>{totalCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Replied</div>
          <div className={`${styles.statValue} ${styles.statValueGreen}`}>{repliedCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending</div>
          <div className={`${styles.statValue} ${styles.statValueYellow}`}>{pendingCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>No Response</div>
          <div className={`${styles.statValue} ${styles.statValueGray}`}>{noResponseCount}</div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className={styles.formCard}>
          <h3 className={styles.formTitle}>Add New Outreach</h3>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Contact Name *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={outreachForm.contact}
                  onChange={(e) => onOutreachInput('contact', e.target.value)}
                  placeholder="John Smith"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Company *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={outreachForm.company}
                  onChange={(e) => onOutreachInput('company', e.target.value)}
                  placeholder="Acme Inc"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Method</label>
                <select
                  className={styles.formSelect}
                  value={outreachForm.method}
                  onChange={(e) => onOutreachInput('method', e.target.value)}
                >
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Email">Email</option>
                  <option value="Phone">Phone</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Status</label>
                <select
                  className={styles.formSelect}
                  value={outreachForm.status}
                  onChange={(e) => onOutreachInput('status', e.target.value)}
                >
                  <option value="Sent">Sent</option>
                  <option value="Replied">Replied</option>
                  <option value="No Response">No Response</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
              </div>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.formLabel}>Notes</label>
                <textarea
                  className={styles.formTextarea}
                  value={outreachForm.notes}
                  onChange={(e) => onOutreachInput('notes', e.target.value)}
                  placeholder="Add any notes about this outreach..."
                />
              </div>
            </div>
            <div className={styles.formActions}>
              <button 
                type="button" 
                className={styles.cancelButton}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className={styles.submitButton}>
                Add Outreach
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search contacts or companies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Sent">Sent</option>
          <option value="Replied">Replied</option>
          <option value="No Response">No Response</option>
          <option value="Scheduled">Scheduled</option>
        </select>
      </div>

      {/* Outreach Grid */}
      {filteredEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <MailIcon />
          </div>
          <div className={styles.emptyTitle}>No outreach entries yet</div>
          <div className={styles.emptyText}>
            Start tracking your networking efforts by adding your first outreach
          </div>
          <button 
            type="button" 
            className={styles.addButton}
            onClick={() => setShowForm(true)}
          >
            <PlusIcon />
            Add Outreach
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredEntries.map((entry) => {
            const contact = entry.contact || 'Unknown Contact';
            const company = entry.company || 'Unknown Company';
            const method = entry.method || entry.type || 'LinkedIn';
            const status = entry.status || (entry.response_received ? 'Replied' : 'Sent');
            const userNotes = extractUserNotes(entry);
            const formattedDate = formatOutreachDate(entry.date || entry.sent_at || entry.created_at);

            return (
              <article key={entry.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h4 className={styles.contactName}>{contact}</h4>
                    <p className={styles.companyName}>{company}</p>
                  </div>
                  <span className={`${styles.methodBadge} ${METHOD_STYLES[method] || ''}`}>
                    {method}
                  </span>
                </div>

                <div className={styles.cardMeta}>
                  <span className={`${styles.statusDot} ${STATUS_STYLES[status] || ''}`} />
                  <span>{status}</span>
                  {formattedDate && (
                    <>
                      <span>-</span>
                      <span>{formattedDate}</span>
                    </>
                  )}
                </div>

                {userNotes && (
                  <div className={styles.cardNotes}>{userNotes}</div>
                )}

                <div className={styles.cardFooter}>
                  <select
                    className={styles.statusSelect}
                    value={status}
                    onChange={(e) => onUpdateOutreachStatus(entry.id, e.target.value)}
                  >
                    <option value="Sent">Sent</option>
                    <option value="Replied">Replied</option>
                    <option value="No Response">No Response</option>
                    <option value="Scheduled">Scheduled</option>
                  </select>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => onDeleteOutreach(entry.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
