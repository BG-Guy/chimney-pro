import type { LatLng } from "./geocode";

// Builds a Google Maps multi-stop directions link (no API key needed) that opens
// straight into turn-by-turn navigation through the given stops, in the exact order
// given — never with "optimize:true", since the order here is meaningful (sorted by
// scheduled time) and Google reordering waypoints for shortest distance would break that.
// `origin` is deliberately left out — Google Maps then defaults to the device's live
// location as the starting point at the moment the link is opened, not wherever the
// route happened to be built.
//
// A stop is passed as a coordinate when our own geocoder already resolved it (preferred —
// Google Maps runs its own independent geocoder on plain address text, which occasionally
// disagrees with ours on messy addresses), or as the raw address text otherwise, which
// Google's own geocoder resolves live when the link is opened.
function toLatLngParam(point: LatLng | string): string {
  if (typeof point === "string") return point;
  return `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
}

export function buildGoogleMapsRouteUrl(points: (LatLng | string)[]): string {
  const params = new URLSearchParams({
    api: "1",
    destination: toLatLngParam(points[points.length - 1]),
    travelmode: "driving",
  });
  const waypoints = points.slice(0, -1);
  if (waypoints.length > 0) params.set("waypoints", waypoints.map(toLatLngParam).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
