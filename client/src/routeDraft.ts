import type { LatLng } from "./geocode";
import { todayISO } from "./dateUtils";

// The route being worked on right now — the pasted stops and the built order — so hopping
// to the New job tab to log a stop and coming back doesn't wipe the day's route. Only kept
// for the day it was made; tomorrow starts clean. Separate from the one "saved route".
const KEY = "chimneypro:routeDraft";

export interface DraftStop {
  id: number;
  name: string;
  address: string;
  time: string;
  rawText: string;
}

export interface RouteDraft {
  day: string;
  stops: DraftStop[];
  timedOrder: DraftStop[] | null;
  unscheduledStops: DraftStop[];
  noAddressStops: DraftStop[];
  placement: Record<number, number>;
  pointById: Record<number, LatLng>;
  notFoundStopIds: number[];
  manualOrder: number[] | null;
  noteMessage: string | null;
}

export function loadRouteDraft(): RouteDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as RouteDraft;
    if (draft.day !== todayISO() || !Array.isArray(draft.stops)) return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveRouteDraft(draft: Omit<RouteDraft, "day">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, day: todayISO() }));
  } catch {
    // Storage full or blocked — the route still works, it just won't survive a tab switch.
  }
}

export function clearRouteDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
