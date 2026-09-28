// The customer's name is the line right below the "#123456" job ticket number line — not
// just "whatever the second line is," since anything before the ticket number line (a
// header, a blank line, a label) would otherwise throw that off. Matches "#" anywhere in
// the line (e.g. "New job #500032566"), not just lines that start with it, since real
// pasted tickets usually have a label before the ticket number.
export function extractCustomerName(rawTicketText: string): string | null {
  const lines = rawTicketText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const ticketNumberIndex = lines.findIndex((line) => /#[A-Za-z0-9-]+/.test(line));
  if (ticketNumberIndex !== -1) {
    return lines[ticketNumberIndex + 1] || null;
  }

  // No "#..." row at all — fall back to the first line, since nothing precedes it.
  return lines[0] || null;
}
