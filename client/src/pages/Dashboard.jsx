import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  BACKEND_URL,
  createContact,
  disconnectGmail,
  getAuthStatus,
  getHealth,
  getJobs,
  getResumes,
  getWeeklyAnalytics,
  getContacts,
  getReminders,
  getOutreach,
  syncJobs,
  getSyncStatus,
} from "../api/backend";
import { mergeEmails } from "../utils/emailUtils";
import JobTrackerView from "../components/views/JobTrackerView";
import ContactsView from "../components/views/ContactsView";
import TemplatesView from "../components/views/TemplatesView";
import InterviewPrepView from "../components/views/InterviewPrepView";
import OutreachView from "../components/views/OutreachView";
import RemindersView from "../components/views/RemindersView";
import DashboardHomeView from "../components/views/DashboardHomeView";
import { ResumesManager } from "../components/ResumesManager";
import { INTERVIEW_QUESTIONS } from "./dashboard/interviewData";
import { getPathForView, NAV_ITEMS } from "./dashboard/routeConfig";
import { useJobActions } from "../hooks/useJobActions";
import { useContactActions, normalizeContactForUI } from "../hooks/useContactActions";
import { useOutreachActions, normalizeOutreachForUI } from "../hooks/useOutreachActions";
import { useReminderActions } from "../hooks/useReminderActions";
import { useTemplateActions } from "../hooks/useTemplateActions";

const PIPELINE_ORDER = ["Wishlist", "Applied", "Screening", "Interview", "Offer", "Rejected"];
const EMAIL_READ_STORAGE_KEY = "jsa_v2";
const INTERVIEW_STORAGE_KEY = "jsh_interview_answers_v1";

export function DashboardPage({ routeView = "Dashboard" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeView, setActiveView] = useState(routeView);
  const [isHealthy, setIsHealthy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [outreachEntries, setOutreachEntries] = useState([]);
  const [weeklySummaryApi, setWeeklySummaryApi] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [jobSmartView, setJobSmartView] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [questionFilter, setQuestionFilter] = useState("All");
  const [templateType, setTemplateType] = useState("All");
  const [templateSearch, setTemplateSearch] = useState("");
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  const connectedFromCallback = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("connected") === "true";
  }, [location.search]);

  const userDisplayName = String(user?.name || "").trim() || String(user?.email || "").trim() || "there";
  const firstName = userDisplayName.split(" ")[0] || userDisplayName;
  const userScopedEmailReadKey = `${EMAIL_READ_STORAGE_KEY}:${user?.id || "guest"}`;
  const userScopedInterviewKey = `${INTERVIEW_STORAGE_KEY}:${user?.id || "guest"}`;

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentHour(new Date().getHours()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  const greetingText = useMemo(() => {
    if (currentHour < 12) return "Good morning";
    if (currentHour < 18) return "Good afternoon";
    return "Good evening";
  }, [currentHour]);

  useEffect(() => {
    if (routeView !== activeView) setActiveView(routeView);
  }, [routeView]);

  const normalizedGlobalSearch = globalSearchQuery.trim().toLowerCase();

  // --- Hooks ---
  const jobActions = useJobActions({
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
  });

  const contactActions = useContactActions({
    contacts,
    setContacts,
    setErrorText,
    setSuccessText,
    normalizedGlobalSearch,
  });

  const outreachActions = useOutreachActions({
    outreachEntries,
    setOutreachEntries,
    setErrorText,
    setSuccessText,
  });

  const interviewCalendarEvents = useMemo(
    () =>
      jobs.flatMap((job) => {
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
      }),
    [jobs]
  );

  const reminderActions = useReminderActions({
    reminders,
    setReminders,
    setErrorText,
    setSuccessText,
    normalizedGlobalSearch,
    interviewCalendarEvents,
  });

  const templateActions = useTemplateActions({ setErrorText, setSuccessText });

  // --- Derived state ---
  const pipelineColumns = PIPELINE_ORDER.map((status) => ({
    status,
    jobs: jobs.filter((job) => (job.status || "Wishlist") === status),
  }));

  const stats = {
    total: jobs.length,
    active: jobs.filter((job) => !["Rejected", "Offer"].includes(job.status || "")).length,
    interviews: jobs.filter((job) => job.status === "Interview").length,
    offers: jobs.filter((job) => job.status === "Offer").length,
    contacts: jobs.filter((job) => Boolean(job.recruiterName)).length,
  };

  const recentApplications = jobs.slice(0, 3);
  const upcomingFollowUps = jobs
    .filter((job) => ["Applied", "Screening", "Interview"].includes(job.status || ""))
    .slice(0, 3);

  const weeklySummaryDisplay = weeklySummaryApi || {
    applicationsThisWeek: 0,
    responsesThisWeek: 0,
    interviewsThisWeek: 0,
    stalledJobs: 0,
  };

  const filteredQuestions = INTERVIEW_QUESTIONS.filter(
    (question) => questionFilter === "All" || question.category === questionFilter
  );

  // --- Data loading ---
  function mergeJobsById(currentJobs, incomingJobs) {
    const currentById = new Map((currentJobs || []).map((job) => [job.id, job]));
    const merged = [];

    for (const incomingJob of incomingJobs || []) {
      const existing = currentById.get(incomingJob.id);
      const mergedEmails = mergeEmails(
        existing?.emails || [],
        incomingJob.emails || [],
        jobActions.emailReadMap
      );
      merged.push({ ...(existing || {}), ...incomingJob, emails: mergedEmails });
      currentById.delete(incomingJob.id);
    }

    for (const leftover of currentById.values()) {
      merged.push({ ...leftover, emails: mergeEmails(leftover.emails || [], [], jobActions.emailReadMap) });
    }

    return merged;
  }

  async function syncAutoContactsToApi(currentContacts, sourceJobs) {
    const existingContacts = Array.isArray(currentContacts) ? currentContacts : [];
    const byEmail = new Set(
      existingContacts.map((c) => String(c.email || "").trim().toLowerCase()).filter(Boolean)
    );
    const byNameCompany = new Set(
      existingContacts
        .map((c) => {
          const name = String(c.name || "").trim().toLowerCase();
          const company = String(c.company || "").trim().toLowerCase();
          return name && company ? `${name}::${company}` : "";
        })
        .filter(Boolean)
    );

    const createdContacts = [];

    for (const job of sourceJobs || []) {
      const recruiterName = String(job?.recruiterName || "").trim();
      const recruiterEmail = String(job?.recruiterEmail || "").trim();
      const company = String(job?.company || "").trim();
      if (!recruiterName || !company) continue;

      const normalizedEmail = recruiterEmail.toLowerCase();
      const normalizedNameCompany = `${recruiterName.toLowerCase()}::${company.toLowerCase()}`;
      if ((normalizedEmail && byEmail.has(normalizedEmail)) || byNameCompany.has(normalizedNameCompany)) continue;

      try {
        const payload = {
          name: recruiterName,
          company,
          email: recruiterEmail,
          role: "Recruiter",
          source: "sync",
          notes: `Auto-created from job sync: ${job.role || "Unknown Role"}`,
          linkedin_url: "",
          phone: "",
        };
        const result = await createContact(payload);
        if (!result?.success || !result?.data) continue;
        createdContacts.push(normalizeContactForUI(result.data));
      } catch {
        continue;
      }

      if (normalizedEmail) byEmail.add(normalizedEmail);
      byNameCompany.add(normalizedNameCompany);
    }

    if (createdContacts.length === 0) return { nextContacts: existingContacts, addedCount: 0 };
    return { nextContacts: [...createdContacts, ...existingContacts], addedCount: createdContacts.length };
  }

  async function loadDashboard() {
    setErrorText("");
    setSuccessText("");
    setLoading(true);

    try {
      const [health, auth, jobsPayload, weeklyAnalytics, resumesPayload, contactsResult, remindersResult, outreachResult] =
        await Promise.all([
          getHealth(),
          getAuthStatus(),
          getJobs(),
          getWeeklyAnalytics().catch(() => null),
          getResumes().catch(() => ({ resumes: [] })),
          getContacts().catch(() => ({ data: [] })),
          getReminders().catch(() => ({ data: [] })),
          getOutreach().catch(() => ({ data: [] })),
        ]);

      setIsHealthy(health.status === "ok");
      setConnected(Boolean(auth.connected));
      setLastChecked(jobsPayload.lastChecked || auth.lastChecked || null);

      const mergedJobs = mergeJobsById(jobs, jobsPayload.jobs || []);
      setJobs(mergedJobs);

      const resumeItems = Array.isArray(resumesPayload)
        ? resumesPayload
        : Array.isArray(resumesPayload?.resumes)
          ? resumesPayload.resumes
          : [];
      setResumes(
        resumeItems.map((item) => ({
          ...item,
          linkedJobId: item?.linkedJobId ?? item?.job_id ?? item?.jobId ?? null,
        }))
      );

      if (weeklyAnalytics) setWeeklySummaryApi(weeklyAnalytics);

      const apiContacts = (contactsResult.data || []).map(normalizeContactForUI);
      setContacts(apiContacts);
      setReminders(remindersResult.data || []);
      setOutreachEntries((outreachResult.data || []).map(normalizeOutreachForUI));

      const autoContactResult = await syncAutoContactsToApi(apiContacts, mergedJobs);
      if (autoContactResult.addedCount > 0) setContacts(autoContactResult.nextContacts);

      if (!auth.connected && (jobsPayload.jobs || []).length === 0) {
        setSuccessText("Connected UI is ready. Connect Gmail to start importing real jobs.");
      }
    } catch (error) {
      setIsHealthy(false);
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
      const started = await syncJobs();
      if (started?.error && !started?.isSyncing) {
        throw new Error(started.error);
      }

      // Poll until sync finishes (max 10 minutes)
      await new Promise((resolve) => {
        const deadline = Date.now() + 10 * 60 * 1000;
        const poll = setInterval(async () => {
          try {
            const status = await getSyncStatus();
            if (!status.isSyncing || Date.now() >= deadline) {
              clearInterval(poll);
              resolve();
            }
          } catch {
            clearInterval(poll);
            resolve();
          }
        }, 2000);
      });

      // Reload jobs after sync completes
      const payload = await getJobs();
      const mergedJobs = mergeJobsById(jobs, payload.jobs || []);
      setJobs(mergedJobs);

      const autoContactResult = await syncAutoContactsToApi(contacts, mergedJobs);
      if (autoContactResult.addedCount > 0) setContacts(autoContactResult.nextContacts);

      setLastChecked(payload.lastChecked || null);
      setSuccessText(
        autoContactResult.addedCount > 0
          ? `Sync completed. ${autoContactResult.addedCount} recruiter contact(s) auto-added.`
          : "Sync completed."
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

  function handleConnectGmail() {
    const userId = user?.id || "";
    window.location.href = `${BACKEND_URL}/auth/gmail?userId=${encodeURIComponent(userId)}`;
  }

  function handleViewChange(view) {
    setActiveView(view);
    const nextPath = getPathForView(view);
    if (location.pathname !== nextPath) navigate(nextPath);
  }

  function handleProfileOpen() {
    navigate("/profile");
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    jobActions.resetJobState();
    setContacts([]);
    setReminders([]);
    setOutreachEntries([]);
    jobActions.loadPersistedState();
    loadDashboard();
  }, [user?.id]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h2>Job Search Hub</h2>
          <p>{userDisplayName}</p>
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
          <p>{userDisplayName}</p>
          {user?.bio ? <p>{user.bio}</p> : null}
          <div className="sidebar-account-actions">
            <button type="button" onClick={handleProfileOpen}>Profile</button>
            <button type="button" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </aside>

      <main className="content">
        {activeView === "Dashboard" && (
          <DashboardHomeView
            greetingText={greetingText}
            firstName={firstName}
            isHealthy={isHealthy}
            BACKEND_URL={BACKEND_URL}
            loading={loading}
            syncing={syncing}
            connected={connected}
            connectedFromCallback={connectedFromCallback}
            successText={successText}
            errorText={errorText}
            stats={stats}
            weeklySummaryDisplay={weeklySummaryDisplay}
            recentApplications={recentApplications}
            upcomingFollowUps={upcomingFollowUps}
            needsFollowUpJobs={jobActions.needsFollowUpJobs}
            pipelineColumns={pipelineColumns}
            onRefresh={loadDashboard}
            onConnectGmail={handleConnectGmail}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
          />
        )}
        {activeView === "Job Tracker" && (
          <JobTrackerView
            jobs={jobs}
            filteredJobs={jobActions.filteredJobs}
            jobTrackerColumns={jobActions.jobTrackerColumns}
            resumes={resumes}
            loading={loading}
            syncing={syncing}
            connected={connected}
            expandedJobs={jobActions.expandedJobs}
            activeDetailTab={jobActions.activeDetailTab}
            draggedJobId={jobActions.draggedJobId}
            activeEmailModal={jobActions.activeEmailModal}
            editingJobId={jobActions.editingJobId}
            jobForm={jobActions.jobForm}
            searchQuery={searchQuery}
            jobSmartView={jobSmartView}
            statusFilter={statusFilter}
            successText={successText}
            errorText={errorText}
            onToggleJobExpanded={jobActions.toggleJobExpanded}
            onSetJobDetailTab={jobActions.setJobDetailTab}
            onJobDragStart={jobActions.handleJobDragStart}
            onJobDragEnd={jobActions.handleJobDragEnd}
            onStatusChange={jobActions.handleStatusChange}
            onEditJob={jobActions.handleEditJob}
            onMarkImported={jobActions.handleMarkImported}
            onDelete={jobActions.handleDelete}
            onSaveJob={jobActions.handleSaveJob}
            onJobInput={jobActions.handleJobInput}
            onCancelEditJob={jobActions.handleCancelEditJob}
            onSync={handleSync}
            onLoadDashboard={loadDashboard}
            onAttachResume={jobActions.handleAttachResume}
            onEmailCardDoubleClick={jobActions.handleEmailCardDoubleClick}
            onCloseEmailModal={jobActions.closeEmailModal}
            onSearchChange={setSearchQuery}
            onSmartViewChange={setJobSmartView}
            onStatusFilterChange={setStatusFilter}
            mergeEmails={mergeEmails}
            getStatusChipClass={jobActions.getStatusChipClass}
            getEmailTypeClass={jobActions.getEmailTypeClass}
            formatEmailDate={jobActions.formatEmailDate}
            getEmailIdentity={jobActions.getEmailIdentity}
          />
        )}
        {activeView === "Contacts" && (
          <ContactsView
            contacts={contacts}
            filteredContacts={contactActions.filteredContacts}
            contactForm={contactActions.contactForm}
            contactSearch={contactActions.contactSearch}
            contactRelationship={contactActions.contactRelationship}
            editingContactId={contactActions.editingContactId}
            editContactForm={contactActions.editContactForm}
            successText={successText}
            errorText={errorText}
            onAddContact={contactActions.handleAddContact}
            onContactInput={contactActions.handleContactInput}
            onSearchChange={contactActions.setContactSearch}
            onRelationshipFilterChange={contactActions.setContactRelationship}
            onDeleteContact={contactActions.handleDeleteContact}
            onStartEditContact={contactActions.handleStartEditContact}
            onContactEditInput={contactActions.handleContactEditInput}
            onSaveContact={contactActions.handleSaveContact}
            onCancelEditContact={contactActions.handleCancelEditContact}
          />
        )}
        {activeView === "Resume Manager" && (
          <ResumesManager resumes={resumes} jobs={jobs} onRefresh={loadDashboard} />
        )}
        {activeView === "Templates" && (
          <TemplatesView
            templateType={templateType}
            templateSearch={templateSearch}
            expandedTemplate={expandedTemplate}
            archiveSelectedPath={templateActions.archiveSelectedPath}
            archiveLoading={templateActions.archiveLoading}
            archiveFiles={templateActions.archiveFiles}
            archiveContent={templateActions.archiveContent}
            successText={successText}
            errorText={errorText}
            normalizedGlobalSearch={normalizedGlobalSearch}
            onTemplateTypeChange={setTemplateType}
            onTemplateSearchChange={setTemplateSearch}
            onTemplateToggle={(templateId) =>
              setExpandedTemplate((current) => (current === templateId ? null : templateId))
            }
            onCopyTemplate={templateActions.handleCopyTemplate}
            onArchivePathChange={templateActions.setArchiveSelectedPath}
            onLoadArchiveFiles={templateActions.loadArchiveFiles}
            onLoadArchiveContent={templateActions.handleLoadArchiveContent}
            normalizeTemplateText={templateActions.normalizeTemplateText}
          />
        )}
        {activeView === "Interview Prep" && (
          <InterviewPrepView
            filteredQuestions={filteredQuestions}
            questionFilter={questionFilter}
            interviewAnswers={jobActions.interviewAnswers}
            onQuestionFilterChange={setQuestionFilter}
            onAnswerChange={jobActions.handleAnswerChange}
          />
        )}
        {activeView === "Outreach" && (
          <OutreachView
            outreachForm={outreachActions.outreachForm}
            outreachEntries={outreachEntries}
            successText={successText}
            errorText={errorText}
            onAddOutreach={outreachActions.handleAddOutreach}
            onOutreachInput={outreachActions.handleOutreachInput}
            onUpdateOutreachStatus={outreachActions.handleUpdateOutreachStatus}
            onDeleteOutreach={outreachActions.handleDeleteOutreach}
          />
        )}
        {activeView === "Reminders" && (
          <RemindersView
            sortedReminders={reminderActions.sortedReminders}
            filteredReminders={reminderActions.filteredReminders}
            reminderForm={reminderActions.reminderForm}
            successText={successText}
            errorText={errorText}
            sendingReminderHooks={reminderActions.sendingReminderHooks}
            interviewCalendarEvents={interviewCalendarEvents}
            onAddReminder={reminderActions.handleAddReminder}
            onReminderInput={reminderActions.handleReminderInput}
            onToggleReminder={reminderActions.handleToggleReminder}
            onDeleteReminder={reminderActions.handleDeleteReminder}
            onExportAllCalendar={reminderActions.handleExportAllCalendar}
            onSendReminderHooks={reminderActions.handleSendReminderHooks}
          />
        )}
        {!NAV_ITEMS.includes(activeView) && (
          <section className="module-panel">
            <h1>{activeView}</h1>
            <p className="muted">
              This module shell is ready. Next step is wiring full API-backed CRUD for {activeView}.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
