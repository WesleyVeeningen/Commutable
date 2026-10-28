import { chunk, runPool, sleep as realSleep, withRetry, type Sleep } from './batch';
import { TravelError } from './errors';
import type { Duration, LngLat, MatrixClient, Mode, Place, TravelCache } from './types';
import { cacheKey, sumWeekly, targetKey } from './weekly';

/** ORS allows 3,500 sources × destinations per Matrix request; stay under it. */
export const DEFAULT_BATCH_SIZE = 3000;

export interface Progress {
  /** Cells resolved (from cache or API) */
  done: number;
  total: number;
  /** API requests made so far in this run */
  requests: number;
}

export interface ComputeOptions {
  places: Place[];
  cells: string[];
  centres: LngLat[];
  matrix: MatrixClient;
  cache: TravelCache;
  batchSize?: number;
  concurrency?: number;
  retries?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
  sleep?: Sleep;
}

export interface ComputeResult {
  /** Weekly minutes per cell (aligned with `cells`), null = unreachable */
  weekly: (number | null)[];
  /** One-way seconds per cell, per (location, mode) target */
  durationsByTarget: Map<string, Duration[]>;
  requests: number;
}

interface Target {
  key: string;
  location: LngLat;
  mode: Mode;
}

/** Distinct (location, mode) pairs — two places at the same spot share requests. */
export function uniqueTargets(places: Place[]): Target[] {
  const map = new Map<string, Target>();
  for (const p of places) {
    const key = targetKey(p.address, p.mode);
    if (!map.has(key)) map.set(key, { key, location: p.address, mode: p.mode });
  }
  return [...map.values()];
}

/**
 * Weekly travel time for every cell. Reads the cache first and only asks the
 * matrix API for (target, cell) pairs it hasn't seen, so changing trips per week
 * costs zero requests and changing one place's location/mode only refetches that place.
 */
export async function computeHeatmap(opts: ComputeOptions): Promise<ComputeResult> {
  const {
    places,
    cells,
    centres,
    matrix,
    cache,
    batchSize = DEFAULT_BATCH_SIZE,
    concurrency = 2,
    retries = 3,
    baseDelayMs = 2000,
    signal,
    onProgress,
    sleep = realSleep,
  } = opts;

  const targets = uniqueTargets(places);
  const durationsByTarget = new Map<string, Duration[]>();
  const progress: Progress = { done: 0, total: targets.length * cells.length, requests: 0 };
  const report = () => onProgress?.({ ...progress });

  // 1. Cache lookup
  const jobs: { target: Target; missing: number[] }[] = [];
  for (const target of targets) {
    const keys = cells.map((c) => cacheKey(target.location, target.mode, c));
    const cached = await cache.getMany(keys);
    const durations: Duration[] = new Array(cells.length);
    const missing: number[] = [];
    cached.forEach((v, i) => {
      if (v === undefined) missing.push(i);
      else durations[i] = v;
    });
    durationsByTarget.set(target.key, durations);
    progress.done += cells.length - missing.length;
    if (missing.length) jobs.push({ target, missing });
  }
  report();

  // 2. Fetch what's missing, in batches
  const fetchBatch = async (target: Target, idx: number[]): Promise<void> => {
    if (signal?.aborted) throw new TravelError('aborted', 'Aborted');
    let result: Duration[][];
    try {
      result = await withRetry(
        () => {
          progress.requests++;
          return matrix.matrix(
            target.mode,
            idx.map((i) => centres[i]),
            [target.location],
            signal,
          );
        },
        { retries, baseDelayMs, sleep, signal },
      );
    } catch (e) {
      const splittable = e instanceof TravelError && (e.kind === 'too-large' || e.kind === 'unroutable');
      if (!splittable) throw e;
      if (idx.length === 1) {
        if ((e as TravelError).kind === 'too-large') throw e;
        // This single hex can't be routed (e.g. in the sea): unreachable.
        result = [[null]];
      } else {
        const half = Math.ceil(idx.length / 2);
        await fetchBatch(target, idx.slice(0, half));
        await fetchBatch(target, idx.slice(half));
        return;
      }
    }
    const durations = durationsByTarget.get(target.key)!;
    const entries: [string, Duration][] = idx.map((cellIdx, j) => {
      const d = result[j]?.[0] ?? null;
      durations[cellIdx] = d;
      return [cacheKey(target.location, target.mode, cells[cellIdx]), d];
    });
    await cache.setMany(entries);
    progress.done += idx.length;
    report();
  };

  const tasks = jobs.flatMap(({ target, missing }) =>
    chunk(missing, batchSize).map((idx) => () => fetchBatch(target, idx)),
  );
  await runPool(tasks, concurrency);

  return {
    weekly: sumWeekly(places, durationsByTarget, cells.length),
    durationsByTarget,
    requests: progress.requests,
  };
}

/**
 * Exact one-way durations from one point to every place — one request per
 * distinct mode. Used for the dropped pin.
 */
export async function pointDurations(
  point: LngLat,
  places: Place[],
  matrix: MatrixClient,
  signal?: AbortSignal,
  sleep: Sleep = realSleep,
): Promise<Map<string, Duration>> {
  const byMode = new Map<Mode, Place[]>();
  for (const p of places) byMode.set(p.mode, [...(byMode.get(p.mode) ?? []), p]);
  const out = new Map<string, Duration>();
  await Promise.all(
    [...byMode].map(async ([mode, group]) => {
      try {
        const res = await withRetry(
          () =>
            matrix.matrix(
              mode,
              [point],
              group.map((p) => p.address),
              signal,
              { exact: true },
            ),
          { retries: 2, baseDelayMs: 1500, sleep, signal },
        );
        group.forEach((p, j) => out.set(p.id, res[0]?.[j] ?? null));
      } catch (e) {
        // The pin itself is off the road network: every place is unreachable.
        if (e instanceof TravelError && e.kind === 'unroutable') group.forEach((p) => out.set(p.id, null));
        else throw e;
      }
    }),
  );
  return out;
}
