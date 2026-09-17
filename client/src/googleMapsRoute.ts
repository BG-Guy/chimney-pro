// Builds a Google Maps multi-stop directions link (no API key needed) that opens
// straight into turn-by-turn navigation through the given addresses, in order.
// `origin` is deliberately left out — Google Maps then defaults to the device's live
// location as the starting point at the moment the link is opened, not wherever the
// route happened to be built.
export function buildGoogleMapsRouteUrl(addresses: string[]): string {
  const params = new URLSearchParams({
    api: "1",
    destination: addresses[addresses.length - 1],
    travelmode: "driving",
  });
  const waypoints = addresses.slice(0, -1);
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
