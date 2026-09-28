// A line like "14 Washington Ave, Berlin, New Jersey 08009" — state names vary in word
// count ("NJ" vs "New Jersey"), so we check structure by comma-separated part rather than
// matching the whole thing with one rigid regex.
const STREET_START_RE = /^\d+\s+\S/;
const ZIP_END_RE = /\d{5}(-\d{4})?\s*$/;

function looksLikeAddressLine(line: string): boolean {
  const parts = line
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return false;
  return STREET_START_RE.test(parts[0]) && ZIP_END_RE.test(parts[parts.length - 1]);
}

export function extractAddress(rawTicketText: string): string | null {
  const lines = rawTicketText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.find(looksLikeAddressLine) ?? null;
}

// A rough stand-in for an address our geocoder can't find — just the state and ZIP from
// its last part ("Berlin, New Jersey 08009" -> "New Jersey 08009", "Berlin NJ 08009" ->
// "NJ 08009"). Good enough to place the stop in the right area for ordering the route.
export function zipAndStateOnly(address: string): string | null {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const match = parts[parts.length - 1]?.match(/^(.*?)\s*(\d{5})(-\d{4})?$/);
  if (!match) return null;
  const [, beforeZip, zip] = match;
  const stateAbbrev = beforeZip.match(/\b[A-Z]{2}$/);
  const state = stateAbbrev ? stateAbbrev[0] : beforeZip;
  return state ? `${state} ${zip}` : zip;
}
