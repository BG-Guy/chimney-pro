import { useEffect, useMemo, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import { BackIcon } from "./icons";
import { computeDateRanges, fmtISO, todayISO } from "../dateUtils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function firstOfMonth(iso: string): Date {
  const d = isoToDate(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function formatRangeLabel(startISO: string, endISO: string): string {
  const fmt = (iso: string, withYear: boolean) =>
    isoToDate(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  if (startISO === endISO) return fmt(startISO, true);
  const sameYear = startISO.slice(0, 4) === endISO.slice(0, 4);
  return `${fmt(startISO, !sameYear)} – ${fmt(endISO, true)}`;
}

function presets() {
  const r = computeDateRanges();
  return [
    { label: "This week", start: fmtISO(r.weekStart), end: fmtISO(r.weekEnd) },
    { label: "Last week", start: fmtISO(r.lastWeekStart), end: fmtISO(r.lastWeekEnd) },
    { label: "This month", start: fmtISO(r.monthStart), end: fmtISO(r.monthEnd) },
    { label: "Last month", start: fmtISO(r.lastMonthStart), end: fmtISO(r.lastMonthEnd) },
  ];
}

// Classic two-tap range picker: the first tap sets the start, the second the end (tapping a
// day before the start restarts from there). Swipe the month grid sideways to change months.
export default function DateRangeSheet({
  open,
  onClose,
  startISO,
  endISO,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  startISO: string;
  endISO: string;
  onApply: (startISO: string, endISO: string) => void;
}) {
  const [draftStart, setDraftStart] = useState(startISO);
  const [draftEnd, setDraftEnd] = useState<string | null>(endISO);
  const [month, setMonth] = useState(() => firstOfMonth(endISO));
  const [slide, setSlide] = useState<"next" | "prev" | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  // Each time the sheet opens, start from the range currently applied.
  useEffect(() => {
    if (!open) return;
    setDraftStart(startISO);
    setDraftEnd(endISO);
    setMonth(firstOfMonth(endISO));
    setSlide(null);
  }, [open, startISO, endISO]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const result: (string | null)[] = Array(month.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(fmtISO(new Date(year, m, d)));
    return result;
  }, [month]);

  const presetList = useMemo(() => (open ? presets() : []), [open]);
  const today = todayISO();
  const rangeEnd = draftEnd ?? draftStart;

  function shiftMonth(delta: number) {
    setSlide(delta > 0 ? "next" : "prev");
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function pick(iso: string) {
    if (draftEnd || iso < draftStart) {
      setDraftStart(iso);
      setDraftEnd(null);
    } else {
      setDraftEnd(iso);
    }
  }

  function applyPreset(start: string, end: string) {
    setDraftStart(start);
    setDraftEnd(end);
    setSlide(null);
    setMonth(firstOfMonth(start));
  }

  function handleApply() {
    onApply(draftStart, rangeEnd);
    onClose();
  }

  const summary = draftEnd
    ? formatRangeLabel(draftStart, draftEnd)
    : `${formatRangeLabel(draftStart, draftStart)} — now tap the last day`;

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Choose a date range">
      <div className="chip-scroll-row range-presets">
        {presetList.map((p) => (
          <button
            key={p.label}
            type="button"
            className={`chip-pill${draftStart === p.start && draftEnd === p.end ? " selected" : ""}`}
            onClick={() => applyPreset(p.start, p.end)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="calendar-header">
        <button type="button" className="btn btn-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <BackIcon size={16} />
        </button>
        <h3>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
        <button type="button" className="btn btn-sm" onClick={() => shiftMonth(1)} aria-label="Next month">
          <span style={{ display: "flex", transform: "rotate(180deg)" }}>
            <BackIcon size={16} />
          </span>
        </button>
      </div>

      <div
        className="range-grid-wrap"
        onTouchStart={(e) => {
          swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const start = swipeStart.current;
          swipeStart.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1);
        }}
      >
        <div
          key={`${month.getFullYear()}-${month.getMonth()}`}
          className={`calendar-grid range-grid${slide ? ` range-grid-slide ${slide}` : ""}`}
        >
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="calendar-weekday">
              {w}
            </span>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <span key={`blank-${i}`} />;
            const isStart = iso === draftStart;
            const isEnd = iso === rangeEnd;
            const inRange = iso > draftStart && iso < rangeEnd;
            const cls = [
              "range-day",
              inRange && "in-range",
              isStart && "range-start",
              isEnd && "range-end",
              isStart && isEnd && "single",
              iso === today && "today",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button key={iso} type="button" className={cls} onClick={() => pick(iso)}>
                <span>{Number(iso.slice(8))}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="range-summary">{summary}</p>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={handleApply}>
          Apply
        </button>
      </div>
    </BottomSheet>
  );
}
