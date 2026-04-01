import { useState } from "react";
import { createContact, updateContact, deleteContact } from "../api/backend";

function normalizeContactForUI(contact) {
  const roleOrTitle = String(contact?.title || contact?.role || "").trim();
  const relationship = String(contact?.relationship || roleOrTitle || "Other").trim();
  return {
    ...contact,
    title: roleOrTitle,
    relationship,
    createdAt: contact?.createdAt || contact?.created_at || new Date().toISOString(),
  };
}

export { normalizeContactForUI };

export function useContactActions({ contacts, setContacts, setErrorText, setSuccessText, normalizedGlobalSearch }) {
  const [contactForm, setContactForm] = useState({
    name: "",
    company: "",
    title: "",
    email: "",
    relationship: "Recruiter",
    notes: "",
  });
  const [contactSearch, setContactSearch] = useState("");
  const [contactRelationship, setContactRelationship] = useState("All");
  const [editingContactId, setEditingContactId] = useState(null);
  const [editContactForm, setEditContactForm] = useState({});

  function handleContactInput(field, value) {
    setContactForm((current) => ({ ...current, [field]: value }));
  }

  function handleStartEditContact(contact) {
    setEditingContactId(contact.id);
    setEditContactForm({
      name: contact.name || "",
      company: contact.company || "",
      title: contact.title || "",
      email: contact.email || "",
      notes: contact.notes || "",
    });
  }

  function handleContactEditInput(field, value) {
    setEditContactForm((current) => ({ ...current, [field]: value }));
  }

  function handleCancelEditContact() {
    setEditingContactId(null);
    setEditContactForm({});
  }

  function handleSaveContact(event) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!editContactForm.name?.trim() || !editContactForm.company?.trim()) {
      setErrorText("Contact name and company are required.");
      return;
    }

    async function submit() {
      try {
        const patch = {
          name: editContactForm.name.trim(),
          company: editContactForm.company.trim(),
          title: editContactForm.title?.trim() || "",
          email: editContactForm.email?.trim() || "",
          notes: editContactForm.notes?.trim() || "",
        };
        const result = await updateContact(editingContactId, patch);
        if (result.success) {
          const updated = normalizeContactForUI(result.data);
          setContacts(contacts.map((c) => (c.id === editingContactId ? updated : c)));
          setEditingContactId(null);
          setEditContactForm({});
          setSuccessText("Contact updated successfully.");
        } else {
          setErrorText("Failed to update contact.");
        }
      } catch (error) {
        setErrorText(error.message || "Failed to update contact.");
      }
    }
    submit();
  }

  function handleAddContact(event) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!contactForm.name.trim() || !contactForm.company.trim()) {
      setErrorText("Contact name and company are required.");
      return;
    }

    async function submit() {
      try {
        const payload = {
          name: contactForm.name.trim(),
          company: contactForm.company.trim(),
          title: contactForm.title.trim(),
          email: contactForm.email.trim(),
          role: contactForm.title.trim(),
          linkedin_url: "",
          phone: "",
          source: "manual",
          notes: contactForm.notes.trim(),
        };
        const result = await createContact(payload);
        if (result.success) {
          const newContact = normalizeContactForUI(result.data);
          setContacts([newContact, ...contacts]);
          setContactForm({ name: "", company: "", title: "", email: "", relationship: "Recruiter", notes: "" });
          setSuccessText("Contact added successfully.");
        } else {
          setErrorText("Failed to add contact.");
        }
      } catch (error) {
        setErrorText(error.message || "Failed to add contact.");
      }
    }
    submit();
  }

  function handleDeleteContact(contactId) {
    setErrorText("");
    setSuccessText("");

    async function submit() {
      try {
        const result = await deleteContact(contactId);
        if (result.success) {
          setContacts(contacts.filter((contact) => contact.id !== contactId));
          setSuccessText("Contact deleted successfully.");
        } else {
          setErrorText("Failed to delete contact.");
        }
      } catch (error) {
        setErrorText(error.message || "Failed to delete contact.");
      }
    }
    submit();
  }

  const filteredContacts = contacts.filter((contact) => {
    const normalizedQuery = contactSearch.trim().toLowerCase();
    const queryMatch =
      !normalizedQuery ||
      `${contact.name || ""} ${contact.company || ""} ${contact.title || ""} ${contact.email || ""}`
        .toLowerCase()
        .includes(normalizedQuery);

    const globalMatch =
      !normalizedGlobalSearch ||
      `${contact.name || ""} ${contact.company || ""} ${contact.title || ""} ${contact.email || ""}`
        .toLowerCase()
        .includes(normalizedGlobalSearch);

    const relationshipMatch =
      contactRelationship === "All" || contact.relationship === contactRelationship;

    return queryMatch && relationshipMatch && globalMatch;
  });

  return {
    contactForm,
    contactSearch,
    contactRelationship,
    filteredContacts,
    editingContactId,
    editContactForm,
    setContactSearch,
    setContactRelationship,
    handleContactInput,
    handleAddContact,
    handleDeleteContact,
    handleStartEditContact,
    handleContactEditInput,
    handleSaveContact,
    handleCancelEditContact,
  };
}
