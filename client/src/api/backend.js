export const BACKEND_URL = import.meta?.env?.VITE_BACKEND_URL || "http://localhost:3001";
const AUTH_TOKEN_KEY = "jsh_auth_token";

export function getStoredAuthToken() {
	if (typeof window === "undefined") {
		return "";
	}
	return String(window.localStorage.getItem(AUTH_TOKEN_KEY) || "");
}

export function setStoredAuthToken(token) {
	if (typeof window === "undefined") {
		return;
	}
	if (token) {
		window.localStorage.setItem(AUTH_TOKEN_KEY, token);
		return;
	}
	window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function clearStoredAuthToken() {
	setStoredAuthToken("");
}

function withAuthHeaders(inputHeaders = {}) {
	const headers = new Headers(inputHeaders);
	const token = getStoredAuthToken();
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	return headers;
}

async function apiFetch(url, options = {}) {
	const response = await fetch(url, {
		...options,
		headers: withAuthHeaders(options.headers || {}),
	});
	return response;
}

async function parseResponse(response) {
	const body = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new Error(body.error || `Request failed with status ${response.status}`);
	}

	return body;
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

export async function getJobs() {
	const response = await apiFetch(`${BACKEND_URL}/jobs`);
	return parseResponse(response);
}

export async function syncJobs() {
	const response = await apiFetch(`${BACKEND_URL}/jobs/sync`, {
		method: "POST",
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

// ============================================================================
// CONTACTS API
// ============================================================================

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

// ============================================================================
// REMINDERS API
// ============================================================================

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

// ============================================================================
// OUTREACH API
// ============================================================================

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
