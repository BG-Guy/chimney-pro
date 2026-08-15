import { balanceRemaining, jobTotal, techProfit, totalPaid, type GasLog, type Job, type JobStatus } from "./types";
import { addDays, fmtISO, inRange } from "./dateUtils";
import { computePeriodMetrics, type PeriodMetrics } from "./insights";
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
  paid: number;
  balance: number;
}

export interface WeeklyReport {
  label: string;
  dateRange: string;
  weekStartISO: string;
  weekEndISO: string;
  metrics: PeriodMetrics;
  jobs: WeeklyReportJob[];
  totals: WeeklyReportTotals;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function buildWeeklyReport(jobs: Job[], gasLogs: GasLog[], weekStart: Date, label: string): WeeklyReport {
  const weekEnd = addDays(weekStart, 6);
  const weekStartISO = fmtISO(weekStart);
  const weekEndISO = fmtISO(weekEnd);

  const weekJobs: WeeklyReportJob[] = jobs
    .filter((j) => inRange(j.scheduledDate, weekStartISO, weekEndISO))
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
    (acc, j) => ({ paid: acc.paid + j.paid, balance: acc.balance + j.balance }),
    { paid: 0, balance: 0 }
  );

  return {
    label,
    dateRange: `${shortDate(weekStart)} – ${shortDate(weekEnd)}`,
    weekStartISO,
    weekEndISO,
    metrics: computePeriodMetrics(jobs, gasLogs, weekStartISO, weekEndISO),
    jobs: weekJobs,
    totals,
  };
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
    report.metrics.revenue.toFixed(2),
    report.metrics.partsCost.toFixed(2),
    report.metrics.techProfit.toFixed(2),
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
