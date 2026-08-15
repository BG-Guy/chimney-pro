import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import JobListPage from "./pages/JobListPage";
import JobFormPage from "./pages/JobFormPage";
import InsightsPage from "./pages/InsightsPage";
import GasLogPage from "./pages/GasLogPage";
import SettingsPage from "./pages/SettingsPage";
import BottomNav from "./components/BottomNav";
import { BackIcon } from "./components/icons";
import "./App.css";

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/jobs/") && pathname.endsWith("/edit")) return "Edit Job";
  if (pathname === "/insights") return "Insights";
  if (pathname === "/jobs") return "Jobs";
  if (pathname === "/gas") return "Gas Log";
  if (pathname === "/settings") return "Settings";
  return "New Job";
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isEdit = location.pathname.startsWith("/jobs/") && location.pathname.endsWith("/edit");

  return (
    <div className="phone-shell">
      <div className="phone-viewport">
        <header className="top-bar">
          {isEdit && (
            <button className="top-bar-back" onClick={() => navigate("/jobs")} aria-label="Back to jobs">
              <BackIcon />
            </button>
          )}
          <span className="top-bar-title">{pageTitle(location.pathname)}</span>
        </header>
        <main className="screen">
          <Routes>
            <Route path="/" element={<Navigate to="/new" replace />} />
            <Route path="/new" element={<JobFormPage mode="new" />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/jobs" element={<JobListPage />} />
            <Route path="/jobs/:id/edit" element={<JobFormPage mode="edit" />} />
            <Route path="/gas" element={<GasLogPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
