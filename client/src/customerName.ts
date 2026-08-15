export function extractCustomerName(rawTicketText: string): string | null {
  const firstLine = rawTicketText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine || null;
}
