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

function routeLengthKm(order: number[], points: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += haversineKm(points[order[i]], points[order[i + 1]]);
  }
  return total;
}

// Untangles any crossing legs the nearest-neighbor pass leaves behind by repeatedly
// reversing segments whenever that shortens the total route.
function twoOpt(order: number[], points: LatLng[]): number[] {
  let best = order;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 2; i++) {
      for (let j = i + 1; j < best.length - 1; j++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        if (routeLengthKm(candidate, points) < routeLengthKm(best, points)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

// Orders stops for a short driving route: a nearest-neighbor pass builds a starting
// order from startIndex, then 2-opt cleans it up. Returns indices into `points`.
export function optimizeStopOrder(points: LatLng[], startIndex = 0): number[] {
  const n = points.length;
  if (n <= 2) return points.map((_, i) => i);

  const visited = new Array(n).fill(false);
  const order = [startIndex];
  visited[startIndex] = true;

  for (let step = 1; step < n; step++) {
    const last = order[order.length - 1];
    let nearest = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = haversineKm(points[last], points[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }
    order.push(nearest);
    visited[nearest] = true;
  }

  return twoOpt(order, points);
}
