import type { Duration, LngLat } from './types';

/**
 * Public transport travel times from stop reachability.
 *
 * One "one-to-all" request per place returns, for every stop within the time
 * limit, how long it takes from that stop to the place (arriving at the target
 * time, including the final walk). A hex's time is then the best of:
 *   walk to a nearby stop + that stop's time, or walking straight to the place.
 */

export interface StopTime extends LngLat {
  /** Minutes from this stop to the destination */
  minutes: number;
}

export const WALK_KMH = 5;
/** Straight-line → walking-route distance factor */
export const DETOUR = 1.3;
/** Longest walk to a stop we consider */
export const MAX_ACCESS_WALK_MIN = 15;
/** Longest walk we accept as "transit" when walking straight there beats it */
export const MAX_DIRECT_WALK_MIN = 45;

export function distanceKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function walkMinutes(a: LngLat, b: LngLat): number {
  return ((distanceKm(a, b) * DETOUR) / WALK_KMH) * 60;
}

/** Grid buckets so each hex only looks at stops within walking distance. */
export class StopIndex {
  private readonly buckets = new Map<string, StopTime[]>();
  /** Bucket height in degrees latitude (~1.1 km) */
  private readonly size = 0.01;
  /** Bucket width in degrees longitude: ~1.1 km at the first stop's latitude */
  private readonly lngSize: number;
  private readonly radiusKm: number;

  constructor(stops: StopTime[], maxWalkMin = MAX_ACCESS_WALK_MIN) {
    this.radiusKm = ((maxWalkMin / 60) * WALK_KMH) / DETOUR;
    this.lngSize = this.size / Math.max(0.2, Math.cos(((stops[0]?.lat ?? 0) * Math.PI) / 180));
    for (const s of stops) {
      const k = this.key(Math.floor(s.lat / this.size), Math.floor(s.lng / this.lngSize));
      const list = this.buckets.get(k);
      if (list) list.push(s);
      else this.buckets.set(k, [s]);
    }
  }

  private key(i: number, j: number) {
    return `${i}:${j}`;
  }

  /** Stops within the walking radius of `p`. */
  near(p: LngLat): StopTime[] {
    const reachI = Math.ceil(this.radiusKm / (this.size * 110.574));
    const bucketWidthKm = this.lngSize * 111.32 * Math.max(0.01, Math.cos((p.lat * Math.PI) / 180));
    const reachJ = Math.ceil(this.radiusKm / bucketWidthKm);
    const i0 = Math.floor(p.lat / this.size);
    const j0 = Math.floor(p.lng / this.lngSize);
    const out: StopTime[] = [];
    for (let di = -reachI; di <= reachI; di++) {
      for (let dj = -reachJ; dj <= reachJ; dj++) {
        const list = this.buckets.get(this.key(i0 + di, j0 + dj));
        if (list) for (const s of list) if (distanceKm(p, s) <= this.radiusKm) out.push(s);
      }
    }
    return out;
  }
}

/** One-way seconds from `source` to the destination by public transport, or null. */
export function transitSeconds(source: LngLat, destination: LngLat, index: StopIndex): Duration {
  let best = Infinity;
  const direct = walkMinutes(source, destination);
  if (direct <= MAX_DIRECT_WALK_MIN) best = direct;
  for (const s of index.near(source)) {
    const t = walkMinutes(source, s) + s.minutes;
    if (t < best) best = t;
  }
  return Number.isFinite(best) ? Math.round(best * 60) : null;
}

/**
 * The next weekday (Mon–Fri) at hh:mm local time, at least one day after `now`
 * so the timetable query is never in the past.
 */
export function nextWeekdayAt(now: Date, hours: number, minutes: number): Date {
  const d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  do d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}
