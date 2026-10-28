import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  STATUS_ICON,
  balanceRemaining,
  cashOwedToCompany,
  jobTotal,
  techProfit,
  totalCardFee,
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
import JobsCalendarSheet from "../components/JobsCalendarSheet";
import PaycheckCompareSheet from "../components/PaycheckCompareSheet";
import JobTicketSheet from "../components/JobTicketSheet";
import BottomSheet from "../components/BottomSheet";
import HeaderActions from "../components/HeaderActions";
import MenuSelect from "../components/MenuSelect";
import { extractAddress } from "../address";
import { navigationUrl } from "../navigation";
import { readCompanyReportPdf } from "../companyReport";
import { comparePaycheck, type PaycheckComparison } from "../paycheckCompare";
import DateButton from "../components/DateButton";
import { currentMonthOption, monthRangeISO, recentMonths, type MonthOption } from "../dateBuckets";
import { addDays, fmtISO, inRange, startOfWeek } from "../dateUtils";
import { downloadJobsCsv, totalCashInJobs } from "../jobsCsv";
import { formatMoney } from "../format";
import {
  CalendarIcon,
  CalendarDaysIcon,
  ClipboardIcon,
  WalletIcon,
  WrenchIcon,
  UserIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  DownloadIcon,
  DollarSignIcon,
  FileCheckIcon,
  MoreIcon,
  NavigateIcon,
  SearchIcon,
} from "../components/icons";

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// "Wed, Oct 28"
function shortDay(iso: string): string {
  return isoToDate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function isOverdue(job: Job): boolean {
  if (job.status !== "awaiting" || !job.scheduledDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return job.scheduledDate < today;
}

function initials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "#";
  const letters = parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  return letters.toUpperCase();
}

const METHOD_NAME: Record<string, string> = { CC: "Card", Cash: "Cash", Check: "Check", Zelle: "Zelle", Other: "Other" };

// The small line under "Paid": the card fee when there is one, otherwise how it was paid.
function paidNote(job: Job): string | null {
  const fee = totalCardFee(job);
  if (fee > 0) return `incl. ${formatMoney(fee)} card fee`;
  const methods = [
    ...new Set(job.payments.filter((p) => Number(p.amount) > 0 && p.method).map((p) => METHOD_NAME[p.method] ?? p.method)),
  ];
  return methods.length ? methods.join(" + ") : null;
}

function jobSubtitle(job: Job, ticketNumber: string | null): string {
  const parts: string[] = [];
  if (job.status === "done") {
    parts.push(job.completedDate ? `Done ${shortDay(job.completedDate)}` : "Done");
  } else if (job.scheduledDate) {
    parts.push(shortDay(job.scheduledDate));
    if (job.scheduledTimeRange) parts.push(job.scheduledTimeRange);
  } else {
    parts.push("Not scheduled");
  }
  if (ticketNumber) parts.push(`#${ticketNumber}`);
  return parts.join(" · ");
}

type SortMode = "newest" | "oldest" | "scheduled" | "total";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "scheduled", label: "By job date" },
  { value: "total", label: "Highest total" },
];

type CrewFilter = "all" | "tech" | "repair";

const CREW_OPTIONS: { value: CrewFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "tech", label: "Tech" },
  { value: "repair", label: "Repair team" },
];

const STATUS_FILTER_OPTIONS: Choice<JobStatus | "all">[] = [
  { value: "all", label: "All", icon: ClipboardIcon },
  { value: "awaiting", label: "Awaiting", icon: STATUS_ICON.awaiting },
  { value: "done", label: "Done", icon: STATUS_ICON.done },
];

type PaycheckMode = "range" | "month";

const PAYCHECK_MODE_OPTIONS: Choice<PaycheckMode>[] = [
  { value: "range", label: "Date range", icon: CalendarIcon },
  { value: "month", label: "Month", icon: CalendarDaysIcon },
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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [ticketJob, setTicketJob] = useState<Job | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsJob, setActionsJob] = useState<Job | null>(null);
  const [comparison, setComparison] = useState<PaycheckComparison | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareFileName, setCompareFileName] = useState("");
  const [comparing, setComparing] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [crewFilter, setCrewFilter] = useState<CrewFilter>("all");
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [paycheckFilterOn, setPaycheckFilterOn] = useState(false);
  const [paycheckMode, setPaycheckMode] = useState<PaycheckMode>("range");
  const [paycheckMonth, setPaycheckMonth] = useState<MonthOption>(() => currentMonthOption());
  const [paycheckRangeStart, setPaycheckRangeStart] = useState<string>(() => fmtISO(startOfWeek(new Date())));
  const [paycheckRangeEnd, setPaycheckRangeEnd] = useState<string>(() =>
    fmtISO(addDays(startOfWeek(new Date()), 6))
  );

  useEffect(() => {
    api
      .listJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
    api.listTags().then(setTags);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function toggleTagFilter(tagId: number) {
    setTagFilter((prev) => (prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]));
  }

  const paycheckMonths = useMemo(() => recentMonths(12), []);
  const paycheckMonthRange = useMemo(
    () => monthRangeISO(paycheckMonth.year, paycheckMonth.month),
    [paycheckMonth]
  );
  const paycheckRange = useMemo(
    () =>
      paycheckRangeStart <= paycheckRangeEnd
        ? { startISO: paycheckRangeStart, endISO: paycheckRangeEnd }
        : { startISO: paycheckRangeEnd, endISO: paycheckRangeStart },
    [paycheckRangeStart, paycheckRangeEnd]
  );

  const visibleJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (crewFilter === "tech" && job.needsRepairTeam) return false;
      if (crewFilter === "repair" && !job.needsRepairTeam) return false;
      if (tagFilter.length > 0 && !job.tagIds.some((id) => tagFilter.includes(id))) return false;
      if (q) {
        const customerName = (extractCustomerName(job.rawTicketText) ?? "").toLowerCase();
        const ticketNumber = (extractTicketNumber(job.rawTicketText) ?? "").toLowerCase();
        const matches = customerName.includes(q) || ticketNumber.includes(q) || String(job.id).includes(q);
        if (!matches) return false;
      }
      if (paycheckFilterOn) {
        if (paycheckMode === "range") {
          if (!inRange(job.completedDate, paycheckRange.startISO, paycheckRange.endISO)) return false;
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
    crewFilter,
    tagFilter,
    searchQuery,
    paycheckFilterOn,
    paycheckMode,
    paycheckRange,
    paycheckMonthRange,
  ]);

  const statusCounts = useMemo(() => {
    let done = 0;
    let waitingForPayment = 0;
    let awaits = 0;
    let techProfitAwaiting = 0;
    let techJobsAwaiting = 0;
    let repairJobsAwaiting = 0;
    for (const job of visibleJobs) {
      if (job.status === "done") {
        done++;
        continue;
      }
      if (job.leadOutcome === "deposit") waitingForPayment++;
      else awaits++;
      techProfitAwaiting += techProfit(job);
      if (job.needsRepairTeam) repairJobsAwaiting++;
      else techJobsAwaiting++;
    }
    return { done, waitingForPayment, awaits, techProfitAwaiting, techJobsAwaiting, repairJobsAwaiting };
  }, [visibleJobs]);

  function flash(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }

  async function handleCopy(job: Job) {
    await navigator.clipboard.writeText(formatTicketText(job));
    setCopiedId(job.id!);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function openActions(job: Job) {
    setActionsJob(job);
    setActionsOpen(true);
  }

  async function handleCopyOriginal(job: Job) {
    await navigator.clipboard.writeText(job.rawTicketText);
    setActionsOpen(false);
    flash("Original ticket copied");
  }

  async function handleCopyNumber(ticketNumber: string) {
    await navigator.clipboard.writeText(ticketNumber);
    setActionsOpen(false);
    flash(`Copied #${ticketNumber}`);
  }

  async function handleComparePdf(file: File) {
    setComparing(true);
    try {
      const report = await readCompanyReportPdf(file);
      if (report.jobs.length === 0) {
        alert("Couldn't find any jobs in that PDF. Make sure it's the company's finance report.");
        return;
      }
      setComparison(comparePaycheck(report, jobs));
      setCompareFileName(file.name);
      setCompareOpen(true);
    } catch (err) {
      console.error(err);
      const reason = err instanceof Error ? err.message : String(err);
      alert(`Couldn't read that PDF. Make sure it's the company's finance report.\n\n(${reason})`);
    } finally {
      setComparing(false);
    }
  }

  async function handleDelete(job: Job) {
    if (!confirm(`Delete this job (#${job.id})?`)) return;
    setActionsOpen(false);
    await api.deleteJob(job.id!);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    flash("Job deleted");
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

  const openJobs = statusCounts.awaits + statusCounts.waitingForPayment;
  const actionsNumber = actionsJob ? extractTicketNumber(actionsJob.rawTicketText) : null;
  const viewport = document.querySelector(".phone-viewport");

  return (
    <div className="job-list">
      <HeaderActions>
        <button type="button" className="icon-button" aria-label="Open the jobs calendar" onClick={() => setCalendarOpen(true)}>
          <CalendarDaysIcon size={24} />
        </button>
      </HeaderActions>

      <JobTicketSheet job={ticketJob} onClose={() => setTicketJob(null)} />
      <JobsCalendarSheet open={calendarOpen} jobs={jobs} onClose={() => setCalendarOpen(false)} />
      <PaycheckCompareSheet
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        comparison={comparison}
        fileName={compareFileName}
      />
      <BottomSheet open={actionsOpen} onClose={() => setActionsOpen(false)} ariaLabel="Job actions">
        {actionsJob && (
          <>
            <div className="action-list">
              <div className="action-list-title">
                {extractCustomerName(actionsJob.rawTicketText) ?? `Job ${actionsJob.id}`}
              </div>
              <button type="button" onClick={() => handleCopyOriginal(actionsJob)}>
                Copy original ticket
              </button>
              {actionsNumber && (
                <button type="button" onClick={() => handleCopyNumber(actionsNumber)}>
                  Copy job number #{actionsNumber}
                </button>
              )}
              <button type="button" className="danger" onClick={() => handleDelete(actionsJob)}>
                Delete job
              </button>
            </div>
            <div className="action-list">
              <button type="button" style={{ fontWeight: 600 }} onClick={() => setActionsOpen(false)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </BottomSheet>
      {toast &&
        viewport &&
        createPortal(
          <div className="toast" role="status">
            {toast}
          </div>,
          viewport
        )}

      <label className="search-field">
        <SearchIcon size={17} />
        <input
          type="search"
          placeholder="Search customer or job #"
          aria-label="Search by customer or job number"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </label>

      <div className="jobs-toolbar">
        <ChoiceBoxes options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        <div className="filter-pills">
          <MenuSelect label="Who does the job" value={crewFilter} options={CREW_OPTIONS} onChange={setCrewFilter} />
          <MenuSelect label="Sort jobs" value={sortMode} options={SORT_OPTIONS} onChange={setSortMode} />
          <button
            type="button"
            className={`chip-pill${paycheckFilterOn ? " selected" : ""}`}
            aria-pressed={paycheckFilterOn}
            onClick={() => setPaycheckFilterOn((prev) => !prev)}
          >
            <WalletIcon size={16} /> Paycheck report
          </button>
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
                  aria-pressed={selected}
                  onClick={() => toggleTagFilter(tag.id!)}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {paycheckFilterOn && (
        <section className="paycheck-panel" aria-label="Paycheck report">
          <div className="paycheck-panel-head">
            <h2>Paycheck report</h2>
            <button type="button" className="btn btn-plain btn-sm" onClick={() => setPaycheckFilterOn(false)}>
              Done
            </button>
          </div>
          <ChoiceBoxes options={PAYCHECK_MODE_OPTIONS} value={paycheckMode} onChange={setPaycheckMode} />
          {paycheckMode === "range" && (
            <div className="paycheck-date-range">
              <label>
                From
                <DateButton value={paycheckRangeStart} onChange={(v) => setPaycheckRangeStart(v || paycheckRangeStart)} />
              </label>
              <label>
                To
                <DateButton value={paycheckRangeEnd} onChange={(v) => setPaycheckRangeEnd(v || paycheckRangeEnd)} />
              </label>
            </div>
          )}
          {paycheckMode === "month" && (
            <MonthWeekPicker months={paycheckMonths} selectedMonth={paycheckMonth} onSelectMonth={setPaycheckMonth} />
          )}
          <p className="empty-hint">
            {paycheckMode === "range"
              ? `Jobs marked done ${formatDateRange(isoToDate(paycheckRange.startISO), isoToDate(paycheckRange.endISO))} — that's the paycheck this covers.`
              : `Jobs marked done during ${paycheckMonth.label} — that's the paycheck this covers.`}
          </p>
          <p className="subtotal">Cash collected: {formatMoney(totalCashInJobs(visibleJobs))}</p>
          <div className="paycheck-actions">
            <button
              type="button"
              className="btn btn-tinted"
              onClick={() =>
                downloadJobsCsv(
                  visibleJobs,
                  paycheckMode === "range"
                    ? `paycheck-${paycheckRange.startISO}-to-${paycheckRange.endISO}.csv`
                    : `paycheck-month-${paycheckMonthRange.startISO.slice(0, 7)}.csv`
                )
              }
            >
              <DownloadIcon size={17} /> Export paycheck report
            </button>
            <button
              type="button"
              className="btn btn-tinted"
              disabled={comparing}
              onClick={() => pdfInputRef.current?.click()}
            >
              <FileCheckIcon size={17} /> {comparing ? "Reading PDF..." : "Compare with company report (PDF)"}
            </button>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleComparePdf(file);
              }}
            />
          </div>
        </section>
      )}

      <section className="summary-card" aria-label="Money waiting on open jobs">
        <span className="summary-label">Tech profit awaiting</span>
        <span className="summary-value">{formatMoney(statusCounts.techProfitAwaiting)}</span>
        <span className="summary-sub">
          From {openJobs} open job{openJobs === 1 ? "" : "s"} · {statusCounts.techJobsAwaiting} tech,{" "}
          {statusCounts.repairJobsAwaiting} repair team
        </span>
        <div className="summary-counts">
          <div>
            <span className="summary-count">{statusCounts.awaits}</span>
            <span className="summary-count-label">Awaiting</span>
          </div>
          <div>
            <span className="summary-count">{statusCounts.done}</span>
            <span className="summary-count-label">Done</span>
          </div>
          <div>
            <span className="summary-count">{statusCounts.waitingForPayment}</span>
            <span className="summary-count-label">Waiting for payment</span>
          </div>
        </div>
      </section>

      {visibleJobs.length === 0 ? (
        <div className="empty-state">
          <p>No jobs match these filters.</p>
        </div>
      ) : (
        <>
          <h2 className="section-title">
            {visibleJobs.length} job{visibleJobs.length === 1 ? "" : "s"}
          </h2>
          <div className="job-cards">
            {visibleJobs.map((job) => {
              const overdue = isOverdue(job);
              const ticketNumber = extractTicketNumber(job.rawTicketText);
              const customerName = extractCustomerName(job.rawTicketText);
              const address = extractAddress(job.rawTicketText);
              const total = jobTotal(job);
              const paid = totalPaid(job);
              const note = paidNote(job);
              const tone = job.status === "done" ? "done" : job.needsRepairTeam ? "repair" : "";
              return (
                <article
                  className="job-card job-card-tappable"
                  key={job.id}
                  onClick={(e) => {
                    // Buttons and links on the card do their own thing; a tap anywhere else opens the ticket.
                    if ((e.target as HTMLElement).closest("button, a")) return;
                    setTicketJob(job);
                  }}
                >
                  <div className="job-card-head">
                    <span className={`avatar ${tone}`} aria-hidden="true">
                      {initials(customerName)}
                    </span>
                    <div className="job-card-title">
                      <h3>{customerName ?? "No name"}</h3>
                      <span className="job-card-sub">{jobSubtitle(job, ticketNumber)}</span>
                    </div>
                    <span className="job-card-total">{formatMoney(total)}</span>
                  </div>

                  <div className="badge-row">
                    {job.status === "done" ? (
                      <span className="badge good">
                        <CheckCircleIcon size={13} /> {total > 0 ? "Ready for payout" : "Done"}
                      </span>
                    ) : overdue ? (
                      <span className="badge danger">
                        <AlertTriangleIcon size={13} /> Overdue
                      </span>
                    ) : (
                      <span className="badge warn">
                        <STATUS_ICON.awaiting size={13} /> Awaiting
                      </span>
                    )}
                    {job.status !== "done" && job.leadOutcome === "deposit" && (
                      <span className="badge accent">
                        <WalletIcon size={13} /> Got deposit
                      </span>
                    )}
                    {job.needsRepairTeam ? (
                      <span className="badge repair">
                        <WrenchIcon size={13} /> Repair team
                      </span>
                    ) : (
                      <span className="badge">
                        <UserIcon size={13} /> Tech
                      </span>
                    )}
                  </div>

                  <dl className="money-row">
                    <div>
                      <dt>Paid</dt>
                      <dd>
                        {paid ? formatMoney(paid) : "—"}
                        {note && <span className="money-sub">{note}</span>}
                      </dd>
                    </div>
                    <div>
                      <dt>Balance</dt>
                      <dd>{formatMoney(balanceRemaining(job))}</dd>
                    </div>
                    <div>
                      <dt>Tech profit</dt>
                      <dd>{formatMoney(techProfit(job))}</dd>
                    </div>
                  </dl>

                  {cashOwedToCompany(job) > 0 && (
                    <p className="callout">
                      <DollarSignIcon size={16} /> Tech collected cash — owes company{" "}
                      {formatMoney(cashOwedToCompany(job))}
                    </p>
                  )}

                  <div className="job-card-actions">
                    {address ? (
                      <a className="btn btn-primary" href={navigationUrl(address)} target="_blank" rel="noreferrer">
                        <NavigateIcon size={16} /> Navigate
                      </a>
                    ) : (
                      <button type="button" className="btn" disabled>
                        No address
                      </button>
                    )}
                    <button type="button" className="btn btn-tinted" onClick={() => handleCopy(job)}>
                      {copiedId === job.id ? "Copied!" : "Copy"}
                    </button>
                    <Link to={`/jobs/${job.id}/edit`} className="btn">
                      Edit
                    </Link>
                    <button type="button" className="btn btn-icon" aria-label="More actions" onClick={() => openActions(job)}>
                      <MoreIcon size={20} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
