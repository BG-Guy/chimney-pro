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
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const results = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = results[0];
  return first ? { lat: Number(first.lat), lon: Number(first.lon) } : null;
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const result = await fetchCoordinates(address);
  cache.set(key, result);
  return result;
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
