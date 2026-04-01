import { useState } from "react";
import { createOutreach, updateOutreach, deleteOutreach } from "../api/backend";

function normalizeOutreachForUI(entry) {
  const notesText = String(entry?.notes || "");
  const contactMatch = notesText.match(/Contact:\s*(.*)/i);
  const companyMatch = notesText.match(/Company:\s*(.*)/i);
  const statusMatch = notesText.match(/Status:\s*(.*)/i);
  const contact = String(entry?.contact || contactMatch?.[1] || "").trim();
  const company = String(entry?.company || companyMatch?.[1] || "").trim();
  const method = String(entry?.method || entry?.type || "LinkedIn").trim();
  const status = String(
    entry?.status || statusMatch?.[1] || (entry?.response_received ? "Replied" : "Sent")
  ).trim();

  return {
    ...entry,
    contact,
    company,
    method,
    status,
    date: entry?.date || entry?.sent_at || entry?.created_at || new Date().toISOString(),
  };
}

export { normalizeOutreachForUI };

export function useOutreachActions({ outreachEntries, setOutreachEntries, setErrorText, setSuccessText }) {
  const [outreachForm, setOutreachForm] = useState({
    contact: "",
    company: "",
    method: "LinkedIn",
    status: "Sent",
    notes: "",
  });

  function handleOutreachInput(field, value) {
    setOutreachForm((current) => ({ ...current, [field]: value }));
  }

  function handleAddOutreach(event) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!outreachForm.contact.trim() || !outreachForm.company.trim()) {
      setErrorText("Outreach contact and company are required.");
      return;
    }

    async function submit() {
      try {
        const payload = {
          contact_id: null,
          job_id: null,
          type: outreachForm.method,
          message: outreachForm.notes.trim(),
          sent_at: new Date().toISOString(),
          response_received: false,
          notes: `Contact: ${outreachForm.contact.trim()}\nCompany: ${outreachForm.company.trim()}\nStatus: ${outreachForm.status}`,
        };
        const result = await createOutreach(payload);
        if (result.success) {
          const newOutreach = normalizeOutreachForUI(result.data);
          setOutreachEntries([newOutreach, ...outreachEntries]);
          setOutreachForm({ contact: "", company: "", method: "LinkedIn", status: "Sent", notes: "" });
          setSuccessText("Outreach log added successfully.");
        } else {
          setErrorText("Failed to add outreach log.");
        }
      } catch (error) {
        setErrorText(error.message || "Failed to add outreach log.");
      }
    }
    submit();
  }

  function handleUpdateOutreachStatus(entryId, status) {
    const entry = outreachEntries.find((e) => e.id === entryId);
    if (!entry) return;

    async function submit() {
      try {
        const newNotes = `${entry.notes || ""}\n[Status updated to: ${status}]`;
        const payload = {
          notes: newNotes,
          response_received: status === "Replied" || status === "Scheduled",
        };
        const result = await updateOutreach(entryId, payload);
        if (result.success) {
          setOutreachEntries(
            outreachEntries.map((e) =>
              e.id === entryId ? normalizeOutreachForUI({ ...e, ...result.data }) : e
            )
          );
          setSuccessText("Outreach status updated.");
        } else {
          setErrorText("Failed to update outreach status.");
        }
      } catch (error) {
        setErrorText(error.message || "Failed to update outreach status.");
      }
    }
    submit();
  }

  function handleDeleteOutreach(entryId) {
    setErrorText("");
    setSuccessText("");

    async function submit() {
      try {
        const result = await deleteOutreach(entryId);
        if (result.success) {
          setOutreachEntries(outreachEntries.filter((entry) => entry.id !== entryId));
          setSuccessText("Outreach entry deleted successfully.");
        } else {
          setErrorText("Failed to delete outreach entry.");
        }
      } catch (error) {
        setErrorText(error.message || "Failed to delete outreach entry.");
      }
    }
    submit();
  }

  return {
    outreachForm,
    handleOutreachInput,
    handleAddOutreach,
    handleUpdateOutreachStatus,
    handleDeleteOutreach,
  };
}
