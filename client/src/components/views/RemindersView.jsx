import { useState } from "react";

export default function RemindersView({
  sortedReminders,
  filteredReminders,
  reminderForm,
  successText,
  errorText,
  sendingReminderHooks,
  interviewCalendarEvents,
  onAddReminder,
  onReminderInput,
  onToggleReminder,
  onDeleteReminder,
  onExportAllCalendar,
  onSendReminderHooks,
}) {
  const [showCompleted, setShowCompleted] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const visibleReminders = filteredReminders.filter((reminder) => {
    const isCompleted = reminder.completed ?? reminder.is_done ?? false;
    return showCompleted ? true : !isCompleted;
  });

  const reminderEventsCount = sortedReminders.filter(
    (reminder) => Boolean(reminder.dueDate || reminder.due_date)
  ).length;
  const interviewEventsCount = interviewCalendarEvents.length;
  const completedCount = filteredReminders.filter(
    (r) => r.completed ?? r.is_done ?? false
  ).length;

  return (
    <section className="module-panel">
      <header className="module-header">
        <div>
          <h1>Reminders</h1>
          <p>Track follow-ups, deadlines, and preparation tasks.</p>
        </div>
        <div className="control-row">
          <span className="chip">{reminderEventsCount} reminder events</span>
          <span className="chip">{interviewEventsCount} interview events</span>
          <button type="button" onClick={onExportAllCalendar}>
            Export Calendar (.ics)
          </button>
          <button type="button" onClick={onSendReminderHooks} disabled={sendingReminderHooks}>
            {sendingReminderHooks ? "Sending..." : "Send Due Hooks"}
          </button>
        </div>
      </header>

      {successText && <div className="inline-note success">{successText}</div>}
      {errorText && <div className="inline-note error">{errorText}</div>}

      <form className="reminder-form" onSubmit={onAddReminder}>
        <input
          value={reminderForm.title}
          onChange={(event) => onReminderInput("title", event.target.value)}
          placeholder="Reminder title *"
        />
        <input
          type="date"
          value={reminderForm.dueDate}
          onChange={(event) => onReminderInput("dueDate", event.target.value)}
        />
        <select value={reminderForm.type} onChange={(event) => onReminderInput("type", event.target.value)}>
          <option value="Follow Up">Follow Up</option>
          <option value="Apply Deadline">Apply Deadline</option>
          <option value="Interview Prep">Interview Prep</option>
          <option value="Other">Other</option>
        </select>
        <button type="submit">Add Reminder</button>
      </form>

      <div className="filters-row">
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed ({completedCount})
        </label>
      </div>

      <div className="reminder-list">
        {visibleReminders.map((reminder) => {
          const dueDate = reminder.dueDate || reminder.due_date;
          const isCompleted = reminder.completed ?? reminder.is_done ?? false;
          const isOverdue = !isCompleted && dueDate && dueDate < today;

          return (
            <article
              key={reminder.id}
              className={`reminder-card ${isOverdue ? "overdue" : ""} ${isCompleted ? "reminder-done" : ""}`}
              style={isCompleted ? { opacity: 0.55 } : undefined}
            >
              <header>
                <h4 style={isCompleted ? { textDecoration: "line-through" } : undefined}>
                  {reminder.title}
                </h4>
                <span className="chip">{reminder.type || reminder.reminder_type || "Other"}</span>
              </header>
              <p>
                Due: {dueDate || "No date set"}
                {isOverdue && <span className="chip" style={{ marginLeft: "8px", background: "#e74c3c", color: "#fff" }}>Overdue</span>}
                {isCompleted && <span className="chip" style={{ marginLeft: "8px", background: "#27ae60", color: "#fff" }}>Done</span>}
              </p>
              <div className="control-row">
                <button type="button" onClick={() => onToggleReminder(reminder.id)}>
                  {isCompleted ? "Mark Pending" : "Mark Complete"}
                </button>
                <button type="button" className="danger-btn" onClick={() => onDeleteReminder(reminder.id)}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
        {visibleReminders.length === 0 && (
          <p className="muted">
            {showCompleted ? "No reminders yet." : "No pending reminders. All done!"}
          </p>
        )}
      </div>
    </section>
  );
}
