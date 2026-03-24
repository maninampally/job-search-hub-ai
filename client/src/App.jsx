import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AtsCheckerPage from "./pages/AtsCheckerPage";
import ContactsPage from "./pages/ContactsPage";
import DashboardHomePage from "./pages/DashboardHomePage";
import InterviewPrepPage from "./pages/InterviewPrepPage";
import JobTrackerPage from "./pages/JobTrackerPage";
import OutreachPage from "./pages/OutreachPage";
import RemindersPage from "./pages/RemindersPage";
import TemplatesPage from "./pages/TemplatesPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard/*" element={<DashboardHomePage />} />
        <Route path="/jobtracker/*" element={<JobTrackerPage />} />
        <Route path="/contacts/*" element={<ContactsPage />} />
        <Route path="/templates/*" element={<TemplatesPage />} />
        <Route path="/interviewprep/*" element={<InterviewPrepPage />} />
        <Route path="/outreach/*" element={<OutreachPage />} />
        <Route path="/reminders/*" element={<RemindersPage />} />
        <Route path="/atschecker/*" element={<AtsCheckerPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
