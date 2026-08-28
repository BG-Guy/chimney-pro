import { useEffect, useMemo, useState } from "react";
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
  totalPaid,
  type Job,
  type JobStatus,
  type Tag,
} from "../types";
import { formatTicketText } from "../formatTicket";
import { extractTicketNumber } from "../ticketNumber";
import { extractCustomerName } from "../customerName";
import ChoiceBoxes, { type Choice } from "../components/ChoiceBoxes";
import MonthWeekPicker from "../components/MonthWeekPicker";
import {
  currentMonthOption,
  currentWeekOfMonthN,
  monthRangeISO,
  recentMonths,
  weeksOfMonth,
  type MonthOption,
} from "../dateBuckets";
import { inRange } from "../dateUtils";
import { downloadJobsCsv } from "../jobsCsv";

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function isOverdue(job: Job): boolean {
  if (job.status !== "awaiting" || !job.scheduledDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return job.scheduledDate < today;
}

type SortMode = "newest" | "oldest" | "scheduled" | "total";

const SORT_OPTIONS: Choice<SortMode>[] = [
  { value: "newest", label: "Newest", emoji: "🆕" },
  { value: "oldest", label: "Oldest", emoji: "📜" },
  { value: "scheduled", label: "Scheduled", emoji: "📅" },
  { value: "total", label: "Total", emoji: "💵" },
];

const STATUS_FILTER_OPTIONS: Choice<JobStatus | "all">[] = [
  { value: "all", label: "All", emoji: "📋" },
  { value: "awaiting", label: "Awaits", emoji: STATUS_EMOJI.awaiting },
  { value: "done", label: "Done", emoji: STATUS_EMOJI.done },
];

type PaycheckMode = "week" | "month";

const PAYCHECK_MODE_OPTIONS: Choice<PaycheckMode>[] = [
  { value: "week", label: "Week", emoji: "📅" },
  { value: "month", label: "Month", emoji: "🗓️" },
];

function sortJobsBy(jobs: Job[], mode: SortMode): Job[] {
  const sorted = [...jobs];
  switch (mode) {
    case "newest":
      sorted.sort((a, b) =>
        a.loggedDate !== b.loggedDate ? (a.loggedDate < b.loggedDate ? 1 : -1) : (b.id ?? 0) - (a.id ?? 0)
      );
      break;
    case "oldest":
      sorted.sort((a, b) =>
        a.loggedDate !== b.loggedDate ? (a.loggedDate > b.loggedDate ? 1 : -1) : (a.id ?? 0) - (b.id ?? 0)
      );
      break;
    case "scheduled":
      sorted.sort((a, b) => {
        if (!a.scheduledDate && !b.scheduledDate) return (b.id ?? 0) - (a.id ?? 0);
        if (!a.scheduledDate) return 1;
        if (!b.scheduledDate) return -1;
        if (a.scheduledDate !== b.scheduledDate) return a.scheduledDate < b.scheduledDate ? -1 : 1;
        return (b.id ?? 0) - (a.id ?? 0);
      });
      break;
    case "total":
      sorted.sort((a, b) => jobTotal(b) - jobTotal(a));
      break;
  }
  return sorted;
}

export default function JobListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedNumberId, setCopiedNumberId] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [paycheckFilterOn, setPaycheckFilterOn] = useState(false);
  const [paycheckMode, setPaycheckMode] = useState<PaycheckMode>("week");
  const [paycheckMonth, setPaycheckMonth] = useState<MonthOption>(() => currentMonthOption());
  const [paycheckWeekN, setPaycheckWeekN] = useState<number>(() => {
    const m = currentMonthOption();
    return currentWeekOfMonthN(m.year, m.month);
  });

  useEffect(() => {
    api
      .listJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
    api.listTags().then(setTags);
  }, []);

  function toggleTagFilter(tagId: number) {
    setTagFilter((prev) => (prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]));
  }

  function handleSelectPaycheckMonth(m: MonthOption) {
    setPaycheckMonth(m);
    const isCurrentMonth = m.year === currentMonthOption().year && m.month === currentMonthOption().month;
    const w = weeksOfMonth(m.year, m.month);
    setPaycheckWeekN(isCurrentMonth ? currentWeekOfMonthN(m.year, m.month) : w[w.length - 1]?.n ?? 1);
  }

  const paycheckMonths = useMemo(() => recentMonths(12), []);
  const paycheckWeeks = useMemo(() => weeksOfMonth(paycheckMonth.year, paycheckMonth.month), [paycheckMonth]);
  const paycheckWeek = paycheckWeeks.find((w) => w.n === paycheckWeekN) ?? paycheckWeeks[paycheckWeeks.length - 1];
  const paycheckMonthRange = useMemo(
    () => monthRangeISO(paycheckMonth.year, paycheckMonth.month),
    [paycheckMonth]
  );

  const visibleJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (tagFilter.length > 0 && !job.tagIds.some((id) => tagFilter.includes(id))) return false;
      if (q) {
        const customerName = (extractCustomerName(job.rawTicketText) ?? "").toLowerCase();
        const ticketNumber = (extractTicketNumber(job.rawTicketText) ?? "").toLowerCase();
        const matches = customerName.includes(q) || ticketNumber.includes(q) || String(job.id).includes(q);
        if (!matches) return false;
      }
      if (paycheckFilterOn) {
        if (paycheckMode === "week" && paycheckWeek) {
          if (!inRange(job.completedDate, paycheckWeek.weekStartISO, paycheckWeek.weekEndISO)) return false;
        } else if (paycheckMode === "month") {
          if (!inRange(job.completedDate, paycheckMonthRange.startISO, paycheckMonthRange.endISO)) return false;
        }
      }
      return true;
    });
    return sortJobsBy(filtered, sortMode);
  }, [
    jobs,
    sortMode,
    statusFilter,
    tagFilter,
    searchQuery,
    paycheckFilterOn,
    paycheckMode,
    paycheckWeek,
    paycheckMonthRange,
  ]);

  async function handleCopy(job: Job) {
    await navigator.clipboard.writeText(formatTicketText(job));
    setCopiedId(job.id!);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleCopyNumber(job: Job, ticketNumber: string) {
    await navigator.clipboard.writeText(ticketNumber);
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
    <div className="job-list">
      <input
        type="search"
        className="job-search-input"
        placeholder="Search by customer or job #"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className="jobs-toolbar">
        <ChoiceBoxes options={SORT_OPTIONS} value={sortMode} onChange={setSortMode} />
        <ChoiceBoxes options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {tags.length > 0 && (
        <div className="tag-color-picker">
          {tags.map((tag) => {
            const selected = tagFilter.includes(tag.id!);
            return (
              <button
                key={tag.id}
                type="button"
                className={`tag-chip tag-chip-toggle${selected ? " selected" : ""}`}
                style={{ background: `var(--${tag.color})` }}
                onClick={() => toggleTagFilter(tag.id!)}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="paycheck-filter">
        <button
          type="button"
          className={`chip-pill${paycheckFilterOn ? " selected" : ""}`}
          onClick={() => setPaycheckFilterOn((prev) => !prev)}
        >
          💸 Paycheck report
        </button>

        {paycheckFilterOn && (
          <>
            <ChoiceBoxes options={PAYCHECK_MODE_OPTIONS} value={paycheckMode} onChange={setPaycheckMode} />
            <MonthWeekPicker
              months={paycheckMonths}
              selectedMonth={paycheckMonth}
              onSelectMonth={handleSelectPaycheckMonth}
              weeks={paycheckWeeks}
              selectedWeekN={paycheckWeekN}
              onSelectWeekN={setPaycheckWeekN}
              showWeeks={paycheckMode === "week"}
            />
            {paycheckMode === "week" && paycheckWeek && (
              <p className="empty-hint">
                Jobs marked done {formatDateRange(paycheckWeek.weekStart, paycheckWeek.weekEnd)} — that's the
                paycheck this covers
              </p>
            )}
            {paycheckMode === "month" && (
              <p className="empty-hint">Jobs marked done during {paycheckMonth.label} — that's the paycheck this covers</p>
            )}
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadJobsCsv(
                  visibleJobs,
                  paycheckMode === "week"
                    ? `paycheck-week-${paycheckWeek?.weekStartISO ?? paycheckMonthRange.startISO}.csv`
                    : `paycheck-month-${paycheckMonthRange.startISO.slice(0, 7)}.csv`
                )
              }
            >
              ⬇️ Export paycheck report
            </button>
          </>
        )}
      </div>

      {visibleJobs.length === 0 ? (
        <div className="empty-state">
          <p>No jobs match these filters.</p>
        </div>
      ) : (
        <div className="job-cards">
          {visibleJobs.map((job) => {
            const overdue = isOverdue(job);
            const outcome = job.leadOutcome;
            const ticketNumber = extractTicketNumber(job.rawTicketText);
            const customerName = extractCustomerName(job.rawTicketText);
            return (
              <div className="job-card" key={job.id}>
                {customerName && <p className="job-card-customer">{customerName}</p>}
                <div className="job-card-top">
                  <div className="job-card-top-left">
                    <button
                      type="button"
                      className={`status-tag ${job.status}${overdue ? " overdue" : ""}`}
                      onClick={() => toggleStatus(job)}
                    >
                      {job.status === "done"
                        ? `${STATUS_EMOJI.done} Job done`
                        : overdue
                          ? "⚠️ Overdue"
                          : `${STATUS_EMOJI.awaiting} Job awaits`}
                    </button>
                    {ticketNumber && (
                      <button type="button" className="job-number-chip" onClick={() => handleCopyNumber(job, ticketNumber)}>
                        {copiedNumberId === job.id ? "Copied!" : `#${ticketNumber}`}
                      </button>
                    )}
                    {outcome === "deposit" && <span className="deposit-badge">💰 Got Deposit</span>}
                    {job.needsRepairTeam && <span className="repair-badge">🔧 Repair Team</span>}
                    {jobTotal(job) > 0 && balanceRemaining(job) <= 0 && (
                      <span className="paid-off-badge">💸 Ready for payout</span>
                    )}
                  </div>
                  <span className="job-card-total">${jobTotal(job).toFixed(2)}</span>
                </div>

                <dl className="job-card-details">
                  <div>
                    <dt>{job.status === "done" ? "Completed" : "Scheduled"}</dt>
                    <dd>{job.status === "done" ? job.completedDate || "—" : job.scheduledDate || "TBD"}</dd>
                  </div>
                  <div>
                    <dt>Paid</dt>
                    <dd>
                      {totalPaid(job) ? `$${totalPaid(job).toFixed(2)}` : "—"}
                      {job.payments
                        .filter((p) => p.amount && p.method)
                        .map((p) => ` ${DEPOSIT_METHOD_EMOJI[p.method as Exclude<typeof p.method, "">]}`)
                        .join("")}
                    </dd>
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

                {totalPaid(job) > 0 && job.status === "awaiting" && (
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
      )}
    </div>
  );
}
