import { MODES, TRIPS_MAX, TRIPS_MIN } from '../core/modes';
import type { Place, Resolution } from '../core/types';

const PLACES_KEY = 'commutable.places.v1';
const RES_KEY = 'commutable.resolution';

function isPlace(x: unknown): x is Place {
  const p = x as Place;
  return (
    !!p &&
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    p.mode in MODES &&
    typeof p.tripsPerWeek === 'number' &&
    typeof p.address?.lat === 'number' &&
    typeof p.address?.lng === 'number'
  );
}

export function loadPlaces(): Place[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PLACES_KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter(isPlace).map((p) => ({ ...p, tripsPerWeek: Math.min(TRIPS_MAX, Math.max(TRIPS_MIN, p.tripsPerWeek)) }))
      : [];
  } catch {
    return [];
  }
}

export function savePlaces(places: Place[]): void {
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
  } catch {
    /* storage full / disabled */
  }
}

export function loadResolution(): Resolution {
  try {
    return localStorage.getItem(RES_KEY) === 'fine' ? 'fine' : 'coarse';
  } catch {
    return 'coarse';
  }
}

export function saveResolution(r: Resolution): void {
  try {
    localStorage.setItem(RES_KEY, r);
  } catch {
    /* ignore */
  }
}
