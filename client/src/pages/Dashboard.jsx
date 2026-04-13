import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  MdDashboard, MdWork, MdDescription, MdPeople, MdEmail, MdPsychology,
  MdCampaign, MdNotifications, MdSearch, MdPerson, MdLogout, MdSettings,
  MdSync, MdStar, MdShieldMoon,
} from "react-icons/md";
import { TierBadge } from "../components/shared/TierBadge";
import {
  BACKEND_URL,
  createContact,
  deleteOtherSessions,
  deleteSession,
  disconnectGmail,
  getAuthStatus,
  getHealth,
  getJobs,
  getResumes,
  getWeeklyAnalytics,
  getDailyAnalytics,
  getContacts,
  getReminders,
  getOutreach,
  getSessions,
  startGmailOAuthFlow,
  syncJobs,
  getSyncStatus,
  updateMyProfile,
  disableMFA,
} from "../api/backend";
import { mergeEmails } from "../utils/emailUtils";
import JobTrackerView from "../components/views/JobTrackerView";
import ContactsView from "../components/views/ContactsView";
import TemplatesView from "../components/views/TemplatesView";
import InterviewPrepView from "../components/views/InterviewPrepView";
import OutreachView from "../components/views/OutreachView";
import RemindersView from "../components/views/RemindersView";
import DashboardHomeView from "../components/views/DashboardHomeView";
import { SettingsPage } from "../components/views/SettingsPage";
import { ResumesManager } from "../components/ResumesManager";
import { INTERVIEW_QUESTIONS } from "./dashboard/interviewData";
import { getPathForView, NAV_ITEMS } from "./dashboard/routeConfig";
import { useJobActions } from "../hooks/useJobActions";
import { useContactActions, normalizeContactForUI } from "../hooks/useContactActions";
import { useOutreachActions, normalizeOutreachForUI } from "../hooks/useOutreachActions";
import { useReminderActions } from "../hooks/useReminderActions";
import { useTemplateActions } from "../hooks/useTemplateActions";
import { CommandPalette } from "../components/layout/CommandPalette";
import { MobileTabBar } from "../components/layout/MobileTabBar";
import { useUIStore } from "../stores/uiStore";

const PIPELINE_ORDER = ["Wishlist", "Applied", "Screening", "Interview", "Offer", "Rejected"];
const EMAIL_READ_STORAGE_KEY = "jsa_v2";
const INTERVIEW_STORAGE_KEY = "jsh_interview_answers_v1";

const NAV_ICONS = {
  "Dashboard":      <MdDashboard size={17} />,
  "Job Tracker":    <MdWork size={17} />,
  "Resume Manager": <MdDescription size={17} />,
  "Contacts":       <MdPeople size={17} />,
  "Templates":      <MdEmail size={17} />,
  "Interview Prep": <MdPsychology size={17} />,
  "Outreach":       <MdCampaign size={17} />,
  "Reminders":      <MdNotifications size={17} />,
  "Settings":       <MdSettings size={17} />,
};

const NAV_GROUPS = [
  { label: "Dashboard", items: ["Dashboard", "Job Tracker"] },
  { label: "Network",   items: ["Contacts", "Outreach"] },
  { label: "Toolkit",   items: ["Resume Manager", "Templates", "Interview Prep", "Reminders"] },
  { label: "System",    items: ["Settings"] },
];

export function DashboardPage({ routeView = "Dashboard" }) {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const openModal = useUIStore((s) => s.openModal);
  const toastError = useUIStore((s) => s.error);

  const [activeView, setActiveView] = useState(routeView);
  const [isHealthy, setIsHealthy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [gmailSyncAllowed, setGmailSyncAllowed] = useState(true);
  const [settingsSessions, setSettingsSessions] = useState([]);
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
  const [dailyApplicationsSeries, setDailyApplicationsSeries] = useState([]);
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
    return (
      params.get("connected") === "true" ||
      params.get("gmail_connected") === "true"
    );
  }, [location.search]);

  const userDisplayName = String(user?.name || "").trim() || String(user?.email || "").trim() || "there";
  const firstName = userDisplayName.split(" ")[0] || userDisplayName;
  /** Sidebar: first line is first name only; avatar gradient seed uses full display name */
  const sidebarCandidateName = String(user?.name || "").trim() || "Member";
  const sidebarFirstName =
    (String(user?.name || "").trim() && String(user?.name || "").trim().split(/\s+/)[0]) ||
    firstName ||
    "Member";
  const sidebarHeadline = String(user?.headline || "").trim();
  const sidebarTagline = sidebarHeadline
    ? `Looking for roles (${sidebarHeadline})`
    : "Add your target role in Profile";
  const sidebarInitial = (sidebarFirstName.charAt(0) || "M").toUpperCase();
  const sidebarAvatarUrl = String(user?.avatar_url || user?.photo_url || "").trim();

  const sidebarAvatarFallbackStyle = useMemo(() => {
    let h = 0;
    const seed = sidebarCandidateName || "user";
    for (let i = 0; i < seed.length; i += 1) {
      h = seed.charCodeAt(i) + ((h << 5) - h);
    }
    const hue = Math.abs(h) % 360;
    const hue2 = (hue + 48) % 360;
    return {
      background: `linear-gradient(135deg, hsl(${hue}, 58%, 42%) 0%, hsl(${hue2}, 52%, 32%) 100%)`,
    };
  }, [sidebarCandidateName]);
  const userScopedEmailReadKey = `${EMAIL_READ_STORAGE_KEY}:${user?.id || "guest"}`;
  const userScopedInterviewKey = `${INTERVIEW_STORAGE_KEY}:${user?.id || "guest"}`;

  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentHour(new Date().getHours()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggleCommandPalette]);

  const greetingText = useMemo(() => {
    if (currentHour < 12) return "Good morning";
    if (currentHour < 18) return "Good afternoon";
    return "Good evening";
  }, [currentHour]);

  useEffect(() => {
    if (routeView !== activeView) setActiveView(routeView);
  }, [routeView]);

  useEffect(() => {
    if (activeView !== "Settings") return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await getSessions();
        if (!cancelled) setSettingsSessions(data.sessions || []);
      } catch {
        if (!cancelled) setSettingsSessions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeView]);

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
      const [health, auth, jobsPayload, weeklyAnalytics, dailyAnalytics, resumesPayload, contactsResult, remindersResult, outreachResult] =
        await Promise.all([
          getHealth(),
          getAuthStatus(),
          getJobs(),
          getWeeklyAnalytics().catch(() => null),
          getDailyAnalytics(7).catch(() => null),
          getResumes().catch(() => ({ resumes: [] })),
          getContacts().catch(() => ({ data: [] })),
          getReminders().catch(() => ({ data: [] })),
          getOutreach().catch(() => ({ data: [] })),
        ]);

      setIsHealthy(health.status === "ok");
      setConnected(Boolean(auth.connected));
      setLastChecked(jobsPayload.lastChecked || auth.lastChecked || null);
      setGmailSyncAllowed(
        Object.prototype.hasOwnProperty.call(auth, "gmailSyncAllowed")
          ? Boolean(auth.gmailSyncAllowed)
          : true
      );

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
      if (dailyAnalytics?.series) setDailyApplicationsSeries(dailyAnalytics.series);

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

  async function handleSync(options = {}) {
    const fullWindow = Boolean(options.fullWindow);
    const lookbackDays =
      options.lookbackDays != null && Number.isFinite(Number(options.lookbackDays))
        ? Math.min(365, Math.max(1, Math.floor(Number(options.lookbackDays))))
        : undefined;
    setSyncing(true);
    setErrorText("");
    setSuccessText("");

    try {
      // Force one-time reprocess so previously skipped/failed emails can be reconsidered.
      const started = await syncJobs({
        forceReprocess: true,
        fullWindow,
        processAll: true,
        ...(lookbackDays != null ? { lookbackDays } : {}),
      });
      if (started?.error && !started?.isSyncing) {
        throw new Error(started.error);
      }

      // Poll until sync finishes (max 10 minutes).
      // We must not treat "isSyncing: false" on the first tick as completion before the server sets the lock.
      // POST already returned { started: true } — treat that as "a sync was requested" and wait until idle.
      let finalStatus = null;
      await new Promise((resolve) => {
        const deadline = Date.now() + 10 * 60 * 1000;
        let sawSyncActivity = Boolean(started?.started);
        let pollTimer = null;

        const finish = (status) => {
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          finalStatus = status;
          resolve();
        };

        const tick = async () => {
          try {
            const status = await getSyncStatus();
            if (status?.isSyncing) {
              sawSyncActivity = true;
            }
            const timedOut = Date.now() >= deadline;
            const idleAfterStart = sawSyncActivity && !status?.isSyncing;
            if (timedOut || idleAfterStart) {
              finish(status);
            }
          } catch {
            finish({ isSyncing: false, lastResult: null });
          }
        };

        tick();
        pollTimer = setInterval(tick, 500);
      });

      if (finalStatus?.lastResult?.error) {
        throw new Error(`Sync failed: ${finalStatus.lastResult.error}. Reconnect Gmail and try again.`);
      }

      // Reload jobs after sync completes (functional update avoids stale closure over `jobs`)
      const payload = await getJobs();
      const incoming = payload.jobs || [];
      let mergedSnapshot = [];
      setJobs((prev) => {
        mergedSnapshot = mergeJobsById(prev, incoming);
        return mergedSnapshot;
      });

      const autoContactResult = await syncAutoContactsToApi(contacts, mergedSnapshot);
      if (autoContactResult.addedCount > 0) setContacts(autoContactResult.nextContacts);

      setLastChecked(payload.lastChecked || null);
      const processed = Number(finalStatus?.lastResult?.processed || 0);
      const moreInGmail = Boolean(finalStatus?.lastResult?.hasMoreGmailResults);
      const capHint = moreInGmail
        ? " Gmail has more matching messages than this run's limit (raise INITIAL_SYNC_MAX_MESSAGES or run sync again after jobs save)."
        : "";
      setSuccessText(
        autoContactResult.addedCount > 0
          ? `Sync completed${fullWindow ? " (wide window: last month of matching mail)" : ""}. ${processed} email(s) processed and ${autoContactResult.addedCount} recruiter contact(s) auto-added.${capHint}`
          : `Sync completed${fullWindow ? " (wide window: last month of matching mail)" : ""}. ${processed} email(s) processed.${capHint}`
      );
    } catch (error) {
      setErrorText(error.message || "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  function handleRunSyncPreset(preset) {
    const key = String(preset || "now").toLowerCase();
    if (key === "6m") return handleSync({ fullWindow: true, lookbackDays: 180 });
    if (key === "3m") return handleSync({ fullWindow: true, lookbackDays: 90 });
    if (key === "1m") return handleSync({ fullWindow: true, lookbackDays: 30 });
    if (key === "1w") return handleSync({ fullWindow: true, lookbackDays: 7 });
    if (key === "3d") return handleSync({ fullWindow: true, lookbackDays: 3 });
    if (key === "1d") return handleSync({ fullWindow: true, lookbackDays: 1 });
    return handleSync();
  }

  async function handleChangeDailyRange(days, customStartDate = null, customEndDate = null) {
    try {
      let dailyAnalytics;
      if (customStartDate && customEndDate) {
        // Custom date range
        dailyAnalytics = await getDailyAnalytics(customStartDate, customEndDate).catch(() => null);
      } else {
        // Preset days
        dailyAnalytics = await getDailyAnalytics(days).catch(() => null);
      }
      if (dailyAnalytics?.series) {
        setDailyApplicationsSeries(dailyAnalytics.series);
      }
    } catch (error) {
      console.error("Failed to fetch daily analytics for range:", error);
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

  async function handleConnectGmail() {
    setErrorText("");
    setSuccessText("");
    try {
      const body = await startGmailOAuthFlow();
      if (body?.redirectUrl) {
        window.location.href = body.redirectUrl;
      }
    } catch (err) {
      if (err.status === 402 && err.body?.error === "upgrade_required") {
        openModal("upgrade", {
          minTier: err.body.min_tier || "pro",
          feature: err.body.feature || "gmail_sync",
        });
        return;
      }
      const base = err.message || "Could not start Gmail connection.";
      const callbackUrl = `${BACKEND_URL}/auth/callback`;
      const hint =
        " If Google shows Error 400: redirect_uri_mismatch, open Google Cloud Console → APIs & Services → Credentials → your OAuth client → Authorized redirect URIs, and add exactly: " +
        callbackUrl +
        " (it must match REDIRECT_URI in your server .env).";
      setErrorText(base);
      toastError(base + hint, 12000);
    }
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
          <div className="brand-search-wrapper">
            <MdSearch className="brand-search-icon" size={15} />
            <input
              value={globalSearchQuery}
              onChange={(event) => setGlobalSearchQuery(event.target.value)}
              placeholder="Search everything..."
            />
          </div>
        </div>

        <nav className="menu" style={{ marginTop: "1.25rem" }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`menu-item ${activeView === item ? "active" : ""}`}
                  onClick={() => handleViewChange(item)}
                >
                  <span className="menu-item-icon">{NAV_ICONS[item]}</span>
                  {item}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="cc-tier-card">
            <div className="cc-tier-top">
              <span className="cc-tier-title">
                {user?.role === "elite" ? "Elite" : user?.role === "pro" ? "Pro" : "Free"} Tier
              </span>
              <MdStar size={14} style={{ color: "#fbbf24" }} />
            </div>
            <div className="cc-tier-copy">
              {user?.role === "free" ? "Upgrade to sync Gmail" : "Gmail sync active"}
            </div>
            <div className="cc-tier-bar">
              <div
                className="cc-tier-bar-fill"
                style={{ width: user?.role === "elite" ? "90%" : user?.role === "pro" ? "60%" : "20%" }}
              />
            </div>
          </div>

          <div className="sidebar-profile-card">
            <div
              className="sidebar-user-avatar"
              style={sidebarAvatarUrl ? undefined : sidebarAvatarFallbackStyle}
            >
              {sidebarAvatarUrl ? (
                <img src={sidebarAvatarUrl} alt="" className="sidebar-user-avatar-img" />
              ) : (
                <span className="sidebar-user-initial">{sidebarInitial}</span>
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{sidebarFirstName}</span>
              <span className="sidebar-user-tagline">{sidebarTagline}</span>
              <span className="sidebar-tier-row">
                <TierBadge tier={user?.role || "free"} size="sm" />
              </span>
            </div>
          </div>
          <div className="sidebar-account-actions">
            <button type="button" onClick={handleProfileOpen}>
              <MdPerson size={14} /> Profile
            </button>
            <button type="button" onClick={handleLogout}>
              <MdLogout size={14} /> Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="content-shell">
        {/* ── Topbar ─────────────────────────────────────────── */}
        <header className="cc-topbar">
          <div className="cc-topbar-title">
            {activeView === "Dashboard" ? "Command Center" : activeView}
          </div>
          <div className="cc-topbar-actions">
            {connected && (
              <div className="cc-badge-soft">
                <MdStar size={13} />
                Gemini AI Active
              </div>
            )}
            {user?.email && (
              <div className="cc-account-email">
                <MdEmail size={13} />
                {user.email}
              </div>
            )}
            {connected && gmailSyncAllowed && (
              <button
                type="button"
                className="cc-sync-btn"
                onClick={() => handleRunSyncPreset("now")}
                disabled={syncing}
              >
                <MdSync size={15} style={{ flexShrink: 0 }} />
                {syncing ? "Syncing…" : "Sync Inbox"}
              </button>
            )}
            <div
              className="cc-topbar-avatar"
              style={sidebarAvatarUrl ? undefined : sidebarAvatarFallbackStyle}
              onClick={handleProfileOpen}
              title="Open profile"
            >
              {sidebarAvatarUrl ? (
                <img src={sidebarAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "#fff" }}>{sidebarInitial}</span>
              )}
            </div>
          </div>
        </header>

        {/* ── Page scroll ────────────────────────────────────── */}
        <div className="cc-page-scroll">
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
            gmailSyncAllowed={gmailSyncAllowed}
            jobs={jobs}
            successText={successText}
            errorText={errorText}
            stats={stats}
            weeklySummaryDisplay={weeklySummaryDisplay}
            recentApplications={recentApplications}
            upcomingFollowUps={upcomingFollowUps}
            needsFollowUpJobs={jobActions.needsFollowUpJobs}
            pipelineColumns={pipelineColumns}
            dailyApplicationsSeries={dailyApplicationsSeries}
            onChangeDailyRange={handleChangeDailyRange}
            onRefresh={loadDashboard}
            onRunSyncPreset={handleRunSyncPreset}
            onNavigateView={handleViewChange}
            onOpenBilling={() => navigate("/billing")}
          />
        )}
        {activeView === "Settings" && (
          <SettingsPage
            user={{
              ...user,
              googleConnected: connected,
            }}
            mfaEnabled={Boolean(user?.totp_enabled)}
            sessions={settingsSessions}
            gmailSyncAllowed={gmailSyncAllowed}
            alertError={errorText}
            alertSuccess={successText}
            onOpenBilling={() => navigate("/billing")}
            onUpdateProfile={async ({ name }) => {
              await updateMyProfile({ name });
              await refreshUser();
            }}
            onEnableMFA={() => openModal("mfaSetup")}
            onDisableMFA={async () => {
              const code = window.prompt("Enter your authenticator code to turn off MFA.");
              if (!code?.trim()) return;
              await disableMFA(code.trim());
              await refreshUser();
            }}
            onEndSession={async (sessionId) => {
              await deleteSession(sessionId);
              const data = await getSessions();
              setSettingsSessions(data.sessions || []);
            }}
            onEndAllSessions={async () => {
              await deleteOtherSessions();
              const data = await getSessions();
              setSettingsSessions(data.sessions || []);
            }}
            onConnectGoogle={handleConnectGmail}
            onDisconnectGoogle={handleDisconnect}
            onDeleteAccount={() => {
              setErrorText("Account deletion is not available in the app yet. Contact support.");
            }}
            onEmailExtractionSuccess={loadDashboard}
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
            onRunSyncPreset={handleRunSyncPreset}
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
        </div>{/* end cc-page-scroll */}
      </div>{/* end content-shell */}
      <CommandPalette />
      <MobileTabBar activeView={activeView} onNavigate={handleViewChange} />
    </div>
  );
}
