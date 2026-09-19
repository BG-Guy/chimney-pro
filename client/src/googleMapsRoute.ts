import type { LatLng } from "./geocode";

// Builds a Google Maps multi-stop directions link (no API key needed) that opens
// straight into turn-by-turn navigation through the given stops, in order.
// `origin` is deliberately left out — Google Maps then defaults to the device's live
// location as the starting point at the moment the link is opened, not wherever the
// route happened to be built.
//
// Stops are passed as coordinates (already resolved by our own geocoder to compute the
// route order) rather than the raw address text. Google Maps runs its own independent
// geocoder on plain address text, which occasionally disagrees with ours on messy or
// abbreviated addresses and reports "address can't be found" even though we already
// confirmed the address resolves — a coordinate has no parsing left to fail.
function toLatLngParam(point: LatLng): string {
  return `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
}

export function buildGoogleMapsRouteUrl(points: LatLng[]): string {
  const params = new URLSearchParams({
    api: "1",
    destination: toLatLngParam(points[points.length - 1]),
    travelmode: "driving",
  });
  const waypoints = points.slice(0, -1);
  if (waypoints.length > 0) params.set("waypoints", waypoints.map(toLatLngParam).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// Fallback for when our own geocoder (OpenStreetMap/Nominatim) couldn't confirm every
// address — rather than block the route, hand Google Maps the raw address text and let
// its own (more forgiving) geocoder resolve each stop, with "optimize:true" asking Maps
// to pick the best visiting order itself instead of relying on our local one.
export function buildGoogleMapsRouteUrlFromAddresses(addresses: string[]): string {
  const params = new URLSearchParams({
    api: "1",
    destination: addresses[addresses.length - 1],
    travelmode: "driving",
  });
  const waypoints = addresses.slice(0, -1);
  if (waypoints.length > 0) params.set("waypoints", `optimize:true|${waypoints.join("|")}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
