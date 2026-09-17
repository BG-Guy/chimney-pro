// Builds a Google Maps multi-stop directions link (no API key needed) that opens
// straight into turn-by-turn navigation through the given addresses, in order.
export function buildGoogleMapsRouteUrl(addresses: string[]): string {
  const params = new URLSearchParams({
    api: "1",
    origin: addresses[0],
    destination: addresses[addresses.length - 1],
    travelmode: "driving",
  });
  const waypoints = addresses.slice(1, -1);
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
