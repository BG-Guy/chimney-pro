import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import JobListPage from "./pages/JobListPage";
import JobFormPage from "./pages/JobFormPage";
import InsightsPage from "./pages/InsightsPage";
import RoutePlanPage from "./pages/RoutePlanPage";
import SettingsPage from "./pages/SettingsPage";
import BottomNav from "./components/BottomNav";
import { HeaderActionsContext } from "./components/HeaderActions";
import { BackIcon } from "./components/icons";
import "./App.css";

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/jobs/") && pathname.endsWith("/edit")) return "Edit job";
  if (pathname === "/insights") return "Insights";
  if (pathname === "/jobs") return "Jobs";
  if (pathname === "/route") return "Route";
  if (pathname === "/settings") return "Settings";
  return "New job";
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isEdit = location.pathname.startsWith("/jobs/") && location.pathname.endsWith("/edit");
  const [actionsEl, setActionsEl] = useState<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const screenRef = useRef<HTMLElement>(null);

  // Each tab opens at its top, with the header's divider hidden until the page scrolls.
  useEffect(() => {
    screenRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [location.pathname]);

  return (
    <div className="phone-shell">
      <div className="phone-viewport">
        <header className={`top-bar${scrolled ? " scrolled" : ""}`}>
          {isEdit && (
            <button className="top-bar-back" onClick={() => navigate("/jobs")} aria-label="Back to jobs">
              <BackIcon size={24} />
            </button>
          )}
          <h1 className="top-bar-title">{pageTitle(location.pathname)}</h1>
          <div className="top-bar-actions" ref={setActionsEl} />
        </header>
        <HeaderActionsContext.Provider value={actionsEl}>
          <main ref={screenRef} className="screen" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
            <Routes>
              <Route path="/" element={<Navigate to="/new" replace />} />
              <Route path="/new" element={<JobFormPage mode="new" />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/jobs" element={<JobListPage />} />
              <Route path="/jobs/:id/edit" element={<JobFormPage mode="edit" />} />
              <Route path="/gas" element={<Navigate to="/new" replace />} />
              <Route path="/route" element={<RoutePlanPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </HeaderActionsContext.Provider>
        <BottomNav />
      </div>
    </div>
  );
}
