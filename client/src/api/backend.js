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

export async function getJobEmails(jobId) {
	const response = await fetch(`${BACKEND_URL}/jobs/${jobId}/emails`);
	return parseResponse(response);
}

export async function addJobEmail(jobId, email) {
	const response = await fetch(`${BACKEND_URL}/jobs/${jobId}/emails`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(email),
	});
	return parseResponse(response);
}

export async function getArchiveTemplateFiles() {
	const response = await fetch(`${BACKEND_URL}/templates/archive/files`);
	return parseResponse(response);
}

export async function getArchiveTemplateContent(relativePath) {
	const encodedPath = encodeURIComponent(relativePath);
	const response = await fetch(`${BACKEND_URL}/templates/archive/content?path=${encodedPath}`);
	return parseResponse(response);
}
