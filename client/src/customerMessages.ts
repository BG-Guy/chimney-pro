import { extractCustomerName } from "./customerName";
import { parseScheduledStartMinutes } from "./scheduledTime";

// Who the texts are signed by. One place to change it if the name or company ever does.
const TECH_NAME = "Guy";
const COMPANY_NAME = "a1 chimney";

// "Anthony Smith" -> "Anthony". Falls back to no name at all ("Hi!") rather than a
// placeholder like "Stop 3" when the ticket didn't carry one.
export function customerFirstName(rawTicketText: string): string | null {
  const full = extractCustomerName(rawTicketText)?.trim();
  if (!full) return null;
  const first = full.split(/\s+/)[0].replace(/[,.;:]+$/, "");
  if (!first || /\d|#/.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function greeting(firstName: string | null): string {
  return firstName ? `Hi ${firstName}!` : "Hi!";
}

export function etaMessage(firstName: string | null, minutes: number): string {
  return `${greeting(firstName)} This is ${TECH_NAME} from ${COMPANY_NAME}, I’ll arrive in about ${minutes} minutes, see you then!`;
}

export function lateMessage(firstName: string | null, currentSlot: string, newSlot: string): string {
  return `${greeting(firstName)} This is ${TECH_NAME} from ${COMPANY_NAME}, looks like ${currentSlot} is a little too soon, will ${newSlot} work as well?`;
}

// A US phone number from the ticket, digits only ("+15551234567" style without the +1
// when it's 10 digits). Lines with a "#" are skipped so a long ticket number can't pass as
// a phone number, and a separator or parentheses are required so a ZIP+4 or bare id can't either.
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]+(\d{3})[\s.-]?(\d{4})\b|\b(\d{3})(\d{3})(\d{4})\b/;

export function extractPhone(rawTicketText: string): string | null {
  for (const line of rawTicketText.split("\n")) {
    if (line.includes("#")) continue;
    const m = line.match(PHONE_RE);
    if (!m) continue;
    const digits = m[1] ? `${m[1]}${m[2]}${m[3]}` : `${m[4]}${m[5]}${m[6]}`;
    if (digits.length === 10) return digits;
  }
  return null;
}

// Opens the phone's Messages app with the text filled in (and the customer's number, when
// the ticket has one). "?&body=" is the form both iOS and Android accept.
export function smsHref(phone: string | null, body: string): string {
  return `sms:${phone ?? ""}?&body=${encodeURIComponent(body)}`;
}

// --- Arrival windows, written the way the office writes them: "11-2", no am/pm. ---

// Hours on a 24h clock that the wheel offers, 6 am through 9 pm.
export const SLOT_HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

export function hour12(h24: number): number {
  return h24 % 12 === 0 ? 12 : h24 % 12;
}

export function hourLabel(h24: number): string {
  return `${hour12(h24)} ${h24 < 12 ? "am" : "pm"}`;
}

export function formatSlot(startH24: number, endH24: number): string {
  return `${hour12(startH24)}-${hour12(endH24)}`;
}

const SHORT_RANGE_RE = /^(\d{1,2})(?::\d{2})?\s*-\s*(\d{1,2})(?::\d{2})?$/;

// The stop's current window as start/end hours (24h). A bare "11-2" is read the same way
// the route sorting reads it (8–11 morning, the rest afternoon); a full appointment time
// like "October 28, 2026, 2:00 pm" becomes a 3-hour window starting then.
export function slotFromStopTime(time: string): { start: number; end: number } | null {
  const startMinutes = parseScheduledStartMinutes(time || null);
  if (startMinutes === null) return null;
  const start = Math.floor(startMinutes / 60);
  const range = time.trim().match(SHORT_RANGE_RE);
  if (range) {
    const endRaw = Number(range[2]) % 12;
    // The end is the first hour after the start that reads as that number on a 12h clock.
    let end = start + 1;
    while (end % 12 !== endRaw && end < start + 12) end++;
    return { start, end };
  }
  return { start, end: start + 3 };
}

export function clampHour(h: number): number {
  return Math.min(SLOT_HOURS[SLOT_HOURS.length - 1], Math.max(SLOT_HOURS[0], h));
}
