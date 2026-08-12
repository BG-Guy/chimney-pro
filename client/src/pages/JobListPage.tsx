import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { jobTotal, type Job } from "../types";
import { formatTicketText } from "../formatTicket";

export default function JobListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    api
      .listJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }, []);

  async function handleCopy(job: Job) {
    await navigator.clipboard.writeText(formatTicketText(job));
    setCopiedId(job.id!);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleDelete(job: Job) {
    if (!confirm(`Delete this job (#${job.id})?`)) return;
    await api.deleteJob(job.id!);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
  }

  if (loading) return <p>Loading jobs...</p>;

  if (jobs.length === 0) {
    return (
      <div className="empty-state">
        <p>No jobs yet.</p>
        <Link to="/jobs/new" className="btn btn-primary">
          Create your first job
        </Link>
      </div>
    );
  }

  return (
    <table className="job-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Total</th>
          <th>Deposit</th>
          <th>Repair Team</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id}>
            <td>{job.scheduledDate || "TBD"}</td>
            <td>${jobTotal(job).toFixed(2)}</td>
            <td>
              {job.depositAmount ? `$${job.depositAmount.toFixed(2)}` : "—"}
              {job.depositMethod ? ` (${job.depositMethod})` : ""}
            </td>
            <td>{job.needsRepairTeam ? "Yes" : "No"}</td>
            <td className="actions">
              <Link to={`/jobs/${job.id}/edit`} className="btn">
                Edit
              </Link>
              <button className="btn" onClick={() => handleCopy(job)}>
                {copiedId === job.id ? "Copied!" : "Copy"}
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(job)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
