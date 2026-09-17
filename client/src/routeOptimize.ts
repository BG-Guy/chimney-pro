import type { LatLng } from "./geocode";

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Length of anchor -> points[order[0]] -> points[order[1]] -> ... The leg from the anchor
// only counts when one was given (e.g. the tech's current location) — without it, the
// order is just scored on the legs between stops.
function routeLengthKm(order: number[], points: LatLng[], anchor: LatLng | null): number {
  let total = 0;
  let prev = anchor;
  for (const idx of order) {
    if (prev) total += haversineKm(prev, points[idx]);
    prev = points[idx];
  }
  return total;
}

// Untangles any crossing legs the nearest-neighbor pass leaves behind by repeatedly
// reversing segments whenever that shortens the total route.
function twoOpt(order: number[], points: LatLng[], anchor: LatLng | null): number[] {
  let best = order;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        if (routeLengthKm(candidate, points, anchor) < routeLengthKm(best, points, anchor)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

// Orders stops for a short driving route. When `anchor` is given (the tech's current
// location at the time the route is built), the route is ordered to start near there —
// otherwise it starts from stop 0. A nearest-neighbor pass builds a starting order, then
// 2-opt cleans it up. Returns indices into `points`.
export function optimizeStopOrder(points: LatLng[], anchor: LatLng | null = null): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  const visited = new Array(n).fill(false);
  const order: number[] = [];
  let current: LatLng;

  if (anchor) {
    current = anchor;
  } else {
    order.push(0);
    visited[0] = true;
    current = points[0];
  }

  while (order.length < n) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = haversineKm(current, points[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }
    order.push(nearest);
    visited[nearest] = true;
    current = points[nearest];
  }

  return twoOpt(order, points, anchor);
}
