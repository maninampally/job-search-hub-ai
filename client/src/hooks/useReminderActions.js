import { useState } from "react";
import { createReminder, updateReminder, deleteReminder, sendDueReminderHooks } from "../api/backend";

function padIcsNumber(value) {
  return String(value).padStart(2, "0");
}

function toIcsDate(dateValue) {
  const date = new Date(dateValue);
  return `${date.getUTCFullYear()}${padIcsNumber(date.getUTCMonth() + 1)}${padIcsNumber(date.getUTCDate())}`;
}

function toIcsDateTime(dateValue) {
  const date = new Date(dateValue);
  return `${date.getUTCFullYear()}${padIcsNumber(date.getUTCMonth() + 1)}${padIcsNumber(date.getUTCDate())}T${padIcsNumber(date.getUTCHours())}${padIcsNumber(date.getUTCMinutes())}${padIcsNumber(date.getUTCSeconds())}Z`;
}

function escapeIcsText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function downloadCalendar(events, filename, setErrorText, setSuccessText) {
  if (!events.length) {
    setErrorText("No calendar events found to export.");
    return;
  }

  const nowStamp = toIcsDateTime(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Job Search Hub//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(event.uid)}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.allDayDate) {
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(event.allDayDate)}`);
    } else {
      lines.push(`DTSTART:${toIcsDateTime(event.startDateTime)}`);
      lines.push(`DTEND:${toIcsDateTime(event.endDateTime)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setSuccessText("Calendar export downloaded.");
  setErrorText("");
}

export function useReminderActions({
  reminders,
  setReminders,
  setErrorText,
  setSuccessText,
  normalizedGlobalSearch,
  interviewCalendarEvents,
}) {
  const [reminderForm, setReminderForm] = useState({
    title: "",
    dueDate: "",
    type: "Follow Up",
  });
  const [sendingReminderHooks, setSendingReminderHooks] = useState(false);

  function handleReminderInput(field, value) {
    setReminderForm((current) => ({ ...current, [field]: value }));
  }

  function handleAddReminder(event) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!reminderForm.title.trim() || !reminderForm.dueDate) {
      setErrorText("Reminder title and due date are required.");
      return;
    }

    async function submit() {
      try {
        const payload = {
          title: reminderForm.title.trim(),
          due_date: reminderForm.dueDate,
          type: reminderForm.type,
          is_done: false,
          notes: "",
          job_id: null,
        };
        const result = await createReminder(payload);
        if (result.success) {
          setReminders([result.data, ...reminders]);
          setReminderForm({ title: "", dueDate: "", type: "Follow Up" });
          setSuccessText("Reminder added successfully.");
        } else {
          setErrorText("Failed to add reminder.");
        }
      } catch (error) {
        setErrorText(error.message || "Failed to add reminder.");
      }
    }
    submit();
  }

  function handleToggleReminder(reminderId) {
    const reminder = reminders.find((r) => r.id === reminderId);
    if (!reminder) return;

    async function submit() {
      try {
        const result = await updateReminder(reminderId, { is_done: !reminder.is_done });
        if (result.success) {
          setReminders(reminders.map((r) => (r.id === reminderId ? { ...r, is_done: !r.is_done } : r)));
        } else {
          setErrorText("Failed to update reminder.");
        }
      } catch (error) {
        setErrorText(error.message || "Failed to update reminder.");
      }
    }
    submit();
  }

  function handleDeleteReminder(reminderId) {
    setErrorText("");
    setSuccessText("");

    async function submit() {
      try {
        const result = await deleteReminder(reminderId);
        if (result.success) {
          setReminders(reminders.filter((reminder) => reminder.id !== reminderId));
          setSuccessText("Reminder deleted successfully.");
        } else {
          setErrorText("Failed to delete reminder.");
        }
      } catch (error) {
        setErrorText(error.message || "Failed to delete reminder.");
      }
    }
    submit();
  }

  async function handleSendReminderHooks() {
    setSendingReminderHooks(true);
    setErrorText("");
    setSuccessText("");

    try {
      const payloadReminders = reminders.map((reminder) => ({
        ...reminder,
        dueDate: reminder.dueDate || reminder.due_date || "",
        completed: reminder.completed ?? reminder.is_done ?? false,
        type: reminder.type || reminder.reminder_type || "Other",
      }));
      const result = await sendDueReminderHooks(payloadReminders);
      setSuccessText(`Reminder hooks triggered for ${result.count || 0} due reminder(s).`);
    } catch (error) {
      setErrorText(error.message || "Unable to send reminder hooks.");
    } finally {
      setSendingReminderHooks(false);
    }
  }

  function handleExportAllCalendar() {
    const sortedRems = [...reminders]
      .map((r) => ({ ...r, _dueDate: r.dueDate || r.due_date || "" }))
      .sort((a, b) => a._dueDate.localeCompare(b._dueDate));

    const reminderEvents = sortedRems
      .filter((reminder) => reminder.dueDate || reminder.due_date)
      .map((reminder) => ({
        uid: `${reminder.id || `reminder_${Math.random().toString(36).slice(2, 6)}`}@job-search-hub`,
        title: reminder.title || "Job Search Reminder",
        description: `Type: ${reminder.type || reminder.reminder_type || "Other"}`,
        allDayDate: reminder.dueDate || reminder.due_date,
      }));

    const interviewEvents = (interviewCalendarEvents || []).map((event) => {
      const start = event.date;
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return {
        uid: `${event.id}@job-search-hub`,
        title: event.title,
        description: event.description,
        startDateTime: start,
        endDateTime: end,
      };
    });

    downloadCalendar(
      [...reminderEvents, ...interviewEvents],
      "job-search-calendar.ics",
      setErrorText,
      setSuccessText
    );
  }

  const sortedReminders = [...reminders]
    .map((r) => ({ ...r, _dueDate: r.dueDate || r.due_date || "" }))
    .sort((a, b) => a._dueDate.localeCompare(b._dueDate));

  const filteredReminders = sortedReminders.filter((reminder) => {
    const dueDate = reminder.dueDate || reminder.due_date || "";
    if (!normalizedGlobalSearch) return true;
    return `${reminder.title || ""} ${reminder.type || reminder.reminder_type || ""} ${dueDate}`
      .toLowerCase()
      .includes(normalizedGlobalSearch);
  });

  return {
    reminderForm,
    sendingReminderHooks,
    sortedReminders,
    filteredReminders,
    handleReminderInput,
    handleAddReminder,
    handleToggleReminder,
    handleDeleteReminder,
    handleSendReminderHooks,
    handleExportAllCalendar,
  };
}
