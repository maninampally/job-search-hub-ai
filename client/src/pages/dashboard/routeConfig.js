export const NAV_ITEMS = [
  "Dashboard",
  "Job Tracker",
  "Resume Manager",
  "Contacts",
  "Templates",
  "Interview Prep",
  "Outreach",
  "Reminders",
];

export const VIEW_ROUTE_MAP = {
  Dashboard: "/dashboard",
  "Job Tracker": "/jobtracker/settings",
  "Resume Manager": "/resumes",
  Contacts: "/contacts/list",
  Templates: "/templates/library",
  "Interview Prep": "/interviewprep/questions",
  Outreach: "/outreach/followups",
  Reminders: "/reminders/today",
};

export function getPathForView(view) {
  return VIEW_ROUTE_MAP[view] || "/dashboard";
}
