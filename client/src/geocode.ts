export interface LatLng {
  lat: number;
  lon: number;
}

// In-memory only — repeat customers within a session skip a redundant network call,
// but we don't persist coordinates since addresses can be edited between visits.
const cache = new Map<string, LatLng | null>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCoordinates(address: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    return first ? { lat: Number(first.lat), lon: Number(first.lon) } : null;
  } catch {
    // A rejected fetch or a non-JSON response (Nominatim's free demo server occasionally
    // returns an HTML "access denied" page instead of an error status) shouldn't take the
    // rest of the batch down with it — this address just didn't resolve.
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const result = await fetchCoordinates(address);
  cache.set(key, result);
  return result;
}

// Lets a picked search candidate short-circuit the next automatic geocode pass instead of
// spending another network round-trip re-confirming what the user just confirmed by hand.
export function primeGeocodeCache(address: string, point: LatLng): void {
  cache.set(address.trim().toLowerCase(), point);
}

export interface AddressCandidate {
  displayName: string;
  point: LatLng;
}

// A broader, multi-result search for when the exact pasted address doesn't match anything
// — used to let the person narrow in on the right place by hand (e.g. a postal city name
// like "Harleysville" that doesn't match OpenStreetMap's actual township/borough name, or a
// typo) rather than just failing silently.
export async function searchAddressCandidates(query: string): Promise<AddressCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(trimmed)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    return results.map((r) => ({
      displayName: r.display_name,
      point: { lat: Number(r.lat), lon: Number(r.lon) },
    }));
  } catch {
    return [];
  }
}

// Geocodes one address at a time with a 1s gap, in line with Nominatim's free usage policy
// (max 1 request/sec) — this is a free public service with no API key, not a bulk geocoder.
export async function geocodeAll(addresses: string[]): Promise<(LatLng | null)[]> {
  const results: (LatLng | null)[] = [];
  for (const address of addresses) {
    const alreadyCached = cache.has(address.trim().toLowerCase());
    results.push(await geocodeAddress(address));
    if (!alreadyCached) await delay(1000);
  }
  return results;
}
