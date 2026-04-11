import { getAccessToken, setAccessToken } from "../stores/authStore";

export const BACKEND_URL = import.meta?.env?.VITE_BACKEND_URL || "http://localhost:3001";

// Track if we're currently refreshing to prevent simultaneous refresh calls
let isRefreshing = false;
let refreshPromise = null;

// These are kept as no-ops for any legacy callers that may still reference them.
// Token storage has moved to memory via AuthContext (_accessToken variable).
export function getStoredAuthToken() {
  return getAccessToken() || "";
}

export function setStoredAuthToken() {
  // No-op: token is now managed exclusively by AuthContext in memory.
}

export function clearStoredAuthToken() {
  // No-op: use AuthContext.logout() which calls setAccessToken(null).
}

function withAuthHeaders(inputHeaders = {}) {
  const headers = new Headers(inputHeaders);
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function apiFetch(url, options = {}, isRetry = false) {
  const response = await fetch(url, {
    ...options,
    headers: withAuthHeaders(options.headers || {}),
    // credentials: 'include' sends the httpOnly refresh cookie on every request
    // so the server can transparently handle token rotation when needed.
    credentials: "include",
  });

  // Silent refresh on 401 (Unauthorized)
  if (response.status === 401 && !isRetry) {
    // If token expired, try to refresh
    try {
      // Only refresh once if multiple requests fail simultaneously
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            const refreshResult = await fetch(`${BACKEND_URL}/auth/refresh`, {
              method: "POST",
              credentials: "include",
            });

            if (refreshResult.ok) {
              const body = await refreshResult.json();
              if (body?.token) {
                setAccessToken(body.token);
                return true;
              }
            }
            return false;
          } finally {
            isRefreshing = false;
            refreshPromise = null;
          }
        })();
      }

      // Wait for refresh to complete
      const refreshed = await refreshPromise;

      if (refreshed) {
        // Retry original request with new token
        return apiFetch(url, options, true);
      }
    } catch (error) {
      console.error("[apiFetch] Silent refresh failed:", error);
    }
  }

  return response;
}

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    let message = body.error || `Request failed with status ${response.status}`;
    if (response.status === 429) {
      if (body.message) message = body.message;
      const reset = body.resetAt;
      if (reset != null) {
        const t = new Date(typeof reset === "number" ? reset : Number(reset));
        if (!Number.isNaN(t.getTime())) {
          message += ` Resets at ${t.toLocaleString()}.`;
        }
      }
    }
    const err = new Error(message);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  return body;
}

/**
 * Call POST /auth/refresh to get a new access token using the httpOnly cookie.
 * Used on app mount and by the silent-refresh mechanism.
 * credentials: 'include' sends the refresh cookie automatically.
 */
export async function refreshAccessToken() {
  const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  // 401 means no valid cookie - not an error, just "not logged in".
  // Return null so the caller can silently treat this as an unauthenticated state.
  if (response.status === 401) return null;
  return parseResponse(response);
}

export async function getHealth() {
  const response = await apiFetch(`${BACKEND_URL}/health`);
  return parseResponse(response);
}

export async function registerUser({ name, email, password }) {
  const response = await apiFetch(`${BACKEND_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return parseResponse(response);
}

export async function loginUser({ email, password }) {
  const response = await apiFetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse(response);
}

export async function logoutUser() {
  const response = await apiFetch(`${BACKEND_URL}/auth/logout`, {
    method: "POST",
  });
  return parseResponse(response);
}

export async function forgotPassword({ email, newPassword }) {
  const response = await apiFetch(`${BACKEND_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, newPassword }),
  });
  return parseResponse(response);
}

export async function getCurrentUser() {
  const response = await apiFetch(`${BACKEND_URL}/auth/me`);
  return parseResponse(response);
}

export async function changePassword({ currentPassword, newPassword }) {
  const response = await apiFetch(`${BACKEND_URL}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return parseResponse(response);
}

export async function updateMyProfile(profilePatch) {
  const response = await apiFetch(`${BACKEND_URL}/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profilePatch),
  });
  return parseResponse(response);
}

export async function getAuthStatus() {
  const response = await apiFetch(`${BACKEND_URL}/auth/status`);
  return parseResponse(response);
}

export async function disconnectGmail() {
  const response = await apiFetch(`${BACKEND_URL}/auth/disconnect`, {
    method: "POST",
  });
  return parseResponse(response);
}

/**
 * Start Gmail OAuth from the logged-in SPA (sends Bearer token). Returns { redirectUrl } to open in the browser.
 */
export async function startGmailOAuthFlow() {
  const response = await apiFetch(`${BACKEND_URL}/auth/gmail/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body.error || "Failed to start Gmail connection");
    err.status = response.status;
    err.body = body;
    throw err;
  }
  return body;
}

// Session management
export async function getSessions() {
  const response = await apiFetch(`${BACKEND_URL}/auth/sessions`);
  return parseResponse(response);
}

export async function deleteSession(sessionId) {
  const response = await apiFetch(`${BACKEND_URL}/auth/sessions/${sessionId}`, {
    method: "DELETE",
  });
  return parseResponse(response);
}

export async function deleteOtherSessions() {
  const response = await apiFetch(`${BACKEND_URL}/auth/sessions`, {
    method: "DELETE",
  });
  return parseResponse(response);
}

export async function getJobs() {
  const response = await apiFetch(`${BACKEND_URL}/jobs`);
  return parseResponse(response);
}

export async function syncJobs(options = {}) {
  const forceReprocess = Boolean(options.forceReprocess);
  const fullWindow = Boolean(options.fullWindow);
  const processAll = Object.prototype.hasOwnProperty.call(options, "processAll")
    ? Boolean(options.processAll)
    : true;
  const body = { forceReprocess, fullWindow, processAll };
  if (options.lookbackDays != null && Number.isFinite(Number(options.lookbackDays))) {
    body.lookbackDays = Math.min(365, Math.max(1, Math.floor(Number(options.lookbackDays))));
  }
  const response = await apiFetch(`${BACKEND_URL}/jobs/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function getSyncStatus() {
  const response = await apiFetch(`${BACKEND_URL}/jobs/sync-status`);
  return parseResponse(response);
}

export async function createJob(job) {
  const response = await apiFetch(`${BACKEND_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  });
  return parseResponse(response);
}

export async function updateJob(jobId, jobPatch) {
  const response = await apiFetch(`${BACKEND_URL}/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jobPatch),
  });
  return parseResponse(response);
}

export async function deleteJob(jobId) {
  const response = await apiFetch(`${BACKEND_URL}/jobs/${jobId}`, {
    method: "DELETE",
  });
  return parseResponse(response);
}

export async function getJobEmails(jobId) {
  const response = await apiFetch(`${BACKEND_URL}/jobs/${jobId}/emails`);
  const body = await parseResponse(response);
  return {
    success: true,
    data: Array.isArray(body?.emails) ? body.emails : [],
  };
}

export async function getJobTimeline(jobId) {
  const response = await apiFetch(`${BACKEND_URL}/jobs/timeline/${jobId}`);
  const body = await parseResponse(response);
  return {
    success: true,
    data: Array.isArray(body?.timeline) ? body.timeline : [],
  };
}

export async function getDailyReport(hours = 24) {
  const response = await apiFetch(`${BACKEND_URL}/jobs/daily-report?hours=${hours}`);
  return parseResponse(response);
}

export async function markJobImported(jobId) {
  const response = await apiFetch(`${BACKEND_URL}/jobs/${jobId}/imported`, {
    method: "POST",
  });
  return parseResponse(response);
}

export async function getWeeklyAnalytics() {
  const response = await apiFetch(`${BACKEND_URL}/jobs/analytics/weekly`);
  return parseResponse(response);
}

export async function getDailyAnalytics(daysOrStart = 7, endDate = null) {
  let url = `${BACKEND_URL}/jobs/analytics/daily?metric=applications`;

  if (typeof daysOrStart === "number") {
    url += `&days=${daysOrStart}`;
  } else if (typeof daysOrStart === "string" && endDate) {
    url += `&startDate=${encodeURIComponent(daysOrStart)}&endDate=${encodeURIComponent(endDate)}`;
  }

  const response = await apiFetch(url);
  return parseResponse(response);
}

export async function sendDueReminderHooks(reminders) {
  const response = await apiFetch(`${BACKEND_URL}/jobs/notifications/hooks/due-reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reminders }),
  });
  return parseResponse(response);
}

// Resume Management APIs
export async function uploadResume(file, name, linkedJobId) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  if (linkedJobId) {
    formData.append("linkedJobId", linkedJobId);
  }

  const response = await apiFetch(`${BACKEND_URL}/resumes/upload`, {
    method: "POST",
    body: formData,
  });
  return parseResponse(response);
}

export async function getResumes(jobId, searchQuery) {
  let url = `${BACKEND_URL}/resumes`;
  const params = new URLSearchParams();
  if (jobId) params.append("jobId", jobId);
  if (searchQuery) params.append("name", searchQuery);
  if (params.toString()) url += `?${params.toString()}`;

  const response = await apiFetch(url);
  return parseResponse(response);
}

export function getResumeViewUrl(resumeId) {
  return `${BACKEND_URL}/resumes/${resumeId}/view`;
}

export function getResumeDownloadUrl(resumeId) {
  return `${BACKEND_URL}/resumes/${resumeId}/download`;
}

export async function deleteResume(resumeId) {
  const response = await apiFetch(`${BACKEND_URL}/resumes/${resumeId}`, {
    method: "DELETE",
  });
  return parseResponse(response);
}

export async function getTemplateArchiveFiles() {
  const response = await apiFetch(`${BACKEND_URL}/templates/archive/files`);
  return parseResponse(response);
}

export async function getTemplateArchiveContent(relativePath) {
  const encodedPath = encodeURIComponent(String(relativePath || ""));
  const response = await apiFetch(`${BACKEND_URL}/templates/archive/content?path=${encodedPath}`);
  return parseResponse(response);
}

// Contacts API
export async function getContacts(filters = {}) {
  let url = `${BACKEND_URL}/contacts`;
  const params = new URLSearchParams();
  if (filters.name) params.append("name", filters.name);
  if (filters.email) params.append("email", filters.email);
  if (filters.company) params.append("company", filters.company);
  if (params.toString()) url += `?${params.toString()}`;

  const response = await apiFetch(url);
  const body = await parseResponse(response);
  return {
    success: true,
    data: Array.isArray(body?.contacts) ? body.contacts : [],
  };
}

export async function createContact(contact) {
  const payload = {
    name: contact?.name,
    email: contact?.email,
    phone: contact?.phone,
    company: contact?.company,
    role: contact?.role || contact?.title,
    linkedinUrl: contact?.linkedinUrl || contact?.linkedin_url,
    notes: contact?.notes,
  };
  const response = await apiFetch(`${BACKEND_URL}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse(response);
  return {
    success: true,
    data: body?.contact || null,
    message: body?.message,
  };
}

export async function updateContact(contactId, contactPatch) {
  const payload = {
    name: contactPatch?.name,
    email: contactPatch?.email,
    phone: contactPatch?.phone,
    company: contactPatch?.company,
    role: contactPatch?.role || contactPatch?.title,
    linkedinUrl: contactPatch?.linkedinUrl || contactPatch?.linkedin_url,
    notes: contactPatch?.notes,
  };
  const response = await apiFetch(`${BACKEND_URL}/contacts/${contactId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse(response);
  return {
    success: true,
    data: body?.contact || null,
    message: body?.message,
  };
}

export async function deleteContact(contactId) {
  const response = await apiFetch(`${BACKEND_URL}/contacts/${contactId}`, {
    method: "DELETE",
  });
  const body = await parseResponse(response);
  return {
    success: true,
    message: body?.message,
  };
}

// Reminders API
export async function getReminders(filters = {}) {
  let url = `${BACKEND_URL}/reminders`;
  const params = new URLSearchParams();
  if (filters.jobId) params.append("jobId", filters.jobId);
  if (filters.isDone !== undefined) params.append("isDone", String(filters.isDone));
  if (params.toString()) url += `?${params.toString()}`;

  const response = await apiFetch(url);
  const body = await parseResponse(response);
  const reminders = Array.isArray(body?.reminders) ? body.reminders : [];
  return {
    success: true,
    data: reminders.map((item) => {
      const notes = String(item?.notes || "");
      const typeMatch = notes.match(/\[Type:\s*(.*?)\]/i);
      return {
        ...item,
        dueDate: item?.due_date || "",
        completed: Boolean(item?.is_done),
        type: item?.type || typeMatch?.[1] || "Other",
      };
    }),
  };
}

export async function createReminder(reminder) {
  const type = reminder?.type || reminder?.reminder_type || "Other";
  const notes = reminder?.notes ? `[Type: ${type}] ${reminder.notes}` : `[Type: ${type}]`;
  const payload = {
    jobId: reminder?.jobId || reminder?.job_id,
    title: reminder?.title,
    dueDate: reminder?.dueDate || reminder?.due_date,
    notes,
  };
  const response = await apiFetch(`${BACKEND_URL}/reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse(response);
  const created = body?.reminder || null;
  return {
    success: true,
    data: created
      ? {
          ...created,
          dueDate: created?.due_date || "",
          completed: Boolean(created?.is_done),
          type,
        }
      : null,
    message: body?.message,
  };
}

export async function updateReminder(reminderId, reminderPatch) {
  const payload = {
    title: reminderPatch?.title,
    dueDate: reminderPatch?.dueDate || reminderPatch?.due_date,
    isDone: reminderPatch?.isDone ?? reminderPatch?.is_done,
    notes: reminderPatch?.notes,
  };
  const response = await apiFetch(`${BACKEND_URL}/reminders/${reminderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse(response);
  const updated = body?.reminder || null;
  const notes = String(updated?.notes || "");
  const typeMatch = notes.match(/\[Type:\s*(.*?)\]/i);
  return {
    success: true,
    data: updated
      ? {
          ...updated,
          dueDate: updated?.due_date || "",
          completed: Boolean(updated?.is_done),
          type: updated?.type || typeMatch?.[1] || "Other",
        }
      : null,
    message: body?.message,
  };
}

export async function deleteReminder(reminderId) {
  const response = await apiFetch(`${BACKEND_URL}/reminders/${reminderId}`, {
    method: "DELETE",
  });
  const body = await parseResponse(response);
  return {
    success: true,
    message: body?.message,
  };
}

// Outreach API
export async function getOutreach(filters = {}) {
  let url = `${BACKEND_URL}/outreach`;
  const params = new URLSearchParams();
  if (filters.contactId) params.append("contactId", filters.contactId);
  if (filters.jobId) params.append("jobId", filters.jobId);
  if (filters.type) params.append("type", filters.type);
  if (params.toString()) url += `?${params.toString()}`;

  const response = await apiFetch(url);
  const body = await parseResponse(response);
  return {
    success: true,
    data: Array.isArray(body?.outreach) ? body.outreach : [],
  };
}

export async function createOutreach(outreach) {
  const payload = {
    contactId: outreach?.contactId || outreach?.contact_id,
    jobId: outreach?.jobId || outreach?.job_id,
    type: outreach?.type,
    message: outreach?.message,
    sentAt: outreach?.sentAt || outreach?.sent_at,
    responseReceived: outreach?.responseReceived ?? outreach?.response_received,
    notes: outreach?.notes,
  };
  const response = await apiFetch(`${BACKEND_URL}/outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse(response);
  return {
    success: true,
    data: body?.outreach || null,
    message: body?.message,
  };
}

export async function updateOutreach(outreachId, outreachPatch) {
  const payload = {
    type: outreachPatch?.type,
    message: outreachPatch?.message,
    sentAt: outreachPatch?.sentAt || outreachPatch?.sent_at,
    responseReceived: outreachPatch?.responseReceived ?? outreachPatch?.response_received,
    notes: outreachPatch?.notes,
  };
  const response = await apiFetch(`${BACKEND_URL}/outreach/${outreachId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse(response);
  return {
    success: true,
    data: body?.outreach || null,
    message: body?.message,
  };
}

export async function deleteOutreach(outreachId) {
  const response = await apiFetch(`${BACKEND_URL}/outreach/${outreachId}`, {
    method: "DELETE",
  });
  const body = await parseResponse(response);
  return {
    success: true,
    message: body?.message,
  };
}

// Email Verification API
export async function requestEmailVerification() {
  const response = await apiFetch(`${BACKEND_URL}/auth/verify-email/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export async function confirmEmailVerification(token) {
  const response = await apiFetch(
    `${BACKEND_URL}/auth/verify-email/confirm?token=${encodeURIComponent(token)}`
  );
  return parseResponse(response);
}

// MFA API
export async function setupMfa() {
  const response = await apiFetch(`${BACKEND_URL}/auth/mfa/setup`, {
    method: "POST",
  });
  return parseResponse(response);
}

export async function verifyMfa(code) {
  const response = await apiFetch(`${BACKEND_URL}/auth/mfa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return parseResponse(response);
}

export async function disableMfa(code) {
  const response = await apiFetch(`${BACKEND_URL}/auth/mfa/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return parseResponse(response);
}

// AI API
export async function generateCoverLetter({ jobId, resumeText }) {
  const response = await apiFetch(`${BACKEND_URL}/ai/cover-letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, resumeText }),
  });
  return parseResponse(response);
}

export async function answerInterviewQuestion({ question, jobContext }) {
  const response = await apiFetch(`${BACKEND_URL}/ai/interview-coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, jobContext }),
  });
  return parseResponse(response);
}

export async function getAiUsage() {
  const response = await apiFetch(`${BACKEND_URL}/ai/usage`);
  return parseResponse(response);
}

// Billing API
export async function getBillingPlan() {
  const response = await apiFetch(`${BACKEND_URL}/billing/plan`);
  return parseResponse(response);
}

export async function createCheckoutSession(plan) {
  const response = await apiFetch(`${BACKEND_URL}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  return parseResponse(response);
}

export async function getBillingPortal() {
  const response = await apiFetch(`${BACKEND_URL}/billing/portal`);
  return parseResponse(response);
}

// Admin API
export async function getAdminUsers({ page = 1, limit = 20, search = "" } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (search) params.append("search", search);
  const response = await apiFetch(`${BACKEND_URL}/admin/users?${params.toString()}`);
  return parseResponse(response);
}

export async function updateUserRole(userId, role) {
  const response = await apiFetch(`${BACKEND_URL}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return parseResponse(response);
}

export async function suspendUser(userId) {
  const response = await apiFetch(`${BACKEND_URL}/admin/users/${userId}/suspend`, {
    method: "POST",
  });
  return parseResponse(response);
}

export async function getAuditLog({ page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page, limit });
  const response = await apiFetch(`${BACKEND_URL}/admin/audit-log?${params.toString()}`);
  return parseResponse(response);
}

export async function getAdminMetrics() {
  const response = await apiFetch(`${BACKEND_URL}/admin/metrics`);
  return parseResponse(response);
}

// Follow-up nudges
export async function getFollowUpNudges() {
  const response = await apiFetch(`${BACKEND_URL}/jobs/nudges`);
  return parseResponse(response);
}

// ============================================================================
// MFA ENDPOINTS
// ============================================================================

/**
 * POST /auth/mfa/setup - Generate TOTP secret and backup codes
 */
export async function setupMFA() {
  const response = await apiFetch(`${BACKEND_URL}/auth/mfa/setup`, {
    method: "POST",
  });
  return parseResponse(response);
}

/**
 * POST /auth/mfa/verify - Verify TOTP code to complete MFA enrollment
 */
export async function verifyMFA(code) {
  const response = await apiFetch(`${BACKEND_URL}/auth/mfa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return parseResponse(response);
}

/**
 * POST /auth/mfa/disable - Disable MFA with TOTP verification
 */
export async function disableMFA(code) {
  const response = await apiFetch(`${BACKEND_URL}/auth/mfa/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return parseResponse(response);
}

/**
 * POST /auth/mfa/challenge - Verify TOTP during login MFA challenge
 */
export async function verifyMFAChallenge(code, preAuthToken) {
  const response = await apiFetch(`${BACKEND_URL}/auth/mfa/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, preAuthToken }),
  });
  return parseResponse(response);
}

// Admin endpoints
export async function adminGetUsers(page = 1, search = '') {
  const params = new URLSearchParams({ page, limit: 20, ...(search ? { search } : {}) });
  const response = await apiFetch(`${BACKEND_URL}/admin/users?${params}`);
  return parseResponse(response);
}

export async function adminUpdateRole(userId, role) {
  const response = await apiFetch(`${BACKEND_URL}/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  return parseResponse(response);
}

export async function adminSuspendUser(userId) {
  const response = await apiFetch(`${BACKEND_URL}/admin/users/${userId}/suspend`, { method: 'POST' });
  return parseResponse(response);
}

export async function adminUnsuspendUser(userId) {
  const response = await apiFetch(`${BACKEND_URL}/admin/users/${userId}/unsuspend`, { method: 'POST' });
  return parseResponse(response);
}

export async function adminGetAuditLog(page = 1) {
  const params = new URLSearchParams({ page, limit: 50 });
  const response = await apiFetch(`${BACKEND_URL}/admin/audit-log?${params}`);
  return parseResponse(response);
}

export async function adminGetMetrics() {
  const response = await apiFetch(`${BACKEND_URL}/admin/metrics`);
  return parseResponse(response);
}
