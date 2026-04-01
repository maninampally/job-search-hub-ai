function formatOutreachDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Strip the auto-generated structured prefix from notes (e.g. "Contact: X\nCompany: Y\nStatus: Z")
function extractUserNotes(entry) {
  const raw = String(entry?.message || entry?.notes || "");
  // If notes are purely the structured prefix, show nothing
  const cleaned = raw
    .split("\n")
    .filter((line) => !/^(Contact|Company|Status):\s*/i.test(line))
    .join("\n")
    .trim();
  return cleaned || null;
}

export default function OutreachView({
  outreachForm,
  outreachEntries,
  successText,
  errorText,
  onAddOutreach,
  onOutreachInput,
  onUpdateOutreachStatus,
  onDeleteOutreach,
}) {
  return (
    <section className="module-panel">
      <header className="module-header">
        <div>
          <h1>Outreach</h1>
          <p>Track all outreach attempts and response statuses.</p>
        </div>
      </header>

      {successText && <div className="inline-note success">{successText}</div>}
      {errorText && <div className="inline-note error">{errorText}</div>}

      <form className="outreach-form" onSubmit={onAddOutreach}>
        <input
          value={outreachForm.contact}
          onChange={(event) => onOutreachInput("contact", event.target.value)}
          placeholder="Contact name *"
        />
        <input
          value={outreachForm.company}
          onChange={(event) => onOutreachInput("company", event.target.value)}
          placeholder="Company *"
        />
        <select value={outreachForm.method} onChange={(event) => onOutreachInput("method", event.target.value)}>
          <option value="LinkedIn">LinkedIn</option>
          <option value="Email">Email</option>
          <option value="Phone">Phone</option>
          <option value="WhatsApp">WhatsApp</option>
        </select>
        <select value={outreachForm.status} onChange={(event) => onOutreachInput("status", event.target.value)}>
          <option value="Sent">Sent</option>
          <option value="Replied">Replied</option>
          <option value="No Response">No Response</option>
          <option value="Scheduled">Scheduled</option>
        </select>
        <input
          className="outreach-notes"
          value={outreachForm.notes}
          onChange={(event) => onOutreachInput("notes", event.target.value)}
          placeholder="Notes (optional)"
        />
        <button type="submit">Add Outreach</button>
      </form>

      <div className="outreach-list">
        {outreachEntries.map((entry) => {
          const contact = entry.contact || "Unknown Contact";
          const company = entry.company || "Unknown Company";
          const method = entry.method || entry.type || "LinkedIn";
          const status = entry.status || (entry.response_received ? "Replied" : "Sent");
          const userNotes = extractUserNotes(entry);
          const formattedDate = formatOutreachDate(entry.date || entry.sent_at || entry.created_at);

          return (
            <article key={entry.id} className="outreach-card">
              <header>
                <h4>{contact}</h4>
                <span className="chip">{method}</span>
              </header>
              <p>
                <strong>{company}</strong>
              </p>
              {formattedDate && <p className="muted">{formattedDate}</p>}
              {userNotes && <p className="muted">{userNotes}</p>}
              <div className="control-row">
                <select
                  value={status}
                  onChange={(event) => onUpdateOutreachStatus(entry.id, event.target.value)}
                >
                  <option value="Sent">Sent</option>
                  <option value="Replied">Replied</option>
                  <option value="No Response">No Response</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
                <button type="button" className="danger-btn" onClick={() => onDeleteOutreach(entry.id)}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
        {outreachEntries.length === 0 && <p className="muted">No outreach entries yet.</p>}
      </div>
    </section>
  );
}
