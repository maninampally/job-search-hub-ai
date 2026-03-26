import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DashboardWrapper from "./pages/DashboardWrapper";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/:route/*" element={<DashboardWrapper />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
