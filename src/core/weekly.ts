import type { Duration, LngLat, Mode, Place } from './types';

/** Round trip × trips per week, in minutes. */
export function weeklyMinutes(oneWaySeconds: number, tripsPerWeek: number): number {
  return (oneWaySeconds / 60) * 2 * tripsPerWeek;
}

/**
 * Cache key for one (destination, mode, hex) duration. Coordinates are rounded to
 * 5 decimals (~1 m) so re-picking the same address hits the cache.
 */
export function targetKey(location: LngLat, mode: Mode): string {
  return `${location.lat.toFixed(5)},${location.lng.toFixed(5)}|${mode}`;
}

export function cacheKey(location: LngLat, mode: Mode, cell: string): string {
  return `${targetKey(location, mode)}|${cell}`;
}

/**
 * Sum weekly minutes per hex over all places. `durations` holds one array per
 * target key (aligned with the grid's cells). A hex that can't reach any one
 * place is null — it shows grey.
 */
export function sumWeekly(
  places: Place[],
  durationsByTarget: Map<string, Duration[]>,
  cellCount: number,
): (number | null)[] {
  const out: (number | null)[] = new Array(cellCount).fill(0);
  for (const p of places) {
    const d = durationsByTarget.get(targetKey(p.address, p.mode));
    if (!d) throw new Error(`Missing durations for place ${p.id}`);
    for (let i = 0; i < cellCount; i++) {
      const cur = out[i];
      const sec = d[i];
      out[i] = cur === null || sec === null || sec === undefined ? null : cur + weeklyMinutes(sec, p.tripsPerWeek);
    }
  }
  return out;
}

export interface Distribution {
  /** Reachable values, ascending. */
  sorted: number[];
  /** 2nd percentile */
  lo: number;
  /** 98th percentile */
  hi: number;
}

export function distribution(values: (number | null)[]): Distribution {
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return { sorted, lo: 0, hi: 0 };
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return { sorted, lo: at(0.02), hi: at(0.98) };
}

/** 0..1 position of a value on the legend scale. */
export function scalePosition(v: number, d: Distribution): number {
  const span = Math.max(1, d.hi - d.lo);
  return Math.max(0, Math.min(1, (v - d.lo) / span));
}

/** Share (0..1) of reachable hexes that take longer than `total`. */
export function quickerThan(total: number, d: Distribution): number {
  if (d.sorted.length === 0) return 0;
  // first index with value > total (binary search)
  let lo = 0, hi = d.sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d.sorted[mid] > total) hi = mid;
    else lo = mid + 1;
  }
  return (d.sorted.length - lo) / d.sorted.length;
}

export interface BreakdownRow {
  place: Place;
  /** One-way minutes, null if unreachable */
  oneWayMin: number | null;
  weeklyMin: number | null;
}

export interface Breakdown {
  rows: BreakdownRow[];
  /** null if any place is unreachable */
  totalMin: number | null;
}

/** Per-place breakdown for a single point, from one-way seconds keyed by place id. */
export function breakdown(places: Place[], secondsByPlace: Map<string, Duration>): Breakdown {
  let total: number | null = 0;
  const rows = places.map((place) => {
    const sec = secondsByPlace.get(place.id) ?? null;
    const weeklyMin = sec === null ? null : weeklyMinutes(sec, place.tripsPerWeek);
    total = total === null || weeklyMin === null ? null : total + weeklyMin;
    return { place, oneWayMin: sec === null ? null : sec / 60, weeklyMin };
  });
  return { rows, totalMin: total };
}

/** "4h 10m" / "35m" */
export function formatMinutes(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h ${r}m` : `${r}m`;
}

/** Legend labels in hours: low, mid, high+ */
export function legendLabels(d: Distribution): [string, string, string] {
  const h = (min: number) => `${Math.round(min / 60)}h`;
  return [h(d.lo), h((d.lo + d.hi) / 2), `${h(d.hi)}+`];
}
