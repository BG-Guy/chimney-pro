import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  DEPOSIT_METHOD_EMOJI,
  LEAD_OUTCOME_EMOJI,
  LEAD_OUTCOME_LABEL,
  STATUS_EMOJI,
  balanceRemaining,
  cashOwedToCompany,
  jobTotal,
  techProfit,
  type Job,
} from "../types";
import { formatTicketText } from "../formatTicket";

function isOverdue(job: Job): boolean {
  if (job.status !== "awaiting" || !job.scheduledDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return job.scheduledDate < today;
}

export default function JobListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedNumberId, setCopiedNumberId] = useState<number | null>(null);

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

  async function handleCopyNumber(job: Job) {
    await navigator.clipboard.writeText(`#${job.id}`);
    setCopiedNumberId(job.id!);
    setTimeout(() => setCopiedNumberId(null), 1500);
  }

  async function handleDelete(job: Job) {
    if (!confirm(`Delete this job (#${job.id})?`)) return;
    await api.deleteJob(job.id!);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
  }

  async function toggleStatus(job: Job) {
    const nextStatus = job.status === "done" ? "awaiting" : "done";
    const updated = await api.setStatus(job.id!, nextStatus);
    setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)));
  }

  async function markDone(job: Job) {
    const updated = await api.setStatus(job.id!, "done");
    setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)));
  }

  if (loading) return <p className="loading-text">Loading jobs...</p>;

  if (jobs.length === 0) {
    return (
      <div className="empty-state">
        <p>No jobs yet.</p>
        <Link to="/new" className="btn btn-primary">
          Create your first job
        </Link>
      </div>
    );
  }

  return (
    <div className="job-cards">
      {jobs.map((job) => {
        const overdue = isOverdue(job);
        const outcome = job.leadOutcome ?? (job.depositAmount > 0 ? "deposit" : "estimate");
        return (
          <div className="job-card" key={job.id}>
            <div className="job-card-top">
              <div className="job-card-top-left">
                <button
                  type="button"
                  className={`status-tag ${job.status}${overdue ? " overdue" : ""}`}
                  onClick={() => toggleStatus(job)}
                >
                  {job.status === "done" ? `${STATUS_EMOJI.done} Job done` : overdue ? "⚠️ Overdue" : `${STATUS_EMOJI.awaiting} Job awaits`}
                </button>
                <button type="button" className="job-number-chip" onClick={() => handleCopyNumber(job)}>
                  {copiedNumberId === job.id ? "Copied!" : `#${job.id}`}
                </button>
              </div>
              <span className="job-card-total">${jobTotal(job).toFixed(2)}</span>
            </div>

            <dl className="job-card-details">
              <div>
                <dt>{job.status === "done" ? "Completed" : "Scheduled"}</dt>
                <dd>{job.scheduledDate || "TBD"}</dd>
              </div>
              <div>
                <dt>Deposit</dt>
                <dd>
                  {job.depositAmount ? `$${job.depositAmount.toFixed(2)}` : "—"}
                  {job.depositMethod ? ` (${DEPOSIT_METHOD_EMOJI[job.depositMethod]} ${job.depositMethod})` : ""}
                </dd>
              </div>
              <div>
                <dt>Deposit date</dt>
                <dd>{job.depositDate || "—"}</dd>
              </div>
              <div>
                <dt>Repair team</dt>
                <dd>{job.needsRepairTeam ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Tech profit</dt>
                <dd>${techProfit(job).toFixed(2)}</dd>
              </div>
              <div>
                <dt>Balance remaining</dt>
                <dd>${balanceRemaining(job).toFixed(2)}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>
                  {LEAD_OUTCOME_EMOJI[outcome]} {LEAD_OUTCOME_LABEL[outcome]}
                </dd>
              </div>
            </dl>

            {cashOwedToCompany(job) > 0 && (
              <p className="cash-owed-callout">
                Tech collected cash — owes company ${cashOwedToCompany(job).toFixed(2)}
              </p>
            )}

            {job.depositAmount > 0 && job.status === "awaiting" && (
              <button className="btn btn-primary btn-block" onClick={() => markDone(job)}>
                ✅ Job is done
              </button>
            )}

            <div className="job-card-actions">
              <Link to={`/jobs/${job.id}/edit`} className="btn">
                Edit
              </Link>
              <button className="btn" onClick={() => handleCopy(job)}>
                {copiedId === job.id ? "Copied!" : "Copy"}
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(job)}>
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
