import { cashOwedToCompany, jobTotal, techProfit, type DepositMethod, type Job } from "./types";
import { addDays, computeDateRanges, fmtISO, inRange } from "./dateUtils";

interface Period {
  jobCount: number;
  revenue: number;
}

function summarizePeriod(jobs: Job[], startStr: string, endStr: string): Period {
  const inPeriod = jobs.filter((j) => inRange(j.scheduledDate, startStr, endStr));
  return {
    jobCount: inPeriod.length,
    revenue: inPeriod.reduce((sum, j) => sum + jobTotal(j), 0),
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
  avgDeposit: number;
  depositMethodCounts: Partial<Record<DepositMethod, number>>;
  thisWeek: Period;
  lastWeek: Period;
  thisMonth: Period;
  lastMonth: Period;
  weeklyTrend: WeekPoint[];
  totalTechProfit: number;
  totalCashOwed: number;
}

export function computeInsights(jobs: Job[]): Insights {
  const { todayStr, weekStart, weekEnd, lastWeekStart, lastWeekEnd, monthStart, monthEnd, lastMonthStart, lastMonthEnd } =
    computeDateRanges();

  const totalJobs = jobs.length;
  const jobsWithDeposit = jobs.filter((j) => j.depositAmount > 0);
  const totalRevenue = jobs.reduce((sum, j) => sum + jobTotal(j), 0);
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const awaitingCount = totalJobs - doneCount;
  const overdueCount = jobs.filter(
    (j) => j.status === "awaiting" && j.scheduledDate && j.scheduledDate < todayStr
  ).length;
  const repairTeamCount = jobs.filter((j) => j.needsRepairTeam).length;

  const depositMethodCounts: Partial<Record<DepositMethod, number>> = {};
  for (const j of jobs) {
    if (!j.depositMethod) continue;
    depositMethodCounts[j.depositMethod] = (depositMethodCounts[j.depositMethod] ?? 0) + 1;
  }

  const weeklyTrend: WeekPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const wStart = addDays(weekStart, -7 * i);
    const wEnd = addDays(wStart, 6);
    const period = summarizePeriod(jobs, fmtISO(wStart), fmtISO(wEnd));
    weeklyTrend.push({ label: fmtISO(wStart), revenue: period.revenue });
  }

  return {
    totalJobs,
    closingRate: totalJobs ? (jobsWithDeposit.length / totalJobs) * 100 : 0,
    avgTicket: totalJobs ? totalRevenue / totalJobs : 0,
    totalRevenue,
    doneCount,
    awaitingCount,
    overdueCount,
    repairTeamPct: totalJobs ? (repairTeamCount / totalJobs) * 100 : 0,
    avgDeposit: jobsWithDeposit.length
      ? jobsWithDeposit.reduce((sum, j) => sum + j.depositAmount, 0) / jobsWithDeposit.length
      : 0,
    depositMethodCounts,
    thisWeek: summarizePeriod(jobs, fmtISO(weekStart), fmtISO(weekEnd)),
    lastWeek: summarizePeriod(jobs, fmtISO(lastWeekStart), fmtISO(lastWeekEnd)),
    thisMonth: summarizePeriod(jobs, fmtISO(monthStart), fmtISO(monthEnd)),
    lastMonth: summarizePeriod(jobs, fmtISO(lastMonthStart), fmtISO(lastMonthEnd)),
    weeklyTrend,
    totalTechProfit: jobs.reduce((sum, j) => sum + techProfit(j), 0),
    totalCashOwed: jobs.reduce((sum, j) => sum + cashOwedToCompany(j), 0),
  };
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
