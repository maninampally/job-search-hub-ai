const CONTACT_RELATIONSHIPS = ["Recruiter", "Hiring Manager", "Employee", "Other"];

export default function ContactsView({
  contacts,
  filteredContacts,
  contactForm,
  contactSearch,
  contactRelationship,
  editingContactId,
  editContactForm,
  successText,
  errorText,
  onAddContact,
  onContactInput,
  onSearchChange,
  onRelationshipFilterChange,
  onDeleteContact,
  onStartEditContact,
  onContactEditInput,
  onSaveContact,
  onCancelEditContact,
}) {
  return (
    <section className="module-panel">
      <header className="module-header">
        <div>
          <h1>Contacts</h1>
          <p>Manage recruiters and networking contacts with search and relationship filters.</p>
        </div>
      </header>

      {successText && <div className="inline-note success">{successText}</div>}
      {errorText && <div className="inline-note error">{errorText}</div>}

      <form className="contact-form" onSubmit={onAddContact}>
        <input
          value={contactForm.name}
          onChange={(event) => onContactInput("name", event.target.value)}
          placeholder="Name *"
        />
        <input
          value={contactForm.company}
          onChange={(event) => onContactInput("company", event.target.value)}
          placeholder="Company *"
        />
        <input
          value={contactForm.title}
          onChange={(event) => onContactInput("title", event.target.value)}
          placeholder="Title"
        />
        <input
          value={contactForm.email}
          onChange={(event) => onContactInput("email", event.target.value)}
          placeholder="Email"
        />
        <select
          value={contactForm.relationship}
          onChange={(event) => onContactInput("relationship", event.target.value)}
        >
          {CONTACT_RELATIONSHIPS.map((relationship) => (
            <option key={relationship} value={relationship}>
              {relationship}
            </option>
          ))}
        </select>
        <input
          className="contact-notes"
          value={contactForm.notes}
          onChange={(event) => onContactInput("notes", event.target.value)}
          placeholder="Notes"
        />
        <button type="submit">Add Contact</button>
      </form>

      <div className="filters-row">
        <input
          value={contactSearch}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search name, company, title, email"
        />
        <select
          value={contactRelationship}
          onChange={(event) => onRelationshipFilterChange(event.target.value)}
        >
          <option value="All">All Relationships</option>
          {CONTACT_RELATIONSHIPS.map((relationship) => (
            <option key={`filter-${relationship}`} value={relationship}>
              {relationship}
            </option>
          ))}
        </select>
      </div>

      <div className="contacts-grid">
        {filteredContacts.map((contact) => {
          const isEditing = editingContactId === contact.id;
          return (
            <article key={contact.id} className="contact-card">
              {isEditing ? (
                <form onSubmit={onSaveContact}>
                  <input
                    value={editContactForm.name || ""}
                    onChange={(e) => onContactEditInput("name", e.target.value)}
                    placeholder="Name *"
                  />
                  <input
                    value={editContactForm.company || ""}
                    onChange={(e) => onContactEditInput("company", e.target.value)}
                    placeholder="Company *"
                  />
                  <input
                    value={editContactForm.title || ""}
                    onChange={(e) => onContactEditInput("title", e.target.value)}
                    placeholder="Title"
                  />
                  <input
                    value={editContactForm.email || ""}
                    onChange={(e) => onContactEditInput("email", e.target.value)}
                    placeholder="Email"
                  />
                  <input
                    value={editContactForm.notes || ""}
                    onChange={(e) => onContactEditInput("notes", e.target.value)}
                    placeholder="Notes"
                  />
                  <div className="control-row">
                    <button type="submit">Save</button>
                    <button type="button" onClick={onCancelEditContact}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <header>
                    <h4>{contact.name}</h4>
                    <span className="chip">{contact.relationship || "Other"}</span>
                  </header>
                  <p>
                    <strong>{contact.company}</strong>
                  </p>
                  {contact.title && <p>{contact.title}</p>}
                  {contact.email && <p>{contact.email}</p>}
                  {contact.notes && <p className="muted">{contact.notes}</p>}
                  <div className="control-row">
                    <button type="button" onClick={() => onStartEditContact(contact)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => onDeleteContact(contact.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
        {filteredContacts.length === 0 && <p className="muted">No contacts found.</p>}
      </div>
    </section>
  );
}
