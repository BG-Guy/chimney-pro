const MONTH_NAMES =
  "January|February|March|April|May|June|July|August|September|October|November|December";

// Matches a line like "September 20, 2026, 2:00 pm" — a full month-day-year plus a clock
// time is the clearest date/time signal in a pasted ticket.
const DATE_TIME_RE = new RegExp(
  `\\b(?:${MONTH_NAMES})\\s+\\d{1,2},?\\s+\\d{4}.{0,10}?\\d{1,2}:\\d{2}\\s*(?:am|pm)\\b`,
  "i"
);

// Matches a standalone arrival-window line like "8-11", "11-2", or "8:30-11" — no date, no
// am/pm, just the two hours the tech would jot down by hand.
const SHORT_RANGE_RE = /^(\d{1,2})(?::(\d{2}))?\s*-\s*\d{1,2}(?::\d{2})?$/;

const CLOCK_TIME_RE = /(\d{1,2}):(\d{2})\s*(am|pm)/i;

// Prefers the full date+time line when it's there (unambiguous); otherwise falls back to a
// bare arrival window like "11-2", which is enough to sort the route by even without a date.
export function extractScheduledTime(rawTicketText: string): string | null {
  const lines = rawTicketText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const match = line.match(DATE_TIME_RE);
    if (match) return match[0];
  }
  for (const line of lines) {
    if (SHORT_RANGE_RE.test(line)) return line;
  }
  return null;
}

// Minutes since midnight for the start of the scheduled window, or null when the label
// (whatever extractScheduledTime returned) doesn't carry a usable time at all. A bare
// range's hour has no am/pm on it, so it's read against how a tech's day actually runs:
// 8 through 11 is the morning block, anything else (noon through 7) is the afternoon one.
export function parseScheduledStartMinutes(timeLabel: string | null): number | null {
  if (!timeLabel) return null;

  const clockMatch = timeLabel.match(CLOCK_TIME_RE);
  if (clockMatch) {
    const minute = Number(clockMatch[2]);
    const isPm = /pm/i.test(clockMatch[3]);
    const hour = (Number(clockMatch[1]) % 12) + (isPm ? 12 : 0);
    return hour * 60 + minute;
  }

  const rangeMatch = timeLabel.match(SHORT_RANGE_RE);
  if (rangeMatch) {
    const startHour = Number(rangeMatch[1]);
    const minute = Number(rangeMatch[2] ?? 0);
    const isMorning = startHour >= 8 && startHour <= 11;
    const hour = isMorning ? startHour : (startHour % 12) + 12;
    return hour * 60 + minute;
  }

  return null;
}
