import { extractTicketNumber } from "./ticketNumber";

// The dispatch texts arrive one ticket per message, and the Shortcut stacks them all into one
// block of text. Each ticket starts at its "New job #500033837" line (the phone line's
// "#379" extension is too short to be mistaken for one), with any short header just above it
// like "A1 Chimney" kept with the ticket it belongs to.
const TICKET_START_RE = /#\d{6,}/;
const HEADER_RE = /^[A-Za-z][A-Za-z0-9 &'.-]{0,40}$/;

export function splitTickets(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const starts: number[] = [];
  lines.forEach((line, i) => {
    if (!TICKET_START_RE.test(line)) return;
    const prev = lines[i - 1]?.trim() ?? "";
    starts.push(i > 0 && HEADER_RE.test(prev) && !starts.includes(i - 1) ? i - 1 : i);
  });
  if (starts.length === 0) return text.trim() ? [text.trim()] : [];

  const tickets = starts.map((start, n) => lines.slice(start, starts[n + 1] ?? lines.length).join("\n").trim());

  // The same text can land in the file twice (an automation that ran twice) — keep one.
  const seen = new Set<string>();
  return tickets.filter((t) => {
    const key = extractTicketNumber(t) ?? t;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// The ticket's appointment day from its "October 28, 2026, 11:00 am" line, as YYYY-MM-DD.
export function ticketDateISO(ticket: string): string | null {
  const m = ticket.match(new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
