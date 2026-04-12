import { useParams } from "react-router-dom";
import { DashboardPage } from "./Dashboard";

const ROUTE_TO_VIEW_MAP = {
  dashboard: "Dashboard",
  jobtracker: "Job Tracker",
  resumes: "Resume Manager",
  contacts: "Contacts",
  templates: "Templates",
  interviewprep: "Interview Prep",
  outreach: "Outreach",
  reminders: "Reminders",
  settings: "Settings",
};

export default function DashboardWrapper() {
  const { route } = useParams();
  const routeView = ROUTE_TO_VIEW_MAP[route] || "Dashboard";
  return <DashboardPage routeView={routeView} />;
}
