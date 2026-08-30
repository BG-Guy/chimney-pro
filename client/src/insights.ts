import {
  cashOwedToCompany,
  isReadyForPayroll,
  jobTotal,
  techProfit,
  totalPaid,
  type DepositMethod,
  type GasLog,
  type Job,
} from "./types";
import { addDays, computeDateRanges, fmtISO, inRange } from "./dateUtils";

export interface PeriodMetrics {
  jobCount: number;
  revenue: number;
  partsCost: number;
  techProfitRealized: number;
  techProfitAwaiting: number;
  avgTicket: number;
  closingRate: number;
  repairTeamCount: number;
  gasExpense: number;
  cashCollected: number;
}

// Sales-side numbers (jobs, revenue, parts, avg ticket, closing rate, repair team count)
// are bucketed by loggedDate — when the job was actually entered. Realized tech profit is
// a different question — it isn't earned until the job is done and paid off — so it's
// bucketed by completedDate instead: the date the clearing payment landed. A job logged
// three weeks ago but paid off today counts as today's payroll, not that week's sale.
// Profit still awaiting completion is scoped to jobs logged in the period, since that's
// "how much of what I sold this period is still outstanding." Gas expense uses its own date.
export function computePeriodMetrics(
  jobs: Job[],
  gasLogs: GasLog[],
  startStr: string,
  endStr: string
): PeriodMetrics {
  const loggedJobs = jobs.filter((j) => inRange(j.loggedDate, startStr, endStr));
  const completedJobs = jobs.filter((j) => isReadyForPayroll(j) && inRange(j.completedDate, startStr, endStr));
  const jobCount = loggedJobs.length;
  const revenue = loggedJobs.reduce((sum, j) => sum + jobTotal(j), 0);
  const depositsWon = loggedJobs.filter((j) => j.leadOutcome === "deposit").length;

  return {
    jobCount,
    revenue,
    partsCost: loggedJobs.reduce((sum, j) => sum + (Number(j.partsCost) || 0), 0),
    techProfitRealized: completedJobs.reduce((sum, j) => sum + techProfit(j), 0),
    techProfitAwaiting: loggedJobs
      .filter((j) => j.status === "awaiting")
      .reduce((sum, j) => sum + techProfit(j), 0),
    avgTicket: jobCount ? revenue / jobCount : 0,
    closingRate: jobCount ? (depositsWon / jobCount) * 100 : 0,
    repairTeamCount: loggedJobs.filter((j) => j.needsRepairTeam).length,
    gasExpense: gasLogs.filter((g) => inRange(g.date, startStr, endStr)).reduce((sum, g) => sum + g.amount, 0),
    cashCollected: jobs
      .flatMap((j) => j.payments)
      .filter((p) => p.method === "Cash" && inRange(p.date, startStr, endStr))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
  };
}

export interface WeekPoint {
  label: string;
  revenue: number;
}

export interface Insights {
  totalJobs: number;
  closingRate: number;
  avgTicket: number;
  totalRevenue: number;
  doneCount: number;
  awaitingCount: number;
  overdueCount: number;
  repairTeamPct: number;
  avgPaid: number;
  paidMethodCounts: Partial<Record<DepositMethod, number>>;
  weeklyTrend: WeekPoint[];
  totalTechProfit: number;
  totalCashOwed: number;
  totalCashCollected: number;
  dueThisWeekCount: number;
  repairTeamPendingCount: number;
  pendingTechProfit: number;
}

export function computeInsights(jobs: Job[]): Insights {
  const { todayStr, weekStart, weekEnd } = computeDateRanges();

  const totalJobs = jobs.length;
  const depositsWon = jobs.filter((j) => j.leadOutcome === "deposit");
  const jobsPaid = jobs.filter((j) => totalPaid(j) > 0);
  const totalRevenue = jobs.reduce((sum, j) => sum + jobTotal(j), 0);
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const awaitingCount = totalJobs - doneCount;
  const overdueCount = jobs.filter(
    (j) => j.status === "awaiting" && j.scheduledDate && j.scheduledDate < todayStr
  ).length;
  const repairTeamCount = jobs.filter((j) => j.needsRepairTeam).length;
  const awaitingJobs = jobs.filter((j) => j.status === "awaiting");
  const dueThisWeekCount = awaitingJobs.filter((j) =>
    inRange(j.scheduledDate, fmtISO(weekStart), fmtISO(weekEnd))
  ).length;
  const repairTeamPendingCount = awaitingJobs.filter((j) => j.needsRepairTeam).length;
  const pendingTechProfit = awaitingJobs.reduce((sum, j) => sum + techProfit(j), 0);

  const paidMethodCounts: Partial<Record<DepositMethod, number>> = {};
  for (const j of jobs) {
    for (const p of j.payments) {
      if (!p.method || !p.amount) continue;
      paidMethodCounts[p.method] = (paidMethodCounts[p.method] ?? 0) + 1;
    }
  }

  const weeklyTrend: WeekPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const wStart = addDays(weekStart, -7 * i);
    const wEnd = addDays(wStart, 6);
    const wStartISO = fmtISO(wStart);
    const wEndISO = fmtISO(wEnd);
    const revenue = jobs
      .filter((j) => inRange(j.loggedDate, wStartISO, wEndISO))
      .reduce((sum, j) => sum + jobTotal(j), 0);
    weeklyTrend.push({ label: wStartISO, revenue });
  }

  return {
    totalJobs,
    closingRate: totalJobs ? (depositsWon.length / totalJobs) * 100 : 0,
    avgTicket: totalJobs ? totalRevenue / totalJobs : 0,
    totalRevenue,
    doneCount,
    awaitingCount,
    overdueCount,
    repairTeamPct: totalJobs ? (repairTeamCount / totalJobs) * 100 : 0,
    avgPaid: jobsPaid.length
      ? jobsPaid.reduce((sum, j) => sum + totalPaid(j), 0) / jobsPaid.length
      : 0,
    paidMethodCounts,
    weeklyTrend,
    totalTechProfit: jobs.filter(isReadyForPayroll).reduce((sum, j) => sum + techProfit(j), 0),
    totalCashOwed: jobs.reduce((sum, j) => sum + cashOwedToCompany(j), 0),
    totalCashCollected: jobs
      .flatMap((j) => j.payments)
      .filter((p) => p.method === "Cash")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    dueThisWeekCount,
    repairTeamPendingCount,
    pendingTechProfit,
  };
}
