import type { MonthOption, WeekOption } from "../dateBuckets";

export default function MonthWeekPicker({
  months,
  selectedMonth,
  onSelectMonth,
  weeks,
  selectedWeekN,
  onSelectWeekN,
  showWeeks = true,
}: {
  months: MonthOption[];
  selectedMonth: MonthOption;
  onSelectMonth: (month: MonthOption) => void;
  weeks: WeekOption[];
  selectedWeekN: number;
  onSelectWeekN: (n: number) => void;
  showWeeks?: boolean;
}) {
  return (
    <div className="month-week-picker">
      <div className="chip-scroll-row">
        {months.map((m) => (
          <button
            key={`${m.year}-${m.month}`}
            type="button"
            className={`chip-pill${selectedMonth.year === m.year && selectedMonth.month === m.month ? " selected" : ""}`}
            onClick={() => onSelectMonth(m)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {showWeeks && (
        <div className="chip-scroll-row">
          {weeks.map((w) => (
            <button
              key={w.n}
              type="button"
              className={`chip-pill${selectedWeekN === w.n ? " selected" : ""}`}
              onClick={() => onSelectWeekN(w.n)}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
