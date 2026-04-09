import { useState } from 'react';
import styles from './RemindersView.module.css';

const TYPE_STYLES = {
  'Follow Up': styles.typeFollowUp,
  'Apply Deadline': styles.typeDeadline,
  'Interview Prep': styles.typeInterview,
  'Other': styles.typeOther,
};

export default function RemindersView({
  sortedReminders = [],
  filteredReminders = [],
  reminderForm,
  successText,
  errorText,
  sendingReminderHooks,
  interviewCalendarEvents = [],
  onAddReminder,
  onReminderInput,
  onToggleReminder,
  onDeleteReminder,
  onExportAllCalendar,
  onSendReminderHooks,
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');

  const today = new Date().toISOString().slice(0, 10);

  // Calculate stats
  const overdueCount = filteredReminders.filter((r) => {
    const dueDate = r.dueDate || r.due_date;
    const isCompleted = r.completed ?? r.is_done ?? false;
    return !isCompleted && dueDate && dueDate < today;
  }).length;

  const todayCount = filteredReminders.filter((r) => {
    const dueDate = r.dueDate || r.due_date;
    const isCompleted = r.completed ?? r.is_done ?? false;
    return !isCompleted && dueDate === today;
  }).length;

  const upcomingCount = filteredReminders.filter((r) => {
    const dueDate = r.dueDate || r.due_date;
    const isCompleted = r.completed ?? r.is_done ?? false;
    return !isCompleted && dueDate && dueDate > today;
  }).length;

  const completedCount = filteredReminders.filter((r) => r.completed ?? r.is_done ?? false).length;

  // Filter visible reminders
  const visibleReminders = filteredReminders.filter((reminder) => {
    const isCompleted = reminder.completed ?? reminder.is_done ?? false;
    const type = reminder.type || reminder.reminder_type || 'Other';
    
    const matchesCompleted = showCompleted ? true : !isCompleted;
    const matchesType = typeFilter === 'All' || type === typeFilter;
    
    return matchesCompleted && matchesType;
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Reminders</h1>
          <p>Track follow-ups, deadlines, and tasks</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.secondaryButton}`}
            onClick={onExportAllCalendar}
          >
            <CalendarIcon />
            Export .ics
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryButton}`}
            onClick={onSendReminderHooks}
            disabled={sendingReminderHooks}
          >
            {sendingReminderHooks ? 'Sending...' : 'Send Due Hooks'}
          </button>
        </div>
      </header>

      {/* Alerts */}
      {successText && <div className={`${styles.alert} ${styles.alertSuccess}`}>{successText}</div>}
      {errorText && <div className={`${styles.alert} ${styles.alertError}`}>{errorText}</div>}

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconRed}`}>
            <AlertIcon />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Overdue</div>
            <div className={styles.statValue}>{overdueCount}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconYellow}`}>
            <TodayIcon />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Due Today</div>
            <div className={styles.statValue}>{todayCount}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
            <ClockIcon />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Upcoming</div>
            <div className={styles.statValue}>{upcomingCount}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
            <CheckIcon />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Completed</div>
            <div className={styles.statValue}>{completedCount}</div>
          </div>
        </div>
      </div>

      {/* Add Form */}
      <div className={styles.formCard}>
        <h3 className={styles.formTitle}>Add Reminder</h3>
        <form className={styles.formGrid} onSubmit={onAddReminder}>
          <div className={styles.formGroup}>
            <input
              type="text"
              className={styles.formInput}
              value={reminderForm.title}
              onChange={(e) => onReminderInput('title', e.target.value)}
              placeholder="Reminder title *"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <input
              type="date"
              className={styles.formInput}
              value={reminderForm.dueDate}
              onChange={(e) => onReminderInput('dueDate', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <select
              className={styles.formSelect}
              value={reminderForm.type}
              onChange={(e) => onReminderInput('type', e.target.value)}
            >
              <option value="Follow Up">Follow Up</option>
              <option value="Apply Deadline">Apply Deadline</option>
              <option value="Interview Prep">Interview Prep</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <button type="submit" className={styles.formSubmit}>
            Add Reminder
          </button>
        </form>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="All">All Types</option>
          <option value="Follow Up">Follow Up</option>
          <option value="Apply Deadline">Apply Deadline</option>
          <option value="Interview Prep">Interview Prep</option>
          <option value="Other">Other</option>
        </select>
        <button
          type="button"
          className={`${styles.toggleFilter} ${showCompleted ? styles.active : ''}`}
          onClick={() => setShowCompleted(!showCompleted)}
        >
          <CheckIcon />
          Show completed ({completedCount})
        </button>
      </div>

      {/* Reminders List */}
      {visibleReminders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <CheckIcon />
          </div>
          <div className={styles.emptyTitle}>
            {showCompleted ? 'No reminders yet' : 'All caught up!'}
          </div>
          <div className={styles.emptyText}>
            {showCompleted
              ? 'Add your first reminder to get started'
              : 'No pending reminders. Great job!'}
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {visibleReminders.map((reminder) => {
            const dueDate = reminder.dueDate || reminder.due_date;
            const isCompleted = reminder.completed ?? reminder.is_done ?? false;
            const isOverdue = !isCompleted && dueDate && dueDate < today;
            const type = reminder.type || reminder.reminder_type || 'Other';

            return (
              <article
                key={reminder.id}
                className={`${styles.card} ${isOverdue ? styles.overdue : ''} ${isCompleted ? styles.completed : ''}`}
              >
                <div
                  className={`${styles.checkbox} ${isCompleted ? styles.checked : ''}`}
                  onClick={() => onToggleReminder(reminder.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onToggleReminder(reminder.id)}
                >
                  {isCompleted && <CheckIcon />}
                </div>

                <div className={styles.cardContent}>
                  <div className={styles.cardTitle}>{reminder.title}</div>
                  <div className={styles.cardMeta}>
                    {dueDate && (
                      <span className={`${styles.dueDate} ${isOverdue ? styles.overdue : ''}`}>
                        <CalendarIcon />
                        {formatDate(dueDate)}
                      </span>
                    )}
                    <span className={`${styles.typeBadge} ${TYPE_STYLES[type] || styles.typeOther}`}>
                      {type}
                    </span>
                    {isOverdue && <span className={styles.overdueBadge}>Overdue</span>}
                    {isCompleted && <span className={styles.completedBadge}>Done</span>}
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => onDeleteReminder(reminder.id)}
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

// Helper function
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Icons
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function TodayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
