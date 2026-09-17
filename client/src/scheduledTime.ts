const MONTH_NAMES =
  "January|February|March|April|May|June|July|August|September|October|November|December";

// Matches a line like "September 20, 2026, 2:00 pm" — a full month-day-year plus a clock
// time is the clearest date/time signal in a pasted ticket (short forms like "9/20" or
// "2-5" are too ambiguous to trust on their own).
const DATE_TIME_RE = new RegExp(
  `\\b(?:${MONTH_NAMES})\\s+\\d{1,2},?\\s+\\d{4}.{0,10}?\\d{1,2}:\\d{2}\\s*(?:am|pm)\\b`,
  "i"
);

export function extractScheduledTime(rawTicketText: string): string | null {
  const lines = rawTicketText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  for (const line of lines) {
    const match = line.match(DATE_TIME_RE);
    if (match) return match[0];
  }
  return null;
}
