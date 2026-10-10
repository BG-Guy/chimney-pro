import { jobTotal, techProfit, type Job } from "./types";
import { extractTicketNumber } from "./ticketNumber";
import { extractCustomerName } from "./customerName";
import { inRange } from "./dateUtils";
import type { CompanyReport, CompanyReportJob } from "./companyReport";

export type CompareField = "total" | "cash" | "credit" | "check" | "techProfit" | "balanceTech";

export const COMPARE_FIELDS: CompareField[] = ["total", "cash", "credit", "check", "techProfit", "balanceTech"];

export const COMPARE_FIELD_LABEL: Record<CompareField, string> = {
  total: "Total",
  cash: "Cash",
  credit: "Credit card",
  check: "Check",
  techProfit: "Tech profit",
  balanceTech: "Balance",
};

export type PaycheckLine = Record<CompareField, number>;

// The same columns the company report has, worked out from the app's own job record.
// Balance follows the report's convention: tech profit minus the cash the tech kept.
export function appPaycheckLine(job: Job): PaycheckLine {
  const byMethod = (method: string) =>
    job.payments.reduce((sum, p) => sum + (p.method === method ? Number(p.amount) || 0 : 0), 0);
  const profit = techProfit(job);
  const cash = byMethod("Cash");
  return {
    total: jobTotal(job),
    cash,
    credit: byMethod("CC"),
    check: byMethod("Check"),
    techProfit: profit,
    balanceTech: profit - cash,
  };
}

function cents(n: number): number {
  return Math.round(n * 100);
}

export interface FieldDiff {
  field: CompareField;
  company: number;
  app: number;
}

export interface ComparedJob {
  jobId: string;
  name: string;
  company: CompanyReportJob;
  app: Job;
  diffs: FieldDiff[];
  // False when the app wouldn't put this job in this paycheck (not done yet, or done on
  // a date outside the report's period) — a timing difference even if the money matches.
  inAppPeriod: boolean;
}

export interface AppOnlyJob {
  job: Job;
  jobId: string | null;
  name: string;
  line: PaycheckLine;
}

export interface PaycheckComparison {
  startISO: string | null;
  endISO: string | null;
  compared: ComparedJob[];
  onlyInReport: CompanyReportJob[];
  onlyInApp: AppOnlyJob[];
  companyTotals: PaycheckLine;
  appTotals: PaycheckLine;
}

function emptyLine(): PaycheckLine {
  return { total: 0, cash: 0, credit: 0, check: 0, techProfit: 0, balanceTech: 0 };
}

function addLine(into: PaycheckLine, line: PaycheckLine) {
  for (const f of COMPARE_FIELDS) into[f] += line[f];
}

// Jobs are matched by the ticket number in the pasted ticket ("New job #500032697") against
// the report's Job Id. The app's side of the paycheck is the same rule the Jobs tab's
// paycheck report uses: jobs completed within the report's dates.
export function comparePaycheck(report: CompanyReport, jobs: Job[]): PaycheckComparison {
  const byTicket = new Map<string, Job>();
  for (const job of jobs) {
    const num = extractTicketNumber(job.rawTicketText);
    if (num && !byTicket.has(num)) byTicket.set(num, job);
  }

  const inPeriod = (job: Job) =>
    report.startISO && report.endISO ? inRange(job.completedDate, report.startISO, report.endISO) : false;

  const compared: ComparedJob[] = [];
  const onlyInReport: CompanyReportJob[] = [];
  const companyTotals = emptyLine();
  const reportIds = new Set<string>();

  for (const row of report.jobs) {
    reportIds.add(row.jobId);
    addLine(companyTotals, row);
    const job = byTicket.get(row.jobId);
    if (!job) {
      onlyInReport.push(row);
      continue;
    }
    const line = appPaycheckLine(job);
    compared.push({
      jobId: row.jobId,
      name: extractCustomerName(job.rawTicketText) ?? row.client,
      company: row,
      app: job,
      diffs: COMPARE_FIELDS.filter((f) => cents(row[f]) !== cents(line[f])).map((f) => ({
        field: f,
        company: row[f],
        app: line[f],
      })),
      inAppPeriod: inPeriod(job),
    });
  }

  const appTotals = emptyLine();
  const onlyInApp: AppOnlyJob[] = [];
  for (const job of jobs.filter(inPeriod)) {
    const line = appPaycheckLine(job);
    addLine(appTotals, line);
    const jobId = extractTicketNumber(job.rawTicketText);
    if (!jobId || !reportIds.has(jobId)) {
      onlyInApp.push({ job, jobId, name: extractCustomerName(job.rawTicketText) ?? "No name", line });
    }
  }

  return {
    startISO: report.startISO,
    endISO: report.endISO,
    compared,
    onlyInReport,
    onlyInApp,
    companyTotals,
    appTotals,
  };
}
