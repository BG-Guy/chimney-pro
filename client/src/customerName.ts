// The customer name is always the line right after the job ticket line (the one starting with "#").
export function extractCustomerName(rawTicketText: string): string | null {
  const lines = rawTicketText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const ticketLineIndex = lines.findIndex((line) => line.startsWith("#"));
  if (ticketLineIndex === -1) return null;
  return lines[ticketLineIndex + 1] || null;
}
