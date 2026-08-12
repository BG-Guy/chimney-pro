import { Route, Routes, Link } from "react-router-dom";
import JobListPage from "./pages/JobListPage";
import JobFormPage from "./pages/JobFormPage";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          Chimney Pro
        </Link>
        <Link to="/jobs/new" className="btn btn-primary">
          + New Job
        </Link>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<JobListPage />} />
          <Route path="/jobs/new" element={<JobFormPage mode="new" />} />
          <Route path="/jobs/:id/edit" element={<JobFormPage mode="edit" />} />
        </Routes>
      </main>
    </div>
  );
}
