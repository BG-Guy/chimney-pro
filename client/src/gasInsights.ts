import type { GasLog } from "./types";
import { addDays, computeDateRanges, fmtISO, inRange } from "./dateUtils";

function sumInRange(logs: GasLog[], startStr: string, endStr: string): number {
  return logs.filter((l) => inRange(l.date, startStr, endStr)).reduce((sum, l) => sum + l.amount, 0);
}

export interface GasWeekPoint {
  label: string;
  amount: number;
}

export interface GasInsights {
  totalAllTime: number;
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
  lastMonth: number;
  weeklyTrend: GasWeekPoint[];
}

export function computeGasInsights(logs: GasLog[]): GasInsights {
  const { weekStart, weekEnd, lastWeekStart, lastWeekEnd, monthStart, monthEnd, lastMonthStart, lastMonthEnd } =
    computeDateRanges();

  const weeklyTrend: GasWeekPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const wStart = addDays(weekStart, -7 * i);
    const wEnd = addDays(wStart, 6);
    weeklyTrend.push({ label: fmtISO(wStart), amount: sumInRange(logs, fmtISO(wStart), fmtISO(wEnd)) });
  }

  return {
    totalAllTime: logs.reduce((sum, l) => sum + l.amount, 0),
    thisWeek: sumInRange(logs, fmtISO(weekStart), fmtISO(weekEnd)),
    lastWeek: sumInRange(logs, fmtISO(lastWeekStart), fmtISO(lastWeekEnd)),
    thisMonth: sumInRange(logs, fmtISO(monthStart), fmtISO(monthEnd)),
    lastMonth: sumInRange(logs, fmtISO(lastMonthStart), fmtISO(lastMonthEnd)),
    weeklyTrend,
  };
}
