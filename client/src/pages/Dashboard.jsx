import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BACKEND_URL,
  createJob,
  deleteJob,
  disconnectGmail,
  getAuthStatus,
  getHealth,
  getJobs,
  getWeeklyAnalytics,
  markJobImported,
  sendDueReminderHooks,
  syncJobs,
  updateJob,
} from "../api/backend";
import { INTERVIEW_QUESTIONS } from "./dashboard/interviewData";
import { getPathForView, NAV_ITEMS } from "./dashboard/routeConfig";
import { TEMPLATES } from "./dashboard/templatesData";

const DEMO_JOBS = [
  {
    id: "demo-1",
    company: "Google",
    role: "Data Engineer",
    status: "Applied",
    location: "Remote",
    recruiterName: "Alicia Kim",
    source: "demo",
    notes: "Submitted referral and tailored resume for GCP stack role.",
  },
  {
    id: "demo-2",
    company: "Amazon",
    role: "Business Intelligence Engineer",
    status: "Interview",
    location: "Seattle, WA",
    recruiterName: "Rahul Mehta",
    source: "demo",
    notes: "Phone screen completed. Next is technical round.",
  },
  {
    id: "demo-3",
    company: "Microsoft",
    role: "Data Analyst",
    status: "Screening",
    location: "Redmond, WA",
    recruiterName: "Sara Johnson",
    source: "demo",
    notes: "Recruiter requested updated portfolio link.",
  },
  {
    id: "demo-4",
    company: "Meta",
    role: "Analytics Engineer",
    status: "Offer",
    location: "Menlo Park, CA",
    recruiterName: "Daniel Lee",
    source: "demo",
    notes: "Offer discussion in progress. Comparing compensation details.",
    imported: true,
  },
];

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

const EMAIL_READ_STORAGE_KEY = "jsa_v2";

const CARD_ITEMS = [
  { label: "Total Applied", key: "total", tone: "tone-blue" },
  { label: "In Progress", key: "active", tone: "tone-purple" },
  { label: "Offers", key: "offers", tone: "tone-green" },
  { label: "Contacts", key: "contacts", tone: "tone-gold" },
];

const CONTACT_RELATIONSHIPS = ["Recruiter", "Hiring Manager", "Employee", "Alumni", "Friend", "Other"];

const CONTACTS_STORAGE_KEY = "jsh_contacts_v1";
const INTERVIEW_STORAGE_KEY = "jsh_interview_answers_v1";
const OUTREACH_STORAGE_KEY = "jsh_outreach_v1";
const REMINDERS_STORAGE_KEY = "jsh_reminders_v1";

export function DashboardPage({ routeView = "Dashboard" }) {
  const [activeView, setActiveView] = useState(routeView);
  const navigate = useNavigate();
  const location = useLocation();
  const [isHealthy, setIsHealthy] = useState(false);
  const [healthText, setHealthText] = useState("Checking backend...");
  const [connected, setConnected] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [jobSmartView, setJobSmartView] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactRelationship, setContactRelationship] = useState("All");
  const [contactForm, setContactForm] = useState({
    name: "",
    company: "",
    title: "",
    email: "",
    relationship: "Recruiter",
    notes: "",
  });
  const [templateType, setTemplateType] = useState("All");
  const [templateSearch, setTemplateSearch] = useState("");
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState(null);
  const [archiveFiles, setArchiveFiles] = useState([]);
  const [archiveSelectedPath, setArchiveSelectedPath] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveContent, setArchiveContent] = useState("");
  const [jobForm, setJobForm] = useState({
    company: "",
    role: "",
    status: "Applied",
    location: "",
    notes: "",
  });
  const [editingJobId, setEditingJobId] = useState(null);
  const [draggedJobId, setDraggedJobId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState("");
  const [expandedJobs, setExpandedJobs] = useState({});
  const [activeEmailModal, setActiveEmailModal] = useState(null);
  const [emailReadMap, setEmailReadMap] = useState({});

  const [interviewAnswers, setInterviewAnswers] = useState({});
  const [questionFilter, setQuestionFilter] = useState("All");

  const [outreachEntries, setOutreachEntries] = useState([]);
  const [outreachForm, setOutreachForm] = useState({
    contact: "",
    company: "",
    method: "LinkedIn",
    status: "Sent",
    notes: "",
  });

  const [reminders, setReminders] = useState([]);
  const [sendingReminderHooks, setSendingReminderHooks] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    title: "",
    dueDate: "",
    type: "Follow Up",
  });

  const [atsResume, setAtsResume] = useState("");
  const [atsJobDescription, setAtsJobDescription] = useState("");
  const [atsResult, setAtsResult] = useState(null);
  const [weeklySummaryApi, setWeeklySummaryApi] = useState(null);

  const connectedFromCallback = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("connected") === "true";
  }, [location.search]);

  useEffect(() => {
    if (routeView !== activeView) {
      setActiveView(routeView);
    }
  }, [routeView]);

  const isDemoMode = jobs.length === 0;
  const displayJobs = isDemoMode ? DEMO_JOBS : jobs;
  const pipelineColumns = PIPELINE_ORDER.map((status) => ({
    status,
    jobs: displayJobs.filter((job) => (job.status || "Wishlist") === status),
  }));

  const stats = {
    total: displayJobs.length,
    active: displayJobs.filter((job) => !["Rejected", "Offer"].includes(job.status || "")).length,
    interviews: displayJobs.filter((job) => job.status === "Interview").length,
    offers: displayJobs.filter((job) => job.status === "Offer").length,
    contacts: displayJobs.filter((job) => Boolean(job.recruiterName)).length,
  };

  const recentApplications = displayJobs.slice(0, 3);
  const upcomingFollowUps = displayJobs
    .filter((job) => ["Applied", "Screening", "Interview"].includes(job.status || ""))
    .slice(0, 3);

  const weeklySummary = (() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    function toDateSafe(value) {
      if (!value) {
        return null;
      }
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function isInLastSevenDays(value) {
      const parsed = toDateSafe(value);
      return Boolean(parsed && parsed >= weekAgo && parsed <= now);
    }

    const applicationsThisWeek = displayJobs.filter((job) => {
      return isInLastSevenDays(job.createdAt || job.appliedDate);
    }).length;

    const responsesThisWeek = displayJobs.reduce((count, job) => {
      const emails = Array.isArray(job.emails) ? job.emails : [];
      const hasResponse = emails.some(
        (email) =>
          isInLastSevenDays(email.date) &&
          ["Recruiter Outreach", "Interview Scheduled", "Offer", "Rejection"].includes(email.type)
      );
      return count + (hasResponse ? 1 : 0);
    }, 0);

    const interviewsThisWeek = displayJobs.reduce((count, job) => {
      const emails = Array.isArray(job.emails) ? job.emails : [];
      const hasInterviewSignal = emails.some(
        (email) => isInLastSevenDays(email.date) && email.type === "Interview Scheduled"
      );
      return count + (hasInterviewSignal ? 1 : 0);
    }, 0);

    const stalledJobs = displayJobs.filter((job) => {
      if (!["Applied", "Screening"].includes(job.status || "")) {
        return false;
      }
      const anchorDate = toDateSafe(job.appliedDate || job.createdAt);
      if (!anchorDate) {
        return false;
      }
      const ageInDays = Math.floor((now.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
      return ageInDays >= 14 && !hasActiveFollowUpReminder(job);
    }).length;

    return {
      applicationsThisWeek,
      responsesThisWeek,
      interviewsThisWeek,
      stalledJobs,
    };
  })();
  const weeklySummaryDisplay = weeklySummaryApi || weeklySummary;

  function getEmailIdentity(email) {
    return email.gmailId || email.id;
  }

  function normalizeEmailItem(email) {
    const identity = getEmailIdentity(email);
    return {
      id: email.id || identity || `email_${Math.random().toString(36).slice(2, 8)}`,
      from: email.from || "",
      fromName: email.fromName || email.from || "Unknown Sender",
      subject: email.subject || "No subject",
      preview: email.preview || "",
      body: email.body || "",
      date: email.date || new Date().toISOString(),
      type: email.type || "Auto / Tracking",
      isReal: Boolean(email.isReal),
      gmailId: email.gmailId || "",
      isRead: Boolean(emailReadMap[identity]) || Boolean(email.isRead),
    };
  }

  function mergeEmails(currentEmails, incomingEmails) {
    const byId = new Map();

    for (const item of currentEmails || []) {
      const normalized = normalizeEmailItem(item);
      byId.set(getEmailIdentity(normalized) || normalized.id, normalized);
    }

    for (const item of incomingEmails || []) {
      const normalized = normalizeEmailItem(item);
      const identity = getEmailIdentity(normalized) || normalized.id;
      if (!byId.has(identity)) {
        byId.set(identity, normalized);
      } else {
        const existing = byId.get(identity);
        byId.set(identity, {
          ...existing,
          ...normalized,
          isRead: Boolean(existing.isRead || normalized.isRead),
        });
      }
    }

    return Array.from(byId.values()).sort(
      (first, second) => new Date(first.date).getTime() - new Date(second.date).getTime()
    );
  }

  function mergeJobsById(currentJobs, incomingJobs) {
    const currentById = new Map((currentJobs || []).map((job) => [job.id, job]));
    const merged = [];

    for (const incomingJob of incomingJobs || []) {
      const existing = currentById.get(incomingJob.id);
      const mergedEmails = mergeEmails(existing?.emails || [], incomingJob.emails || []);
      merged.push({
        ...(existing || {}),
        ...incomingJob,
        emails: mergedEmails,
      });
      currentById.delete(incomingJob.id);
    }

    for (const leftover of currentById.values()) {
      merged.push({
        ...leftover,
        emails: mergeEmails(leftover.emails || [], []),
      });
    }

    return merged;
  }

  function mergeAutoContacts(currentContacts, sourceJobs) {
    const existingContacts = Array.isArray(currentContacts) ? currentContacts : [];
    const byEmail = new Set(
      existingContacts
        .map((contact) => String(contact.email || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const byNameCompany = new Set(
      existingContacts
        .map((contact) => {
          const name = String(contact.name || "").trim().toLowerCase();
          const company = String(contact.company || "").trim().toLowerCase();
          return name && company ? `${name}::${company}` : "";
        })
        .filter(Boolean)
    );

    const createdContacts = [];

    for (const job of sourceJobs || []) {
      const recruiterName = String(job?.recruiterName || "").trim();
      const recruiterEmail = String(job?.recruiterEmail || "").trim();
      const company = String(job?.company || "").trim();

      if (!recruiterName || !company) {
        continue;
      }

      const normalizedEmail = recruiterEmail.toLowerCase();
      const normalizedNameCompany = `${recruiterName.toLowerCase()}::${company.toLowerCase()}`;

      if ((normalizedEmail && byEmail.has(normalizedEmail)) || byNameCompany.has(normalizedNameCompany)) {
        continue;
      }

      const nextContact = {
        id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: recruiterName,
        company,
        title: "Recruiter",
        email: recruiterEmail,
        relationship: "Recruiter",
        notes: `Auto-created from job sync: ${job.role || "Unknown Role"}`,
        createdAt: new Date().toISOString(),
      };

      createdContacts.push(nextContact);

      if (normalizedEmail) {
        byEmail.add(normalizedEmail);
      }
      byNameCompany.add(normalizedNameCompany);
    }

    if (createdContacts.length === 0) {
      return { nextContacts: existingContacts, addedCount: 0 };
    }

    return {
      nextContacts: [...createdContacts, ...existingContacts],
      addedCount: createdContacts.length,
    };
  }

  async function loadDashboard() {
    setErrorText("");
    setSuccessText("");
    setLoading(true);

    try {
      const [health, auth, jobsPayload, weeklyAnalytics] = await Promise.all([
        getHealth(),
        getAuthStatus(),
        getJobs(),
        getWeeklyAnalytics().catch(() => null),
      ]);

      setIsHealthy(health.status === "ok");
      setHealthText(
        health.status === "ok"
          ? `Backend connected at ${BACKEND_URL}`
          : "Backend responded with an unexpected health payload."
      );
      setConnected(Boolean(auth.connected));
      setLastChecked(jobsPayload.lastChecked || auth.lastChecked || null);
      const mergedJobs = mergeJobsById(jobs, jobsPayload.jobs || []);
      setJobs(mergedJobs);
      if (weeklyAnalytics) {
        setWeeklySummaryApi(weeklyAnalytics);
      }

      const autoContactResult = mergeAutoContacts(contacts, mergedJobs);
      if (autoContactResult.addedCount > 0) {
        saveContacts(autoContactResult.nextContacts);
      }

      if (!auth.connected && (jobsPayload.jobs || []).length === 0) {
        setSuccessText("Connected UI is ready. Connect Gmail to start importing real jobs.");
      }
    } catch (error) {
      setIsHealthy(false);
      setHealthText(`Could not reach backend at ${BACKEND_URL}`);
      setErrorText(error.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setErrorText("");
    setSuccessText("");

    try {
      const payload = await syncJobs();
      const mergedJobs = mergeJobsById(jobs, payload.jobs || []);
      setJobs(mergedJobs);

      const autoContactResult = mergeAutoContacts(contacts, mergedJobs);
      if (autoContactResult.addedCount > 0) {
        saveContacts(autoContactResult.nextContacts);
      }

      setLastChecked(payload.lastChecked || null);
      setSuccessText(
        autoContactResult.addedCount > 0
          ? `Sync completed successfully. ${autoContactResult.addedCount} recruiter contact(s) auto-added.`
          : "Sync completed successfully."
      );
    } catch (error) {
      setErrorText(error.message || "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setErrorText("");
    setSuccessText("");
    try {
      await disconnectGmail();
      await loadDashboard();
      setSuccessText("Gmail disconnected.");
    } catch (error) {
      setErrorText(error.message || "Disconnect failed.");
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

  function handleConnectGmail() {
    window.location.href = `${BACKEND_URL}/auth/gmail`;
  }

  function handleViewChange(view) {
    setActiveView(view);
    const nextPath = getPathForView(view);
    if (location.pathname !== nextPath) {
      navigate(nextPath);
    }
  }

  useEffect(() => {
    try {
      const savedReadState = window.localStorage.getItem(EMAIL_READ_STORAGE_KEY);
      if (savedReadState) {
        const parsed = JSON.parse(savedReadState);
        if (parsed && typeof parsed === "object") {
          setEmailReadMap(parsed);
        }
      }
    } catch {
      setEmailReadMap({});
    }

    try {
      const savedContacts = window.localStorage.getItem(CONTACTS_STORAGE_KEY);
      if (savedContacts) {
        const parsedContacts = JSON.parse(savedContacts);
        if (Array.isArray(parsedContacts)) {
          setContacts(parsedContacts);
        }
      }
    } catch {
      setContacts([]);
    }

    try {
      const savedAnswers = window.localStorage.getItem(INTERVIEW_STORAGE_KEY);
      if (savedAnswers) {
        const parsed = JSON.parse(savedAnswers);
        if (parsed && typeof parsed === "object") {
          setInterviewAnswers(parsed);
        }
      }
    } catch {
      setInterviewAnswers({});
    }

    try {
      const savedOutreach = window.localStorage.getItem(OUTREACH_STORAGE_KEY);
      if (savedOutreach) {
        const parsed = JSON.parse(savedOutreach);
        if (Array.isArray(parsed)) {
          setOutreachEntries(parsed);
        }
      }
    } catch {
      setOutreachEntries([]);
    }

    try {
      const savedReminders = window.localStorage.getItem(REMINDERS_STORAGE_KEY);
      if (savedReminders) {
        const parsed = JSON.parse(savedReminders);
        if (Array.isArray(parsed)) {
          setReminders(parsed);
        }
      }
    } catch {
      setReminders([]);
    }

    loadDashboard();
  }, []);

  function saveContacts(nextContacts) {
    setContacts(nextContacts);
    window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(nextContacts));
  }

  function saveInterviewAnswers(nextAnswers) {
    setInterviewAnswers(nextAnswers);
    window.localStorage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(nextAnswers));
  }

  function saveOutreach(nextEntries) {
    setOutreachEntries(nextEntries);
    window.localStorage.setItem(OUTREACH_STORAGE_KEY, JSON.stringify(nextEntries));
  }

  function saveReminders(nextReminders) {
    setReminders(nextReminders);
    window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(nextReminders));
  }

  function saveEmailReadMap(nextReadMap) {
    setEmailReadMap(nextReadMap);
    window.localStorage.setItem(EMAIL_READ_STORAGE_KEY, JSON.stringify(nextReadMap));
  }

  function markEmailAsRead(jobId, email) {
    const identity = getEmailIdentity(email);
    if (!identity) {
      return;
    }

    const nextReadMap = {
      ...emailReadMap,
      [identity]: true,
    };
    saveEmailReadMap(nextReadMap);

    setJobs((currentJobs) =>
      currentJobs.map((job) => {
        if (job.id !== jobId) {
          return job;
        }

        return {
          ...job,
          emails: (job.emails || []).map((item) => {
            if ((getEmailIdentity(item) || item.id) !== identity) {
              return item;
            }

            return {
              ...item,
              isRead: true,
            };
          }),
        };
      })
    );
  }

  function toggleJobExpanded(jobId) {
    setExpandedJobs((current) => ({
      ...current,
      [jobId]: !current[jobId],
    }));
  }

  function formatEmailDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }

    return date.toLocaleString();
  }

  function getEmailTypeClass(type) {
    return EMAIL_TYPE_CLASS[type] || "email-type-auto";
  }

  function handleEmailCardDoubleClick(jobId, email) {
    markEmailAsRead(jobId, email);
    setActiveEmailModal({ jobId, email });
  }

  function closeEmailModal() {
    setActiveEmailModal(null);
  }

  function handleContactInput(field, value) {
    setContactForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleAddContact(event) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!contactForm.name.trim() || !contactForm.company.trim()) {
      setErrorText("Contact name and company are required.");
      return;
    }

    const nextContacts = [
      {
        id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: contactForm.name.trim(),
        company: contactForm.company.trim(),
        title: contactForm.title.trim(),
        email: contactForm.email.trim(),
        relationship: contactForm.relationship,
        notes: contactForm.notes.trim(),
        createdAt: new Date().toISOString(),
      },
      ...contacts,
    ];

    saveContacts(nextContacts);
    setContactForm({
      name: "",
      company: "",
      title: "",
      email: "",
      relationship: "Recruiter",
      notes: "",
    });
    setSuccessText("Contact added.");
  }

  function handleDeleteContact(contactId) {
    setErrorText("");
    setSuccessText("");
    const nextContacts = contacts.filter((contact) => contact.id !== contactId);
    saveContacts(nextContacts);
    setSuccessText("Contact deleted.");
  }

  function handleJobInput(field, value) {
    setJobForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function getFollowUpTitle(job) {
    const company = String(job?.company || "").trim() || "Unknown Company";
    const role = String(job?.role || "").trim() || "Unknown Role";
    return `Follow up: ${company} — ${role}`;
  }

  function hasActiveFollowUpReminder(job, remindersList = reminders) {
    const expectedTitle = getFollowUpTitle(job).toLowerCase();
    return remindersList.some(
      (reminder) =>
        !reminder.completed &&
        reminder.type === "Follow Up" &&
        String(reminder.title || "").toLowerCase() === expectedTitle
    );
  }

  function buildFollowUpDueDate(daysAhead = 7) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysAhead);
    return dueDate.toISOString().slice(0, 10);
  }

  function addAutoFollowUpReminder(job) {
    if (!job || !job.company || !job.role) {
      return false;
    }

    if (hasActiveFollowUpReminder(job)) {
      return false;
    }

    const nextReminders = [
      {
        id: `reminder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: getFollowUpTitle(job),
        dueDate: buildFollowUpDueDate(7),
        type: "Follow Up",
        completed: false,
      },
      ...reminders,
    ];

    saveReminders(nextReminders);
    return true;
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
        const reminderAdded = addAutoFollowUpReminder(createdJob);
        setSuccessText(reminderAdded ? "Job created. Follow-up reminder added." : "Job created.");
      }

      setJobForm({
        company: "",
        role: "",
        status: "Applied",
        location: "",
        notes: "",
      });
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
      location: job.location || "",
      notes: job.notes || "",
    });
  }

  function handleCancelEditJob() {
    setEditingJobId(null);
    setJobForm({
      company: "",
      role: "",
      status: "Applied",
      location: "",
      notes: "",
    });
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

  function handleJobDragStart(jobId) {
    if (isDemoMode) {
      return;
    }
    setDraggedJobId(jobId);
  }

  function handleJobDragEnd() {
    setDraggedJobId(null);
    setDragOverStatus("");
  }

  function handleKanbanDragOver(event, status) {
    if (isDemoMode) {
      return;
    }
    event.preventDefault();
    if (dragOverStatus !== status) {
      setDragOverStatus(status);
    }
  }

  async function handleKanbanDrop(event, status) {
    if (isDemoMode) {
      return;
    }

    event.preventDefault();
    const droppedJobId = draggedJobId;
    setDragOverStatus("");

    if (!droppedJobId) {
      return;
    }

    const droppedJob = jobs.find((job) => job.id === droppedJobId);
    const currentStatus = droppedJob?.status || "Wishlist";

    if (currentStatus === status) {
      setDraggedJobId(null);
      return;
    }

    await handleStatusChange(droppedJobId, status);
    setDraggedJobId(null);
  }

  function handleAnswerChange(questionId, value) {
    const nextAnswers = {
      ...interviewAnswers,
      [questionId]: value,
    };
    saveInterviewAnswers(nextAnswers);
  }

  function handleOutreachInput(field, value) {
    setOutreachForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleAddOutreach(event) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!outreachForm.contact.trim() || !outreachForm.company.trim()) {
      setErrorText("Outreach contact and company are required.");
      return;
    }

    const nextEntries = [
      {
        id: `outreach_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        contact: outreachForm.contact.trim(),
        company: outreachForm.company.trim(),
        method: outreachForm.method,
        status: outreachForm.status,
        notes: outreachForm.notes.trim(),
        date: new Date().toISOString(),
      },
      ...outreachEntries,
    ];

    saveOutreach(nextEntries);
    setOutreachForm({
      contact: "",
      company: "",
      method: "LinkedIn",
      status: "Sent",
      notes: "",
    });
    setSuccessText("Outreach log added.");
  }

  function handleUpdateOutreachStatus(entryId, status) {
    const nextEntries = outreachEntries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            status,
          }
        : entry
    );
    saveOutreach(nextEntries);
    setSuccessText("Outreach status updated.");
  }

  function handleDeleteOutreach(entryId) {
    const nextEntries = outreachEntries.filter((entry) => entry.id !== entryId);
    saveOutreach(nextEntries);
    setSuccessText("Outreach entry deleted.");
  }

  function handleReminderInput(field, value) {
    setReminderForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleAddReminder(event) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (!reminderForm.title.trim() || !reminderForm.dueDate) {
      setErrorText("Reminder title and due date are required.");
      return;
    }

    const nextReminders = [
      {
        id: `reminder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: reminderForm.title.trim(),
        dueDate: reminderForm.dueDate,
        type: reminderForm.type,
        completed: false,
      },
      ...reminders,
    ];

    saveReminders(nextReminders);
    setReminderForm({ title: "", dueDate: "", type: "Follow Up" });
    setSuccessText("Reminder added.");
  }

  function handleToggleReminder(reminderId) {
    const nextReminders = reminders.map((reminder) =>
      reminder.id === reminderId
        ? {
            ...reminder,
            completed: !reminder.completed,
          }
        : reminder
    );
    saveReminders(nextReminders);
  }

  function handleDeleteReminder(reminderId) {
    const nextReminders = reminders.filter((reminder) => reminder.id !== reminderId);
    saveReminders(nextReminders);
    setSuccessText("Reminder deleted.");
  }

  async function handleSendReminderHooks() {
    setSendingReminderHooks(true);
    setErrorText("");
    setSuccessText("");

    try {
      const result = await sendDueReminderHooks(reminders);
      setSuccessText(
        `Reminder hooks triggered for ${result.count || 0} due reminder(s).`
      );
    } catch (error) {
      setErrorText(error.message || "Unable to send reminder hooks.");
    } finally {
      setSendingReminderHooks(false);
    }
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

  const normalizedGlobalSearch = globalSearchQuery.trim().toLowerCase();

  const filteredJobs = displayJobs.filter((job) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const queryMatch =
      !normalizedQuery ||
      `${job.company || ""} ${job.role || ""} ${job.status || ""}`
        .toLowerCase()
        .includes(normalizedQuery);

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
        if (email.type !== "Interview Scheduled") {
          return false;
        }
        const interviewDate = email.date ? new Date(email.date) : null;
        return Boolean(interviewDate && !Number.isNaN(interviewDate.getTime()) && interviewDate <= weekAhead);
      });
    })();

    const needsFollowUpMatch = (() => {
      if (!["Applied", "Screening"].includes(job.status || "")) {
        return false;
      }
      const baseDateText = job.appliedDate || job.createdAt;
      const baseDate = baseDateText ? new Date(baseDateText) : null;
      if (!baseDate || Number.isNaN(baseDate.getTime())) {
        return false;
      }
      const ageInDays = Math.floor((Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      return ageInDays >= 7 && !hasActiveFollowUpReminder(job);
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

  const filteredQuestions = INTERVIEW_QUESTIONS.filter((question) =>
    questionFilter === "All" ? true : question.category === questionFilter
  );

  const sortedReminders = [...reminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const filteredReminders = sortedReminders.filter((reminder) => {
    if (!normalizedGlobalSearch) {
      return true;
    }
    return `${reminder.title || ""} ${reminder.type || ""} ${reminder.dueDate || ""}`
      .toLowerCase()
      .includes(normalizedGlobalSearch);
  });
  const interviewCalendarEvents = displayJobs.flatMap((job) => {
    const emails = Array.isArray(job.emails) ? job.emails : [];
    return emails
      .filter((email) => email.type === "Interview Scheduled")
      .map((email) => {
        const parsedDate = email.date ? new Date(email.date) : null;
        return {
          id: `interview_${job.id}_${email.gmailId || email.id || Math.random().toString(36).slice(2, 6)}`,
          title: `Interview: ${job.company || "Unknown Company"} — ${job.role || "Unknown Role"}`,
          description: `${email.subject || "Interview scheduled"}\nFrom: ${email.from || "Unknown"}`,
          date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
        };
      })
      .filter((event) => Boolean(event.date));
  });
  const needsFollowUpJobs = displayJobs
    .filter((job) => {
      if (!["Applied", "Screening"].includes(job.status || "")) {
        return false;
      }

      const baseDateText = job.appliedDate || job.createdAt;
      const baseDate = baseDateText ? new Date(baseDateText) : null;
      if (!baseDate || Number.isNaN(baseDate.getTime())) {
        return false;
      }

      const ageInDays = Math.floor((Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      return ageInDays >= 7 && !hasActiveFollowUpReminder(job);
    })
    .slice(0, 5);

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

  function buildReminderCalendarEvents() {
    return sortedReminders
      .filter((reminder) => reminder.dueDate)
      .map((reminder) => ({
        uid: `${reminder.id || `reminder_${Math.random().toString(36).slice(2, 6)}`}@job-search-hub`,
        title: reminder.title || "Job Search Reminder",
        description: `Type: ${reminder.type || "Other"}`,
        allDayDate: reminder.dueDate,
      }));
  }

  function buildInterviewCalendarEvents() {
    return interviewCalendarEvents.map((event) => {
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
  }

  function downloadCalendar(events, filename) {
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

  function handleExportAllCalendar() {
    const reminderEvents = buildReminderCalendarEvents();
    const interviewEvents = buildInterviewCalendarEvents();
    downloadCalendar([...reminderEvents, ...interviewEvents], "job-search-calendar.ics");
  }

  function getStatusChipClass(status) {
    return STATUS_CHIP_CLASS[status] || "status-wishlist";
  }

  function renderDashboardView() {
    return (
      <>
        <header className="hero">
          <h1>Good morning, Manikanth</h1>
          <p>Here is your job search overview</p>
        </header>

        <section className="sync-box">
          <div>
            <h3>Gmail Auto Sync</h3>
            <p>
              {isHealthy
                ? `Backend is connected at ${BACKEND_URL}.`
                : "Deploy backend first, then update your BACKEND URL to start live sync."}
            </p>
          </div>
          <span className="sync-badge">{isHealthy ? "Backend Connected" : "Set BACKEND URL first"}</span>
        </section>

        <section className="control-row">
          <button type="button" onClick={loadDashboard} disabled={loading}>
            Refresh
          </button>
          <button type="button" onClick={handleConnectGmail} disabled={!isHealthy}>
            Connect Gmail
          </button>
          <button type="button" onClick={handleDisconnect} disabled={!connected}>
            Disconnect
          </button>
          <button type="button" onClick={handleSync} disabled={!connected || syncing}>
            {syncing ? "Syncing..." : "Sync Jobs"}
          </button>
        </section>

        {connectedFromCallback && <div className="inline-note success">Gmail connected successfully.</div>}
        {successText && <div className="inline-note success">{successText}</div>}
        {errorText && <div className="inline-note error">{errorText}</div>}

        <section className="overview-cards">
          {CARD_ITEMS.map((card) => (
            <article key={card.key} className={`overview-card ${card.tone}`}>
              <p>{card.label}</p>
              <strong>{stats[card.key]}</strong>
            </article>
          ))}
          <article className="overview-card tone-blue">
            <p>Weekly Applications</p>
            <strong>{weeklySummaryDisplay.applicationsThisWeek}</strong>
          </article>
        </section>

        <section className="block">
          <h3>Weekly Summary</h3>
          <ul>
            <li>
              <strong>Applications:</strong> {weeklySummaryDisplay.applicationsThisWeek}
            </li>
            <li>
              <strong>Responses:</strong> {weeklySummaryDisplay.responsesThisWeek}
            </li>
            <li>
              <strong>Interviews:</strong> {weeklySummaryDisplay.interviewsThisWeek}
            </li>
            <li>
              <strong>Stalled Jobs:</strong> {weeklySummaryDisplay.stalledJobs}
            </li>
          </ul>
        </section>

        <section className="two-col">
          <article className="block">
            <h3>Recent Applications</h3>
            {recentApplications.length === 0 ? (
              <p>No jobs tracked yet</p>
            ) : (
              <ul>
                {recentApplications.map((job) => (
                  <li key={job.id}>
                    <strong>{job.role}</strong> · {job.company}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="block">
            <h3>Upcoming Follow Ups</h3>
            {upcomingFollowUps.length === 0 ? (
              <p>No reminders set</p>
            ) : (
              <ul>
                {upcomingFollowUps.map((job) => (
                  <li key={`followup-${job.id}`}>
                    <strong>{job.company}</strong> · {job.status}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="block">
            <h3>Needs Follow-up (Smart)</h3>
            {needsFollowUpJobs.length === 0 ? (
              <p>No stale applications right now</p>
            ) : (
              <ul>
                {needsFollowUpJobs.map((job) => (
                  <li key={`smart-followup-${job.id}`}>
                    <strong>{job.company}</strong> · {job.role}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="pipeline-section">
          <h3>Pipeline</h3>
          <div className="pipeline-grid">
            {pipelineColumns.map((column) => (
              <article key={column.status} className="pipeline-col">
                <header>
                  <h4>{column.status}</h4>
                  <span>{column.jobs.length}</span>
                </header>
                {column.jobs.slice(0, 2).map((job) => (
                  <div key={`${column.status}-${job.id}`} className="pipeline-card">
                    <strong>{job.role || "Unknown Role"}</strong>
                    <p>{job.company || "N/A"}</p>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderJobTrackerView() {
    function renderJobTrackerCard(job) {
      const emails = mergeEmails([], job.emails || []);
      const isExpanded = Boolean(expandedJobs[job.id]);
      const hasUnreadRealEmail = emails.some((email) => email.isReal && !email.isRead);

      return (
        <article
          key={job.id}
          className={`tracker-card card-${getStatusChipClass(job.status || "Wishlist")} ${
            isDemoMode ? "" : "is-draggable"
          } ${draggedJobId === job.id ? "is-dragging" : ""}`}
          draggable={!isDemoMode}
          onDragStart={() => handleJobDragStart(job.id)}
          onDragEnd={handleJobDragEnd}
        >
          <header
            className="tracker-card-header"
            role="button"
            tabIndex={0}
            onClick={() => toggleJobExpanded(job.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleJobExpanded(job.id);
              }
            }}
          >
            <div>
              <h4>{job.role || "Unknown Role"}</h4>
              <p>
                <strong>{job.company || "Unknown Company"}</strong>
              </p>
              <p>{job.location || "Location not set"}</p>
              <p>Applied: {job.appliedDate || "Unknown"}</p>
            </div>
            <div className="tracker-card-badges">
              <span className={`chip ${getStatusChipClass(job.status || "Wishlist")}`}>
                {job.status || "Wishlist"}
              </span>
              <span className="chip email-count-badge">
                {emails.length} emails
                {hasUnreadRealEmail && <span className="email-unread-dot" />}
              </span>
            </div>
          </header>

          {isExpanded && (
            <>
              <p>{job.recruiterName || "Recruiter not available"}</p>

              <div className="email-thread-panel">
                {emails.length === 0 ? (
                  <p className="muted">No emails yet — will auto-populate from Gmail</p>
                ) : (
                  <div className="email-timeline">
                    <div className="email-timeline-line" />
                    {emails.map((email) => (
                      <article
                        key={getEmailIdentity(email) || email.id}
                        className={`email-mini-card ${email.isReal ? "email-real" : "email-auto"}`}
                        onDoubleClick={() => handleEmailCardDoubleClick(job.id, email)}
                        title="Double-click to read full email"
                      >
                        <div className="email-timeline-dot-wrap">
                          <span className={`email-timeline-dot ${getEmailTypeClass(email.type)}`} />
                        </div>
                        <div className="email-mini-content">
                          <div className="email-mini-top">
                            <div>
                              <p className="email-sender-name">{email.fromName || "Unknown Sender"}</p>
                              <p className="email-sender-address">{email.from || ""}</p>
                            </div>
                            <p className="email-date-text">{formatEmailDate(email.date)}</p>
                          </div>
                          <p className="email-subject">{email.subject || "No subject"}</p>
                          <p className="email-preview">{email.body || email.preview || "No message available"}</p>
                          <div className="control-row">
                            <span className={`chip ${getEmailTypeClass(email.type)}`}>
                              {email.type || "Auto / Tracking"}
                            </span>
                            <span className={`chip ${email.isReal ? "email-real-badge" : "email-auto-badge"}`}>
                              {email.isReal ? "Real email" : "Auto / Tracking email"}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {activeEmailModal && activeEmailModal.jobId === job.id && (
                <div className="email-modal-overlay" onClick={closeEmailModal}>
                  <section className="email-modal" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="email-modal-close" onClick={closeEmailModal}>
                      ×
                    </button>
                    <h3>{activeEmailModal.email.subject || "No subject"}</h3>
                    <p>
                      <strong>{activeEmailModal.email.fromName || "Unknown Sender"}</strong>
                    </p>
                    <p>{activeEmailModal.email.from || ""}</p>
                    <p className="muted">{formatEmailDate(activeEmailModal.email.date)}</p>
                    <div className="control-row">
                      <span className={`chip ${getEmailTypeClass(activeEmailModal.email.type)}`}>
                        {activeEmailModal.email.type || "Auto / Tracking"}
                      </span>
                      <span className={`chip ${activeEmailModal.email.isReal ? "email-real-badge" : "email-auto-badge"}`}>
                        {activeEmailModal.email.isReal ? "Real email" : "Auto / Tracking email"}
                      </span>
                    </div>
                    <pre className="email-modal-body">{activeEmailModal.email.body || "No body text available"}</pre>
                  </section>
                </div>
              )}

              <div className="control-row">
                <select
                  value={job.status || "Wishlist"}
                  onChange={(event) => handleStatusChange(job.id, event.target.value)}
                  disabled={isDemoMode}
                >
                  {PIPELINE_ORDER.map((status) => (
                    <option key={`${job.id}-${status}`} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => handleEditJob(job)} disabled={isDemoMode}>
                  Edit
                </button>
                <button
                  type="button"
                  disabled={Boolean(job.imported) || isDemoMode}
                  onClick={() => handleMarkImported(job.id)}
                >
                  {job.imported ? "Imported" : "Mark Imported"}
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  disabled={isDemoMode}
                  onClick={() => handleDelete(job.id)}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </article>
      );
    }

    return (
      <section className="module-panel">
        <header className="module-header">
          <div>
            <h1>Job Tracker</h1>
            <p>Live jobs from backend when available, demo data otherwise.</p>
          </div>
          <div className="control-row">
            <button type="button" onClick={loadDashboard} disabled={loading}>
              Refresh
            </button>
            <button type="button" onClick={handleSync} disabled={!connected || syncing}>
              {syncing ? "Syncing..." : "Sync Jobs"}
            </button>
          </div>
        </header>

        {successText && <div className="inline-note success">{successText}</div>}
        {errorText && <div className="inline-note error">{errorText}</div>}

        <form className="job-form" onSubmit={handleSaveJob}>
          <input
            value={jobForm.company}
            onChange={(event) => handleJobInput("company", event.target.value)}
            placeholder="Company *"
          />
          <input
            value={jobForm.role}
            onChange={(event) => handleJobInput("role", event.target.value)}
            placeholder="Role *"
          />
          <select
            value={jobForm.status}
            onChange={(event) => handleJobInput("status", event.target.value)}
          >
            {PIPELINE_ORDER.map((status) => (
              <option key={`job-form-${status}`} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            value={jobForm.location}
            onChange={(event) => handleJobInput("location", event.target.value)}
            placeholder="Location"
          />
          <input
            className="job-notes"
            value={jobForm.notes}
            onChange={(event) => handleJobInput("notes", event.target.value)}
            placeholder="Notes"
          />
          <button type="submit">{editingJobId ? "Update Job" : "Add Job"}</button>
          {editingJobId && (
            <button type="button" onClick={handleCancelEditJob}>
              Cancel
            </button>
          )}
        </form>

        <div className="filters-row">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search company, role, status"
          />
          <select value={jobSmartView} onChange={(event) => setJobSmartView(event.target.value)}>
            <option value="All">Smart View: All</option>
            <option value="Needs Follow-up">Smart View: Needs Follow-up</option>
            <option value="Interview This Week">Smart View: Interview This Week</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All Statuses</option>
            {PIPELINE_ORDER.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="status-legend">
          {PIPELINE_ORDER.map((status) => (
            <span key={`legend-${status}`} className={`chip ${getStatusChipClass(status)}`}>
              {status}
            </span>
          ))}
        </div>

        <div className="job-kanban-grid">
          {jobTrackerColumns.map((column) => (
            <section
              key={`job-kanban-${column.status}`}
              className={`job-kanban-column ${dragOverStatus === column.status ? "is-drop-target" : ""}`}
              onDragOver={(event) => handleKanbanDragOver(event, column.status)}
              onDrop={(event) => handleKanbanDrop(event, column.status)}
            >
              <header className="job-kanban-column-header">
                <h4>{column.status}</h4>
                <span className={`chip ${getStatusChipClass(column.status)}`}>{column.jobs.length}</span>
              </header>

              <div className="job-kanban-list">
                {column.jobs.map((job) => renderJobTrackerCard(job))}
                {column.jobs.length === 0 && <p className="muted">No jobs</p>}
              </div>
            </section>
          ))}
        </div>

        {filteredJobs.length === 0 && <p className="muted">No jobs match the current filters.</p>}
      </section>
    );
  }

  function renderPlaceholderView() {
    return (
      <section className="module-panel">
        <h1>{activeView}</h1>
        <p className="muted">
          This module shell is ready. Next step is wiring full API-backed CRUD for {activeView}.
        </p>
      </section>
    );
  }

  function renderContactsView() {
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

        <form className="contact-form" onSubmit={handleAddContact}>
          <input
            value={contactForm.name}
            onChange={(event) => handleContactInput("name", event.target.value)}
            placeholder="Name *"
          />
          <input
            value={contactForm.company}
            onChange={(event) => handleContactInput("company", event.target.value)}
            placeholder="Company *"
          />
          <input
            value={contactForm.title}
            onChange={(event) => handleContactInput("title", event.target.value)}
            placeholder="Title"
          />
          <input
            value={contactForm.email}
            onChange={(event) => handleContactInput("email", event.target.value)}
            placeholder="Email"
          />
          <select
            value={contactForm.relationship}
            onChange={(event) => handleContactInput("relationship", event.target.value)}
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
            onChange={(event) => handleContactInput("notes", event.target.value)}
            placeholder="Notes"
          />
          <button type="submit">Add Contact</button>
        </form>

        <div className="filters-row">
          <input
            value={contactSearch}
            onChange={(event) => setContactSearch(event.target.value)}
            placeholder="Search name, company, title, email"
          />
          <select
            value={contactRelationship}
            onChange={(event) => setContactRelationship(event.target.value)}
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
          {filteredContacts.map((contact) => (
            <article key={contact.id} className="contact-card">
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
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => handleDeleteContact(contact.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {filteredContacts.length === 0 && <p className="muted">No contacts found.</p>}
        </div>
      </section>
    );
  }

  async function handleCopyTemplate(template) {
    setErrorText("");
    setSuccessText("");

    try {
      const contentToCopy =
        template.type === "Email" && template.subject
          ? `Subject: ${template.subject}\n\n${template.body}`
          : template.body;

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(contentToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = contentToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedTemplateId(template.id);
      setTimeout(() => {
        setCopiedTemplateId((current) => (current === template.id ? null : current));
      }, 2000);
      setSuccessText("Template copied to clipboard.");
    } catch {
      setErrorText("Unable to copy template. Please copy manually.");
    }
  }

  function normalizeTemplateText(text) {
    return (text || "")
      .replace(/â€”/g, "—")
      .replace(/â€™/g, "’")
      .replace(/â€œ/g, "“")
      .replace(/â€/g, "”")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  async function loadArchiveFiles() {
    setArchiveLoading(true);
    setErrorText("");
    try {
      const response = await fetch(`${BACKEND_URL}/templates/archive/files`);
      if (!response.ok) {
        throw new Error("Unable to load archive files.");
      }
      const payload = await response.json();
      const files = Array.isArray(payload?.files) ? payload.files : [];
      setArchiveFiles(files);
      if (files.length > 0 && !archiveSelectedPath) {
        setArchiveSelectedPath(files[0].path || "");
      }
      if (files.length === 0) {
        setArchiveSelectedPath("");
        setArchiveContent("");
      }
    } catch {
      setArchiveFiles([]);
      setArchiveSelectedPath("");
      setArchiveContent("");
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleLoadArchiveContent() {
    if (!archiveSelectedPath) {
      return;
    }

    setArchiveLoading(true);
    setErrorText("");
    try {
      const encodedPath = encodeURIComponent(archiveSelectedPath);
      const response = await fetch(`${BACKEND_URL}/templates/archive/content?path=${encodedPath}`);
      if (!response.ok) {
        throw new Error("Unable to load archive content.");
      }
      const payload = await response.json();
      setArchiveContent(payload?.content || "");
    } catch {
      setArchiveContent("");
      setErrorText("Archive content is unavailable right now.");
    } finally {
      setArchiveLoading(false);
    }
  }

  function renderTemplatesView() {
    const filteredTemplates = TEMPLATES.filter((template) => {
      const typeMatch = templateType === "All" ? true : template.type === templateType;
      const searchText = `${template.name || ""} ${template.sub || ""} ${template.body || ""} case ${template.case}`.toLowerCase();
      const searchMatch =
        !templateSearch.trim() || searchText.includes(templateSearch.trim().toLowerCase());
      const globalMatch = !normalizedGlobalSearch || searchText.includes(normalizedGlobalSearch);
      return typeMatch && searchMatch && globalMatch;
    });

    return (
      <section className="module-panel">
        <header className="module-header">
          <div>
            <h1>Templates</h1>
            <p>Browse clean template cards by type, case, and scenario.</p>
          </div>
        </header>

        {successText && <div className="inline-note success">{successText}</div>}
        {errorText && <div className="inline-note error">{errorText}</div>}

        <div className="filters-row">
          <select value={templateType} onChange={(event) => setTemplateType(event.target.value)}>
            <option value="All">All Types</option>
            <option value="Email">Email</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="WhatsApp">WhatsApp</option>
          </select>
          <input
            value={templateSearch}
            onChange={(event) => setTemplateSearch(event.target.value)}
            placeholder="Search templates"
          />
        </div>

        <div className="templates-grid">
          {filteredTemplates.map((template) => {
            const isExpanded = expandedTemplate === template.id;
            const cleanBody = normalizeTemplateText(template.body || "");
            const typeClass =
              template.type === "Email"
                ? "type-email"
                : template.type === "LinkedIn"
                  ? "type-linkedin"
                  : "type-whatsapp";

            return (
              <article key={template.id} className="template-card">
                <header>
                  <div>
                    <h4>{template.name}</h4>
                    <p className="muted">Case {template.case} · {template.sub}</p>
                    <span className={`chip ${typeClass}`}>{template.type}</span>
                  </div>
                </header>

                {template.type === "Email" && template.subject && (
                  <p className="muted"><strong>Subject:</strong> {template.subject}</p>
                )}

                <p className="muted">
                  {isExpanded ? cleanBody : `${cleanBody.slice(0, 170)}...`}
                </p>

                <div className="control-row">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTemplate((current) => (current === template.id ? null : template.id))
                    }
                  >
                    {isExpanded ? "Collapse" : "Preview"}
                  </button>
                  <button type="button" onClick={() => handleCopyTemplate(cleanBody)}>
                    Copy
                  </button>
                </div>
              </article>
            );
          })}

          {filteredTemplates.length === 0 && <p className="muted">No templates found for this type.</p>}
        </div>

        <section className="archive-panel">
          <h3>Archive Templates (Exact Content)</h3>
          <p className="muted">Read-only view from archived ZIP data. No edits applied.</p>

          <div className="filters-row">
            <select
              value={archiveSelectedPath}
              onChange={(event) => setArchiveSelectedPath(event.target.value)}
              disabled={archiveLoading || archiveFiles.length === 0}
            >
              {archiveFiles.length === 0 && <option value="">No archive files found</option>}
              {archiveFiles.map((file) => (
                <option key={file.path} value={file.path}>
                  {file.path}
                </option>
              ))}
            </select>
            <button type="button" onClick={loadArchiveFiles} disabled={archiveLoading}>
              {archiveLoading ? "Loading..." : "Reload Files"}
            </button>
            <button type="button" onClick={handleLoadArchiveContent} disabled={!archiveSelectedPath}>
              View Selected File
            </button>
          </div>

          {archiveContent && <pre className="archive-content">{archiveContent}</pre>}
        </section>
      </section>
    );
  }

  function renderInterviewPrepView() {
    return (
      <section className="module-panel">
        <header className="module-header">
          <div>
            <h1>Interview Prep</h1>
            <p>Save STAR answers and preparation notes per question.</p>
          </div>
        </header>

        <div className="filters-row">
          <select value={questionFilter} onChange={(event) => setQuestionFilter(event.target.value)}>
            <option value="All">All Categories</option>
            <option value="Technical">Technical</option>
            <option value="System Design">System Design</option>
            <option value="Behavioral">Behavioral</option>
          </select>
        </div>

        <div className="question-list">
          {filteredQuestions.map((question) => (
            <article key={question.id} className="question-card">
              <header>
                <h4>{question.text}</h4>
                <span className="chip">
                  {question.category} · {question.difficulty}
                </span>
              </header>
              <textarea
                value={interviewAnswers[question.id] || ""}
                onChange={(event) => handleAnswerChange(question.id, event.target.value)}
                placeholder="Write your answer here..."
              />
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderOutreachView() {
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

        <form className="outreach-form" onSubmit={handleAddOutreach}>
          <input
            value={outreachForm.contact}
            onChange={(event) => handleOutreachInput("contact", event.target.value)}
            placeholder="Contact *"
          />
          <input
            value={outreachForm.company}
            onChange={(event) => handleOutreachInput("company", event.target.value)}
            placeholder="Company *"
          />
          <select value={outreachForm.method} onChange={(event) => handleOutreachInput("method", event.target.value)}>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Email">Email</option>
            <option value="WhatsApp">WhatsApp</option>
          </select>
          <select value={outreachForm.status} onChange={(event) => handleOutreachInput("status", event.target.value)}>
            <option value="Sent">Sent</option>
            <option value="Replied">Replied</option>
            <option value="No Response">No Response</option>
            <option value="Scheduled">Scheduled</option>
          </select>
          <input
            className="outreach-notes"
            value={outreachForm.notes}
            onChange={(event) => handleOutreachInput("notes", event.target.value)}
            placeholder="Notes"
          />
          <button type="submit">Add Outreach</button>
        </form>

        <div className="outreach-list">
          {outreachEntries.map((entry) => (
            <article key={entry.id} className="outreach-card">
              <header>
                <h4>{entry.contact}</h4>
                <span className="chip">{entry.method}</span>
              </header>
              <p>
                <strong>{entry.company}</strong>
              </p>
              {entry.notes && <p className="muted">{entry.notes}</p>}
              <div className="control-row">
                <select
                  value={entry.status}
                  onChange={(event) => handleUpdateOutreachStatus(entry.id, event.target.value)}
                >
                  <option value="Sent">Sent</option>
                  <option value="Replied">Replied</option>
                  <option value="No Response">No Response</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
                <button type="button" className="danger-btn" onClick={() => handleDeleteOutreach(entry.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
          {outreachEntries.length === 0 && <p className="muted">No outreach entries yet.</p>}
        </div>
      </section>
    );
  }

  function renderRemindersView() {
    const reminderEventsCount = sortedReminders.filter((reminder) => Boolean(reminder.dueDate)).length;
    const interviewEventsCount = interviewCalendarEvents.length;

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
            <button type="button" onClick={handleExportAllCalendar}>
              Export Calendar (.ics)
            </button>
            <button type="button" onClick={handleSendReminderHooks} disabled={sendingReminderHooks}>
              {sendingReminderHooks ? "Sending Hooks..." : "Send Due Reminder Hooks"}
            </button>
          </div>
        </header>

        {successText && <div className="inline-note success">{successText}</div>}
        {errorText && <div className="inline-note error">{errorText}</div>}

        <form className="reminder-form" onSubmit={handleAddReminder}>
          <input
            value={reminderForm.title}
            onChange={(event) => handleReminderInput("title", event.target.value)}
            placeholder="Reminder title *"
          />
          <input
            type="date"
            value={reminderForm.dueDate}
            onChange={(event) => handleReminderInput("dueDate", event.target.value)}
          />
          <select value={reminderForm.type} onChange={(event) => handleReminderInput("type", event.target.value)}>
            <option value="Follow Up">Follow Up</option>
            <option value="Apply Deadline">Apply Deadline</option>
            <option value="Interview Prep">Interview Prep</option>
            <option value="Other">Other</option>
          </select>
          <button type="submit">Add Reminder</button>
        </form>

        <div className="reminder-list">
          {filteredReminders.map((reminder) => {
            const isOverdue = !reminder.completed && reminder.dueDate < new Date().toISOString().slice(0, 10);
            return (
              <article key={reminder.id} className={`reminder-card ${isOverdue ? "overdue" : ""}`}>
                <header>
                  <h4>{reminder.title}</h4>
                  <span className="chip">{reminder.type}</span>
                </header>
                <p>Due: {reminder.dueDate}</p>
                <div className="control-row">
                  <button type="button" onClick={() => handleToggleReminder(reminder.id)}>
                    {reminder.completed ? "Mark Pending" : "Mark Complete"}
                  </button>
                  <button type="button" className="danger-btn" onClick={() => handleDeleteReminder(reminder.id)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
          {filteredReminders.length === 0 && <p className="muted">No reminders yet.</p>}
        </div>
      </section>
    );
  }

  function renderAtsCheckerView() {
    return (
      <section className="module-panel">
        <header className="module-header">
          <div>
            <h1>ATS Checker</h1>
            <p>Paste resume and JD text to evaluate keyword match and improvement ideas.</p>
          </div>
        </header>

        {successText && <div className="inline-note success">{successText}</div>}
        {errorText && <div className="inline-note error">{errorText}</div>}

        <div className="ats-grid">
          <textarea
            value={atsResume}
            onChange={(event) => setAtsResume(event.target.value)}
            placeholder="Paste resume text"
          />
          <textarea
            value={atsJobDescription}
            onChange={(event) => setAtsJobDescription(event.target.value)}
            placeholder="Paste job description text"
          />
        </div>

        <div className="control-row">
          <button type="button" onClick={runAtsCheck}>
            Run ATS Check
          </button>
        </div>

        {atsResult && (
          <section className="ats-result">
            <h3>Score: {atsResult.score}%</h3>
            <p>{atsResult.suggestion}</p>
            <div className="ats-columns">
              <div>
                <h4>Matched Keywords</h4>
                <p className="muted">{atsResult.matched.join(", ") || "None"}</p>
              </div>
              <div>
                <h4>Missing Keywords</h4>
                <p className="muted">{atsResult.missing.join(", ") || "None"}</p>
              </div>
            </div>
          </section>
        )}
      </section>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h2>Job Search Hub</h2>
          <p>Manikanth Nampally</p>
          <input
            value={globalSearchQuery}
            onChange={(event) => setGlobalSearchQuery(event.target.value)}
            placeholder="Global search"
          />
        </div>

        <nav className="menu">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              className={`menu-item ${activeView === item ? "active" : ""}`}
              onClick={() => handleViewChange(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>MS FAU · GPA 3.9</p>
          <p>Graduating May 2026</p>
        </div>
      </aside>

      <main className="content">
        {activeView === "Dashboard" && renderDashboardView()}
        {activeView === "Job Tracker" && renderJobTrackerView()}
        {activeView === "Contacts" && renderContactsView()}
        {activeView === "Templates" && renderTemplatesView()}
        {activeView === "Interview Prep" && renderInterviewPrepView()}
        {activeView === "Outreach" && renderOutreachView()}
        {activeView === "Reminders" && renderRemindersView()}
        {activeView === "ATS Checker" && renderAtsCheckerView()}
        {!NAV_ITEMS.includes(activeView) &&
          renderPlaceholderView()}
      </main>
    </div>
  );
}
