import { balanceRemaining, jobTotal, techProfit, totalPaid, type Job, type JobStatus } from "./types";
import { addDays, computeDateRanges, fmtISO, inRange } from "./dateUtils";
import { extractCustomerName } from "./customerName";

export interface WeeklyReportJob {
  id: number;
  customerName: string | null;
  status: JobStatus;
  total: number;
  partsCost: number;
  techProfit: number;
  paid: number;
  paidMethods: string;
  balance: number;
}

export interface WeeklyReportTotals {
  total: number;
  partsCost: number;
  techProfit: number;
  paid: number;
  balance: number;
}

export interface WeeklyReport {
  key: string;
  label: string;
  dateRange: string;
  weekStartISO: string;
  weekEndISO: string;
  jobs: WeeklyReportJob[];
  totals: WeeklyReportTotals;
}

const WEEK_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

// weekStart is always a Monday, so bucketing the month's days into 7-day chunks gives a
// stable "Nth week of the month" label without needing a full calendar-week calculation.
function weekLabel(weekStart: Date): string {
  const month = weekStart.toLocaleDateString(undefined, { month: "long" });
  const n = Math.ceil(weekStart.getDate() / 7);
  const ordinal = WEEK_ORDINALS[n - 1] ?? `${n}th`;
  return `${month} ${ordinal} week`;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function computeWeeklyReports(jobs: Job[], weeksBack = 8): WeeklyReport[] {
  const { weekStart } = computeDateRanges();
  const reports: WeeklyReport[] = [];

  for (let i = 0; i < weeksBack; i++) {
    const wStart = addDays(weekStart, -7 * i);
    const wEnd = addDays(wStart, 6);
    const wStartISO = fmtISO(wStart);
    const wEndISO = fmtISO(wEnd);

    const weekJobs: WeeklyReportJob[] = jobs
      .filter((j) => inRange(j.scheduledDate, wStartISO, wEndISO))
      .map((j) => ({
        id: j.id!,
        customerName: extractCustomerName(j.rawTicketText),
        status: j.status,
        total: jobTotal(j),
        partsCost: Number(j.partsCost) || 0,
        techProfit: techProfit(j),
        paid: totalPaid(j),
        paidMethods: Array.from(
          new Set(j.payments.filter((p) => p.amount && p.method).map((p) => p.method))
        ).join(", "),
        balance: balanceRemaining(j),
      }));

    const totals = weekJobs.reduce<WeeklyReportTotals>(
      (acc, j) => ({
        total: acc.total + j.total,
        partsCost: acc.partsCost + j.partsCost,
        techProfit: acc.techProfit + j.techProfit,
        paid: acc.paid + j.paid,
        balance: acc.balance + j.balance,
      }),
      { total: 0, partsCost: 0, techProfit: 0, paid: 0, balance: 0 }
    );

    reports.push({
      key: wStartISO,
      label: weekLabel(wStart),
      dateRange: `${shortDate(wStart)} – ${shortDate(wEnd)}`,
      weekStartISO: wStartISO,
      weekEndISO: wEndISO,
      jobs: weekJobs,
      totals,
    });
  }

  return reports;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function weeklyReportCsv(report: WeeklyReport): string {
  const header = ["Job ID", "Customer", "Status", "Total", "Parts", "Tech Profit", "Paid", "Paid By", "Balance"];
  const rows = report.jobs.map((j) => [
    String(j.id),
    j.customerName ?? "",
    j.status,
    j.total.toFixed(2),
    j.partsCost.toFixed(2),
    j.techProfit.toFixed(2),
    j.paid.toFixed(2),
    j.paidMethods,
    j.balance.toFixed(2),
  ]);
  const totalsRow = [
    "Totals",
    "",
    "",
    report.totals.total.toFixed(2),
    report.totals.partsCost.toFixed(2),
    report.totals.techProfit.toFixed(2),
    report.totals.paid.toFixed(2),
    "",
    report.totals.balance.toFixed(2),
  ];
  return [header, ...rows, [], totalsRow].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadWeeklyReportCsv(report: WeeklyReport) {
  const csv = weeklyReportCsv(report);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `weekly-report-${report.weekStartISO}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
