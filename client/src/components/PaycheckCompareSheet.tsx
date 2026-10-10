import { useState } from "react";
import BottomSheet from "./BottomSheet";
import { AlertTriangleIcon, CheckCircleIcon } from "./icons";
import { formatMoney } from "../format";
import {
  COMPARE_FIELDS,
  COMPARE_FIELD_LABEL,
  type ComparedJob,
  type PaycheckComparison,
} from "../paycheckCompare";

function shortDate(iso: string | null): string {
  if (!iso) return "no date";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function signedMoney(n: number): string {
  if (Math.round(n * 100) === 0) return formatMoney(0);
  return `${n > 0 ? "+" : "−"}${formatMoney(Math.abs(n))}`;
}

function timingNote(job: ComparedJob): string {
  if (job.app.status !== "done" || !job.app.completedDate) return "Not marked done in the app yet";
  return `App has it done on ${shortDate(job.app.completedDate)} — outside this paycheck`;
}

function DiffJobCard({ job }: { job: ComparedJob }) {
  return (
    <div className="cmp-job">
      <div className="cmp-job-top">
        <strong>{job.name}</strong>
        <span className="empty-hint">
          #{job.jobId} · closed {shortDate(job.company.closedDate)}
        </span>
      </div>
      {!job.inAppPeriod && (
        <p className="cmp-flag">
          <AlertTriangleIcon size={14} /> {timingNote(job)}
        </p>
      )}
      {job.diffs.length > 0 && (
        <div className="cmp-table">
          <span className="cmp-th" />
          <span className="cmp-th">Company</span>
          <span className="cmp-th">App</span>
          <span className="cmp-th">Diff</span>
          {job.diffs.map((d) => (
            <div className="cmp-row" key={d.field}>
              <span className="cmp-label">{COMPARE_FIELD_LABEL[d.field]}</span>
              <span>{formatMoney(d.company)}</span>
              <span>{formatMoney(d.app)}</span>
              <span className="cmp-diff">{signedMoney(d.app - d.company)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Side-by-side check of the company's paycheck PDF against what the app has logged.
export default function PaycheckCompareSheet({
  open,
  onClose,
  comparison,
  fileName,
}: {
  open: boolean;
  onClose: () => void;
  comparison: PaycheckComparison | null;
  fileName: string;
}) {
  const [showMatching, setShowMatching] = useState(false);
  if (!comparison) return null;

  const c = comparison;
  const differing = c.compared.filter((j) => j.diffs.length > 0 || !j.inAppPeriod);
  const matching = c.compared.filter((j) => j.diffs.length === 0 && j.inAppPeriod);
  const issues = differing.length + c.onlyInReport.length + c.onlyInApp.length;
  const period =
    c.startISO && c.endISO ? `${shortDate(c.startISO)} – ${shortDate(c.endISO)}, ${c.endISO.slice(0, 4)}` : fileName;

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Paycheck comparison">
      <div className="cmp-header">
        <h3>Company report vs app</h3>
        <span className="empty-hint">
          {period} · {c.compared.length + c.onlyInReport.length} jobs in the report
        </span>
      </div>

      <div className={`cmp-verdict ${issues === 0 ? "good" : "warn"}`}>
        {issues === 0 ? <CheckCircleIcon size={18} /> : <AlertTriangleIcon size={18} />}
        <span>
          {issues === 0 ? "Everything matches the app" : `${issues} thing${issues === 1 ? "" : "s"} to check`}
        </span>
      </div>

      <div className="cmp-section">
        <h4>Totals</h4>
        <div className="cmp-table">
          <span className="cmp-th" />
          <span className="cmp-th">Company</span>
          <span className="cmp-th">App</span>
          <span className="cmp-th">Diff</span>
          {COMPARE_FIELDS.map((f) => {
            const diff = c.appTotals[f] - c.companyTotals[f];
            const off = Math.round(diff * 100) !== 0;
            return (
              <div className={`cmp-row${off ? " off" : ""}`} key={f}>
                <span className="cmp-label">{COMPARE_FIELD_LABEL[f]}</span>
                <span>{formatMoney(c.companyTotals[f])}</span>
                <span>{formatMoney(c.appTotals[f])}</span>
                <span className="cmp-diff">{off ? signedMoney(diff) : "—"}</span>
              </div>
            );
          })}
        </div>
        <p className="empty-hint">App totals count the jobs the app has marked done within the report's dates.</p>
      </div>

      {differing.length > 0 && (
        <div className="cmp-section">
          <h4>Jobs that differ ({differing.length})</h4>
          {differing.map((job) => (
            <DiffJobCard key={job.jobId} job={job} />
          ))}
        </div>
      )}

      {c.onlyInReport.length > 0 && (
        <div className="cmp-section">
          <h4>In the report, missing from the app ({c.onlyInReport.length})</h4>
          {c.onlyInReport.map((row) => (
            <div className="cmp-job cmp-job-line" key={row.jobId}>
              <span>
                <strong>{row.client || "No name"}</strong>
                <span className="empty-hint">
                  {" "}
                  #{row.jobId} · closed {shortDate(row.closedDate)}
                </span>
              </span>
              <span>{formatMoney(row.total)}</span>
            </div>
          ))}
        </div>
      )}

      {c.onlyInApp.length > 0 && (
        <div className="cmp-section">
          <h4>Done in the app, missing from the report ({c.onlyInApp.length})</h4>
          {c.onlyInApp.map((item) => (
            <div className="cmp-job cmp-job-line" key={item.job.id}>
              <span>
                <strong>{item.name}</strong>
                <span className="empty-hint">
                  {" "}
                  {item.jobId ? `#${item.jobId}` : "no job #"} · done {shortDate(item.job.completedDate)}
                </span>
              </span>
              <span>{formatMoney(item.line.total)}</span>
            </div>
          ))}
        </div>
      )}

      {matching.length > 0 && (
        <div className="cmp-section">
          <button type="button" className="cmp-toggle" onClick={() => setShowMatching((v) => !v)}>
            <CheckCircleIcon size={16} /> {matching.length} job{matching.length === 1 ? "" : "s"} match exactly
            <span className="cmp-toggle-hint">{showMatching ? "Hide" : "Show"}</span>
          </button>
          {showMatching &&
            matching.map((job) => (
              <div className="cmp-job cmp-job-line" key={job.jobId}>
                <span>
                  <strong>{job.name}</strong>
                  <span className="empty-hint"> #{job.jobId}</span>
                </span>
                <span>{formatMoney(job.company.total)}</span>
              </div>
            ))}
        </div>
      )}

      <button type="button" className="btn btn-block" onClick={onClose}>
        Close
      </button>
    </BottomSheet>
  );
}
