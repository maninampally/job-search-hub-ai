export const BACKEND_URL = import.meta?.env?.VITE_BACKEND_URL || "http://localhost:3001";

async function parseResponse(response) {
	const body = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new Error(body.error || `Request failed with status ${response.status}`);
	}

	return body;
}

export async function getHealth() {
	const response = await fetch(`${BACKEND_URL}/health`);
	return parseResponse(response);
}

export async function getAuthStatus() {
	const response = await fetch(`${BACKEND_URL}/auth/status`);
	return parseResponse(response);
}

export async function disconnectGmail() {
	const response = await fetch(`${BACKEND_URL}/auth/disconnect`, {
		method: "POST",
	});
	return parseResponse(response);
}

export async function getJobs() {
	const response = await fetch(`${BACKEND_URL}/jobs`);
	return parseResponse(response);
}

export async function syncJobs() {
	const response = await fetch(`${BACKEND_URL}/jobs/sync`, {
		method: "POST",
	});
	return parseResponse(response);
}

export async function createJob(job) {
	const response = await fetch(`${BACKEND_URL}/jobs`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(job),
	});
	return parseResponse(response);
}

export async function updateJob(jobId, jobPatch) {
	const response = await fetch(`${BACKEND_URL}/jobs/${jobId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(jobPatch),
	});
	return parseResponse(response);
}

export async function deleteJob(jobId) {
	const response = await fetch(`${BACKEND_URL}/jobs/${jobId}`, {
		method: "DELETE",
	});
	return parseResponse(response);
}

export async function markJobImported(jobId) {
	const response = await fetch(`${BACKEND_URL}/jobs/${jobId}/imported`, {
		method: "POST",
	});
	return parseResponse(response);
}

export async function getWeeklyAnalytics() {
	const response = await fetch(`${BACKEND_URL}/jobs/analytics/weekly`);
	return parseResponse(response);
}

export async function sendDueReminderHooks(reminders) {
	const response = await fetch(`${BACKEND_URL}/jobs/notifications/hooks/due-reminders`, {
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

	const response = await fetch(`${BACKEND_URL}/resumes/upload`, {
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

	const response = await fetch(url);
	return parseResponse(response);
}
