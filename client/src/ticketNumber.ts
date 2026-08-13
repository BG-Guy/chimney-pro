export function extractTicketNumber(rawTicketText: string): string | null {
  const match = rawTicketText.match(/#([A-Za-z0-9-]+)/);
  return match ? match[1] : null;
}
