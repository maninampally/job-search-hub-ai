export const NAV_ITEMS = [
  "Dashboard",
  "Job Tracker",
  "Contacts",
  "Templates",
  "Interview Prep",
  "Outreach",
  "Reminders",
  "ATS Checker",
];

export const VIEW_ROUTE_MAP = {
  Dashboard: "/dashboard",
  "Job Tracker": "/jobtracker/settings",
  Contacts: "/contacts/list",
  Templates: "/templates/library",
  "Interview Prep": "/interviewprep/questions",
  Outreach: "/outreach/followups",
  Reminders: "/reminders/today",
  "ATS Checker": "/atschecker/scan",
};

export function getPathForView(view) {
  return VIEW_ROUTE_MAP[view] || "/dashboard";
}
