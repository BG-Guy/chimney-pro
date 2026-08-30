// Drops a trailing ".00" (or ".0") so whole-dollar amounts read as "4000" instead of
// "4000.00" wherever money is displayed for a human to read.
function trimTrailingZeros(s: string): string {
  return s.replace(/\.0+$/, "");
}

export function formatMoney(n: number): string {
  const value = Number(n) || 0;
  return `$${trimTrailingZeros(value.toFixed(2))}`;
}

export function formatCompactMoney(n: number): string {
  const value = Number(n) || 0;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${trimTrailingZeros((value / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `$${trimTrailingZeros((value / 1_000).toFixed(1))}K`;
  return `$${Math.round(value)}`;
}
