/**
 * Email utility functions for job search hub
 */

export function getEmailIdentity(email) {
  return email.gmailId || email.id;
}

export function normalizeEmailItem(email, emailReadMap = {}) {
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

export function mergeEmails(currentEmails, incomingEmails, emailReadMap = {}) {
  const byId = new Map();

  for (const item of currentEmails || []) {
    const normalized = normalizeEmailItem(item, emailReadMap);
    byId.set(getEmailIdentity(normalized) || normalized.id, normalized);
  }

  for (const item of incomingEmails || []) {
    const normalized = normalizeEmailItem(item, emailReadMap);
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
