import { useState } from "react";
import { createJob, updateJob, deleteJob, markJobImported, createReminder } from "../api/backend";
import { getEmailIdentity } from "../utils/emailUtils";

const PIPELINE_ORDER = ["Wishlist", "Applied", "Screening", "Interview", "Offer", "Rejected"];

const STATUS_CHIP_CLASS = {
  Wishlist: "status-wishlist",
  Applied: "status-applied",
  Screening: "status-screening",
  Interview: "status-interview",
  Offer: "status-offer",
  Rejected: "status-rejected",
};

const EMAIL_TYPE_CLASS = {
  "Application Confirmation": "email-type-application",
  "Recruiter Outreach": "email-type-recruiter",
  "Interview Scheduled": "email-type-interview",
  Rejection: "email-type-rejection",
  Offer: "email-type-offer",
  "Auto / Tracking": "email-type-auto",
};

function getFollowUpTitle(job) {
  const company = String(job?.company || "").trim() || "Unknown Company";
  const role = String(job?.role || "").trim() || "Unknown Role";
  return `Follow up: ${company} — ${role}`;
}

function hasActiveFollowUpReminder(job, remindersList) {
  const expectedTitle = getFollowUpTitle(job).toLowerCase();
  return remindersList.some(
    (reminder) =>
      !(reminder.completed ?? reminder.is_done) &&
      (reminder.type || reminder.reminder_type) === "Follow Up" &&
      String(reminder.title || "").toLowerCase() === expectedTitle
  );
}

export function useJobActions({
  jobs,
  setJobs,
  resumes,
  reminders,
  setReminders,
  setErrorText,
  setSuccessText,
  userScopedEmailReadKey,
  userScopedInterviewKey,
  searchQuery,
  statusFilter,
  jobSmartView,
  normalizedGlobalSearch,
}) {
  const [jobForm, setJobForm] = useState({
    company: "",
    role: "",
    status: "Applied",
    appliedDate: "",
    location: "",
    notes: "",
  });
  const [editingJobId, setEditingJobId] = useState(null);
  const [draggedJobId, setDraggedJobId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState("");
  const [expandedJobs, setExpandedJobs] = useState({});
  const [activeEmailModal, setActiveEmailModal] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState({});
  const [emailReadMap, setEmailReadMap] = useState({});
  const [interviewAnswers, setInterviewAnswers] = useState({});
  const [atsResume, setAtsResume] = useState("");
  const [atsJobDescription, setAtsJobDescription] = useState("");
  const [atsResult, setAtsResult] = useState(null);

  function saveEmailReadMap(nextReadMap) {
    setEmailReadMap(nextReadMap);
    window.localStorage.setItem(userScopedEmailReadKey, JSON.stringify(nextReadMap));
  }

  function saveInterviewAnswers(nextAnswers) {
    setInterviewAnswers(nextAnswers);
    window.localStorage.setItem(userScopedInterviewKey, JSON.stringify(nextAnswers));
  }

  function loadPersistedState() {
    try {
      const savedReadState = window.localStorage.getItem(userScopedEmailReadKey);
      if (savedReadState) {
        const parsed = JSON.parse(savedReadState);
        if (parsed && typeof parsed === "object") setEmailReadMap(parsed);
      }
    } catch {
      setEmailReadMap({});
    }

    try {
      const savedAnswers = window.localStorage.getItem(userScopedInterviewKey);
      if (savedAnswers) {
        const parsed = JSON.parse(savedAnswers);
        if (parsed && typeof parsed === "object") setInterviewAnswers(parsed);
      }
    } catch {
      setInterviewAnswers({});
    }
  }

  function resetJobState() {
    setJobs([]);
    setEmailReadMap({});
    setInterviewAnswers({});
  }

  function markEmailAsRead(jobId, email) {
    const identity = getEmailIdentity(email);
    if (!identity) return;

    const nextReadMap = { ...emailReadMap, [identity]: true };
    saveEmailReadMap(nextReadMap);

    setJobs((currentJobs) =>
      currentJobs.map((job) => {
        if (job.id !== jobId) return job;
        return {
          ...job,
          emails: (job.emails || []).map((item) => {
            if ((getEmailIdentity(item) || item.id) !== identity) return item;
            return { ...item, isRead: true };
          }),
        };
      })
    );
  }

  function toggleJobExpanded(jobId) {
    setExpandedJobs((current) => ({ ...current, [jobId]: !current[jobId] }));
  }

  function setJobDetailTab(jobId, tabName) {
    setActiveDetailTab((current) => ({ ...current, [jobId]: tabName }));
  }

  function formatEmailDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleString();
  }

  function getEmailTypeClass(type) {
    return EMAIL_TYPE_CLASS[type] || "email-type-auto";
  }

  function getStatusChipClass(status) {
    return STATUS_CHIP_CLASS[status] || "status-wishlist";
  }

  function handleEmailCardDoubleClick(jobId, email) {
    markEmailAsRead(jobId, email);
    setActiveEmailModal({ jobId, email });
  }

  function closeEmailModal() {
    setActiveEmailModal(null);
  }

  function handleJobInput(field, value) {
    setJobForm((current) => ({ ...current, [field]: value }));
  }

  function handleAnswerChange(questionId, value) {
    const nextAnswers = { ...interviewAnswers, [questionId]: value };
    saveInterviewAnswers(nextAnswers);
  }

  function buildFollowUpDueDate(daysAhead = 7) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysAhead);
    return dueDate.toISOString().slice(0, 10);
  }

  async function addAutoFollowUpReminder(job) {
    if (!job || !job.company || !job.role) return false;
    if (hasActiveFollowUpReminder(job, reminders)) return false;

    try {
      const payload = {
        title: getFollowUpTitle(job),
        due_date: buildFollowUpDueDate(7),
        type: "Follow Up",
        is_done: false,
        notes: `Auto-created for ${job.company} - ${job.role}`,
        job_id: job.id || null,
      };
      const result = await createReminder(payload);
      if (!result?.success || !result?.data) return false;
      setReminders((current) => [result.data, ...current]);
      return true;
    } catch {
      return false;
    }
  }

  async function handleDelete(jobId) {
    setErrorText("");
    setSuccessText("");
    try {
      await deleteJob(jobId);
      setJobs((currentJobs) => currentJobs.filter((job) => job.id !== jobId));
      setSuccessText("Job deleted.");
    } catch (error) {
      setErrorText(error.message || "Delete failed.");
    }
  }

  async function handleMarkImported(jobId) {
    setErrorText("");
    setSuccessText("");
    try {
      await markJobImported(jobId);
      setJobs((currentJobs) =>
        currentJobs.map((job) => (job.id === jobId ? { ...job, imported: true } : job))
      );
      setSuccessText("Job marked as imported.");
    } catch (error) {
      setErrorText(error.message || "Update failed.");
    }
  }

  async function handleStatusChange(jobId, status) {
    setErrorText("");
    setSuccessText("");
    try {
      await updateJob(jobId, { status });
      setJobs((currentJobs) => currentJobs.map((job) => (job.id === jobId ? { ...job, status } : job)));
      setSuccessText("Job status updated.");
    } catch (error) {
      setErrorText(error.message || "Unable to update status.");
    }
  }

  async function handleAttachResume(jobId, resumeId) {
    setErrorText("");
    setSuccessText("");
    try {
      await updateJob(jobId, { attachedResumeId: resumeId || null });
      setJobs((currentJobs) =>
        currentJobs.map((job) => (job.id === jobId ? { ...job, attachedResumeId: resumeId || null } : job))
      );
      const resumeName = resumeId ? resumes.find((r) => r.id === resumeId)?.name : "None";
      setSuccessText(`Resume attached: ${resumeName}`);
    } catch (error) {
      setErrorText(error.message || "Unable to attach resume.");
    }
  }

  async function handleSaveJob(event) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!jobForm.company.trim() || !jobForm.role.trim()) {
      setErrorText("Job company and role are required.");
      return;
    }

    const payload = {
      company: jobForm.company.trim(),
      role: jobForm.role.trim(),
      status: jobForm.status,
      appliedDate: jobForm.appliedDate || null,
      location: jobForm.location.trim(),
      notes: jobForm.notes.trim(),
    };

    try {
      if (editingJobId) {
        await updateJob(editingJobId, payload);
        setJobs((currentJobs) =>
          currentJobs.map((job) => (job.id === editingJobId ? { ...job, ...payload } : job))
        );
        setSuccessText("Job updated.");
      } else {
        const response = await createJob(payload);
        const createdJob = response.job;
        setJobs((currentJobs) => [createdJob, ...currentJobs]);
        const reminderAdded = await addAutoFollowUpReminder(createdJob);
        setSuccessText(reminderAdded ? "Job created. Follow-up reminder added." : "Job created.");
      }

      setJobForm({ company: "", role: "", status: "Applied", appliedDate: "", location: "", notes: "" });
      setEditingJobId(null);
    } catch (error) {
      setErrorText(error.message || "Unable to save job.");
    }
  }

  function handleEditJob(job) {
    setEditingJobId(job.id);
    setJobForm({
      company: job.company || "",
      role: job.role || "",
      status: job.status || "Applied",
      appliedDate: (job.appliedDate || job.applied || "").toString().slice(0, 10),
      location: job.location || "",
      notes: job.notes || "",
    });
  }

  function handleCancelEditJob() {
    setEditingJobId(null);
    setJobForm({ company: "", role: "", status: "Applied", appliedDate: "", location: "", notes: "" });
  }

  function handleJobDragStart(jobId) {
    setDraggedJobId(jobId);
  }

  function handleJobDragEnd() {
    setDraggedJobId(null);
    setDragOverStatus("");
  }

  function handleKanbanDragOver(event, status) {
    event.preventDefault();
    if (dragOverStatus !== status) setDragOverStatus(status);
  }

  async function handleKanbanDrop(event, status) {
    event.preventDefault();
    const droppedJobId = draggedJobId;
    setDragOverStatus("");
    if (!droppedJobId) return;

    const droppedJob = jobs.find((job) => job.id === droppedJobId);
    const currentStatus = droppedJob?.status || "Wishlist";
    if (currentStatus === status) {
      setDraggedJobId(null);
      return;
    }

    await handleStatusChange(droppedJobId, status);
    setDraggedJobId(null);
  }

  function runAtsCheck() {
    const resumeWords = new Set(
      atsResume
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((word) => word.length > 2)
    );

    const jdWords = Array.from(
      new Set(
        atsJobDescription
          .toLowerCase()
          .split(/[^a-z0-9+#.]+/)
          .filter((word) => word.length > 2)
      )
    );

    if (jdWords.length === 0) {
      setAtsResult(null);
      setErrorText("Please paste a job description to run ATS check.");
      return;
    }

    const matched = jdWords.filter((word) => resumeWords.has(word));
    const missing = jdWords.filter((word) => !resumeWords.has(word));
    const score = Math.round((matched.length / jdWords.length) * 100);

    setAtsResult({
      score,
      matched: matched.slice(0, 20),
      missing: missing.slice(0, 20),
      suggestion:
        score >= 75
          ? "Strong match. Keep outcomes and project impact highlighted."
          : "Add missing keywords naturally into skills, projects, and experience sections.",
    });
    setSuccessText("ATS check completed.");
    setErrorText("");
  }

  // Filtered + derived views
  const filteredJobs = jobs.filter((job) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const queryMatch =
      !normalizedQuery ||
      `${job.company || ""} ${job.role || ""} ${job.status || ""}`.toLowerCase().includes(normalizedQuery);

    const globalMatch =
      !normalizedGlobalSearch ||
      `${job.company || ""} ${job.role || ""} ${job.status || ""} ${job.recruiterName || ""}`
        .toLowerCase()
        .includes(normalizedGlobalSearch);

    const statusMatch = statusFilter === "All" || (job.status || "Wishlist") === statusFilter;

    const interviewThisWeekMatch = (() => {
      const weekAhead = new Date();
      weekAhead.setDate(weekAhead.getDate() + 7);
      const emails = Array.isArray(job.emails) ? job.emails : [];
      return emails.some((email) => {
        if (email.type !== "Interview Scheduled") return false;
        const interviewDate = email.date ? new Date(email.date) : null;
        return Boolean(
          interviewDate && !Number.isNaN(interviewDate.getTime()) && interviewDate <= weekAhead
        );
      });
    })();

    const needsFollowUpMatch = (() => {
      if (!["Applied", "Screening"].includes(job.status || "")) return false;
      const baseDateText = job.appliedDate || job.createdAt;
      const baseDate = baseDateText ? new Date(baseDateText) : null;
      if (!baseDate || Number.isNaN(baseDate.getTime())) return false;
      const ageInDays = Math.floor((Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      return ageInDays >= 7 && !hasActiveFollowUpReminder(job, reminders);
    })();

    const smartViewMatch =
      jobSmartView === "All" ||
      (jobSmartView === "Needs Follow-up" && needsFollowUpMatch) ||
      (jobSmartView === "Interview This Week" && interviewThisWeekMatch);

    return queryMatch && globalMatch && statusMatch && smartViewMatch;
  });

  const jobTrackerColumns = PIPELINE_ORDER.map((status) => ({
    status,
    jobs: filteredJobs.filter((job) => (job.status || "Wishlist") === status),
  }));

  const needsFollowUpJobs = jobs
    .filter((job) => {
      if (!["Applied", "Screening"].includes(job.status || "")) return false;
      const baseDateText = job.appliedDate || job.createdAt;
      const baseDate = baseDateText ? new Date(baseDateText) : null;
      if (!baseDate || Number.isNaN(baseDate.getTime())) return false;
      const ageInDays = Math.floor((Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      return ageInDays >= 7 && !hasActiveFollowUpReminder(job, reminders);
    })
    .slice(0, 5);

  return {
    // State
    jobForm,
    editingJobId,
    draggedJobId,
    dragOverStatus,
    expandedJobs,
    activeEmailModal,
    activeDetailTab,
    emailReadMap,
    interviewAnswers,
    atsResume,
    atsJobDescription,
    atsResult,
    setAtsResume,
    setAtsJobDescription,
    // Derived
    filteredJobs,
    jobTrackerColumns,
    needsFollowUpJobs,
    // Handlers
    loadPersistedState,
    resetJobState,
    handleJobInput,
    handleDelete,
    handleMarkImported,
    handleStatusChange,
    handleAttachResume,
    handleSaveJob,
    handleEditJob,
    handleCancelEditJob,
    handleJobDragStart,
    handleJobDragEnd,
    handleKanbanDragOver,
    handleKanbanDrop,
    markEmailAsRead,
    toggleJobExpanded,
    setJobDetailTab,
    handleEmailCardDoubleClick,
    closeEmailModal,
    handleAnswerChange,
    runAtsCheck,
    getStatusChipClass,
    getEmailTypeClass,
    formatEmailDate,
    getEmailIdentity,
  };
}
