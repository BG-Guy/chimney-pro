// Only one route is ever saved at a time — saving a new one always replaces whatever was
// there before, matching how a tech actually uses this: today's route, not a history of them.
const KEY = "chimneypro:savedRoute";

export interface SavedRouteStop {
  id: number;
  name: string;
  address: string;
  time: string;
  rawText: string;
}

export interface SavedRoute {
  savedAt: string;
  stops: SavedRouteStop[];
  mapsUrl: string;
}

export function saveRoute(route: SavedRoute): void {
  localStorage.setItem(KEY, JSON.stringify(route));
}

export function loadSavedRoute(): SavedRoute | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedRoute;
  } catch {
    return null;
  }
}
