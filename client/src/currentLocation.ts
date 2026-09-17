import type { LatLng } from "./geocode";

// Best-effort only, used purely to order stops from wherever the tech is when the route
// is built. It never affects the link's actual origin — that's always "current location"
// resolved live by Google Maps when the tech opens the link. Silently resolves to null on
// denial, timeout, or an unsupported browser, since the feature should still work either way.
export function getCurrentLocation(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}
