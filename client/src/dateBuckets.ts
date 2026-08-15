import { addDays, fmtISO } from "./dateUtils";

export interface MonthOption {
  year: number;
  month: number; // 0-11
  label: string;
}

export interface WeekOption {
  n: number;
  label: string;
  weekStart: Date;
  weekEnd: Date;
  weekStartISO: string;
  weekEndISO: string;
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function currentMonthOption(): MonthOption {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), label: monthLabel(now.getFullYear(), now.getMonth()) };
}

// Newest first, so "this month" is the first (leftmost) chip.
export function recentMonths(count = 12): MonthOption[] {
  const now = new Date();
  const months: MonthOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: monthLabel(d.getFullYear(), d.getMonth()) });
  }
  return months;
}

// Every Monday-start week whose Monday falls within the given month, in order. The last
// entry is always relabeled "Last week" (whether it's the 4th or 5th), matching how people
// actually talk about weeks of a month.
export function weeksOfMonth(year: number, month: number): WeekOption[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  let cursor = new Date(monthStart);
  while (cursor.getDay() !== 1) cursor = addDays(cursor, 1);

  const weeks: WeekOption[] = [];
  while (cursor <= monthEnd) {
    const n = Math.ceil(cursor.getDate() / 7);
    const weekEnd = addDays(cursor, 6);
    weeks.push({
      n,
      label: `${ORDINALS[n - 1] ?? `${n}th`} week`,
      weekStart: new Date(cursor),
      weekEnd,
      weekStartISO: fmtISO(cursor),
      weekEndISO: fmtISO(weekEnd),
    });
    cursor = addDays(cursor, 7);
  }

  if (weeks.length > 0) {
    weeks[weeks.length - 1] = { ...weeks[weeks.length - 1], label: "Last week" };
  }
  return weeks;
}

export function currentWeekOfMonthN(year: number, month: number): number {
  const todayISO = fmtISO(new Date());
  const weeks = weeksOfMonth(year, month);
  const match = weeks.find((w) => todayISO >= w.weekStartISO && todayISO <= w.weekEndISO);
  return match ? match.n : (weeks[weeks.length - 1]?.n ?? 1);
}
