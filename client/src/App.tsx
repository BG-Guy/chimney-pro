import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import JobListPage from "./pages/JobListPage";
import JobFormPage from "./pages/JobFormPage";
import InsightsPage from "./pages/InsightsPage";
import GasLogPage from "./pages/GasLogPage";
import RoutePlanPage from "./pages/RoutePlanPage";
import SettingsPage from "./pages/SettingsPage";
import BottomNav from "./components/BottomNav";
import { BackIcon } from "./components/icons";
import "./App.css";

const PAGE_TRANSITION = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
};

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/jobs/") && pathname.endsWith("/edit")) return "Edit Job";
  if (pathname === "/insights") return "Insights";
  if (pathname === "/jobs") return "Jobs";
  if (pathname === "/gas") return "Gas Log";
  if (pathname === "/route") return "Route Planner";
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={pageTitle(location.pathname)}
              className="top-bar-title"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
            >
              {pageTitle(location.pathname)}
            </motion.span>
          </AnimatePresence>
        </header>
        <main className="screen">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} {...PAGE_TRANSITION}>
              <Routes location={location}>
                <Route path="/" element={<Navigate to="/new" replace />} />
                <Route path="/new" element={<JobFormPage mode="new" />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/jobs" element={<JobListPage />} />
                <Route path="/jobs/:id/edit" element={<JobFormPage mode="edit" />} />
                <Route path="/gas" element={<GasLogPage />} />
                <Route path="/route" element={<RoutePlanPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
