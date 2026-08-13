export function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return fmtISO(new Date());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const r = addDays(d, diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function inRange(dateStr: string | null, startStr: string, endStr: string): boolean {
  if (!dateStr) return false;
  return dateStr >= startStr && dateStr <= endStr;
}

export interface DateRanges {
  todayStr: string;
  weekStart: Date;
  weekEnd: Date;
  lastWeekStart: Date;
  lastWeekEnd: Date;
  monthStart: Date;
  monthEnd: Date;
  lastMonthStart: Date;
  lastMonthEnd: Date;
}

export function computeDateRanges(): DateRanges {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const lastWeekStart = addDays(weekStart, -7);
  const lastWeekEnd = addDays(weekStart, -1);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  return {
    todayStr: fmtISO(today),
    weekStart,
    weekEnd,
    lastWeekStart,
    lastWeekEnd,
    monthStart,
    monthEnd,
    lastMonthStart,
    lastMonthEnd,
  };
}
