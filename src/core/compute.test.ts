import { describe, expect, it, vi } from 'vitest';
import { computeHeatmap, pointDurations, uniqueTargets } from './compute';
import { TravelError } from './errors';
import { MemoryCache } from './memoryCache';
import type { Duration, LngLat, MatrixClient, Mode, Place } from './types';
import { cacheKey } from './weekly';

const noSleep = async () => {};

const place = (id: string, lng: number, lat: number, mode: Mode, trips: number): Place => ({
  id,
  name: id,
  address: { lng, lat, label: id, area: '' },
  mode,
  tripsPerWeek: trips,
});

const cells = ['a', 'b', 'c', 'd', 'e'];
const centres: LngLat[] = cells.map((_, i) => ({ lng: i, lat: 0 }));

/** Mock ORS: duration = (source lng + 1) × 60 s × factor per mode. */
function mockMatrix(factor: Partial<Record<Mode, number>> = {}) {
  const calls: { mode: Mode; sources: LngLat[]; destinations: LngLat[] }[] = [];
  const client: MatrixClient = {
    async matrix(mode, sources, destinations) {
      calls.push({ mode, sources, destinations });
      const f = factor[mode] ?? 1;
      return sources.map((s) => destinations.map(() => (s.lng + 1) * 60 * f));
    },
  };
  return { client, calls };
}

describe('computeHeatmap', () => {
  it('weights by round trip × trips per week and sums over places', async () => {
    const { client } = mockMatrix({ bike: 1, car: 2 });
    const places = [place('work', 10, 10, 'bike', 5), place('gym', 20, 20, 'car', 2)];
    const res = await computeHeatmap({
      places,
      cells,
      centres,
      matrix: client,
      cache: new MemoryCache(),
      sleep: noSleep,
    });
    // cell 0: work 1 min one-way ×2×5 = 10; gym 2 min ×2×2 = 8 → 18
    expect(res.weekly[0]).toBeCloseTo(18);
    // cell 4: work 5 min → 50; gym 10 min → 40 → 90
    expect(res.weekly[4]).toBeCloseTo(90);
  });

  it('marks a cell unreachable (null) if any place has no route', async () => {
    const client: MatrixClient = {
      async matrix(mode, sources) {
        return sources.map((s) => [mode === 'walk' && s.lng === 2 ? null : 600]);
      },
    };
    const places = [place('a', 1, 1, 'car', 1), place('b', 2, 2, 'walk', 1)];
    const res = await computeHeatmap({
      places,
      cells,
      centres,
      matrix: client,
      cache: new MemoryCache(),
      sleep: noSleep,
    });
    expect(res.weekly[2]).toBeNull();
    expect(res.weekly[1]).toBeCloseTo(40);
  });

  it('batches sources to stay under the per-request limit', async () => {
    const { client, calls } = mockMatrix();
    await computeHeatmap({
      places: [place('w', 0, 0, 'bike', 1)],
      cells,
      centres,
      matrix: client,
      cache: new MemoryCache(),
      batchSize: 2,
      sleep: noSleep,
    });
    expect(calls.map((c) => c.sources.length)).toEqual([2, 2, 1]);
    expect(calls.every((c) => c.destinations.length === 1)).toBe(true);
  });

  it('makes no requests when only trips per week change', async () => {
    const { client, calls } = mockMatrix();
    const cache = new MemoryCache();
    const p = place('work', 4, 52, 'bike', 5);
    const first = await computeHeatmap({ places: [p], cells, centres, matrix: client, cache, sleep: noSleep });
    expect(calls).toHaveLength(1);

    const second = await computeHeatmap({
      places: [{ ...p, tripsPerWeek: 1, name: 'renamed' }],
      cells,
      centres,
      matrix: client,
      cache,
      sleep: noSleep,
    });
    expect(calls).toHaveLength(1);
    expect(second.requests).toBe(0);
    expect(second.weekly[0]! * 5).toBeCloseTo(first.weekly[0]!);
  });

  it('refetches only the place whose mode or location changed', async () => {
    const { client, calls } = mockMatrix();
    const cache = new MemoryCache();
    const a = place('a', 1, 1, 'bike', 1);
    const b = place('b', 2, 2, 'car', 1);
    await computeHeatmap({ places: [a, b], cells, centres, matrix: client, cache, sleep: noSleep });
    expect(calls).toHaveLength(2);

    await computeHeatmap({
      places: [{ ...a, mode: 'walk' }, b],
      cells,
      centres,
      matrix: client,
      cache,
      sleep: noSleep,
    });
    expect(calls).toHaveLength(3);
    expect(calls[2].mode).toBe('walk');

    const moved = { ...b, address: { ...b.address, lng: 3 } };
    await computeHeatmap({
      places: [{ ...a, mode: 'walk' }, moved],
      cells,
      centres,
      matrix: client,
      cache,
      sleep: noSleep,
    });
    expect(calls).toHaveLength(4);
    expect(calls[3].destinations[0].lng).toBe(3);
  });

  it('only fetches cells missing from the cache (e.g. after the grid grows)', async () => {
    const { client, calls } = mockMatrix();
    const cache = new MemoryCache();
    const p = place('a', 1, 1, 'bike', 1);
    await cache.setMany([
      [cacheKey(p.address, p.mode, 'a'), 60],
      [cacheKey(p.address, p.mode, 'c'), null],
    ]);
    const res = await computeHeatmap({ places: [p], cells, centres, matrix: client, cache, sleep: noSleep });
    expect(calls).toHaveLength(1);
    expect(calls[0].sources.map((s) => s.lng)).toEqual([1, 3, 4]);
    expect(res.weekly[2]).toBeNull(); // cached null is respected
  });

  it('stores results in the cache keyed by location + mode + cell', async () => {
    const { client } = mockMatrix();
    const cache = new MemoryCache();
    const p = place('a', 4.47917, 51.9225, 'car', 1);
    await computeHeatmap({ places: [p], cells, centres, matrix: client, cache, sleep: noSleep });
    expect(cache.map.get('51.92250,4.47917|car|b')).toBe(120);
    expect(cache.map.size).toBe(cells.length);
  });

  it('shares requests between places at the same location and mode', async () => {
    const { client, calls } = mockMatrix();
    const places = [place('a', 1, 1, 'bike', 1), place('b', 1, 1, 'bike', 3)];
    expect(uniqueTargets(places)).toHaveLength(1);
    const res = await computeHeatmap({
      places,
      cells,
      centres,
      matrix: client,
      cache: new MemoryCache(),
      sleep: noSleep,
    });
    expect(calls).toHaveLength(1);
    expect(res.weekly[0]).toBeCloseTo(2 + 6);
  });

  it('retries after a rate limit with backoff, then succeeds', async () => {
    let n = 0;
    const client: MatrixClient = {
      async matrix(_m, sources) {
        if (n++ < 2) throw new TravelError('rate-limit', '429');
        return sources.map(() => [60]);
      },
    };
    const sleep = vi.fn(async () => {});
    const res = await computeHeatmap({
      places: [place('a', 1, 1, 'car', 1)],
      cells,
      centres,
      matrix: client,
      cache: new MemoryCache(),
      sleep,
      baseDelayMs: 100,
    });
    expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([100, 200]);
    expect(res.weekly[0]).toBeCloseTo(2);
    expect(res.requests).toBe(3);
  });

  it('gives up after the retry budget and surfaces the error', async () => {
    const client: MatrixClient = {
      async matrix() {
        throw new TravelError('rate-limit', '429');
      },
    };
    await expect(
      computeHeatmap({
        places: [place('a', 1, 1, 'car', 1)],
        cells,
        centres,
        matrix: client,
        cache: new MemoryCache(),
        sleep: noSleep,
        retries: 2,
      }),
    ).rejects.toMatchObject({ kind: 'rate-limit' });
  });

  it('does not retry auth errors', async () => {
    const matrix = vi.fn(async (): Promise<Duration[][]> => {
      throw new TravelError('auth', '403');
    });
    await expect(
      computeHeatmap({
        places: [place('a', 1, 1, 'car', 1)],
        cells,
        centres,
        matrix: { matrix },
        cache: new MemoryCache(),
        sleep: noSleep,
      }),
    ).rejects.toMatchObject({ kind: 'auth' });
    expect(matrix).toHaveBeenCalledTimes(1);
  });

  it('halves a batch the server says is too large', async () => {
    const sizes: number[] = [];
    const client: MatrixClient = {
      async matrix(_m, sources) {
        sizes.push(sources.length);
        if (sources.length > 2) throw new TravelError('too-large', '6004');
        return sources.map(() => [60]);
      },
    };
    const res = await computeHeatmap({
      places: [place('a', 1, 1, 'car', 1)],
      cells,
      centres,
      matrix: client,
      cache: new MemoryCache(),
      sleep: noSleep,
    });
    expect(sizes).toEqual([5, 3, 2, 1, 2]);
    expect(res.weekly.every((v) => v !== null)).toBe(true);
  });

  it('narrows an unroutable batch down to the bad cell and marks it grey', async () => {
    const client: MatrixClient = {
      async matrix(_m, sources) {
        if (sources.some((s) => s.lng === 3)) throw new TravelError('unroutable', '6010');
        return sources.map(() => [60]);
      },
    };
    const cache = new MemoryCache();
    const res = await computeHeatmap({
      places: [place('a', 1, 1, 'car', 1)],
      cells,
      centres,
      matrix: client,
      cache,
      sleep: noSleep,
    });
    expect(res.weekly).toEqual([2, 2, 2, null, 2]);
    expect(cache.map.get(cacheKey({ lng: 1, lat: 1 }, 'car', 'd'))).toBeNull();
  });

  it('reports progress from cache hits and each batch', async () => {
    const { client } = mockMatrix();
    const cache = new MemoryCache();
    const p = place('a', 1, 1, 'bike', 1);
    await cache.setMany([[cacheKey(p.address, p.mode, 'a'), 60]]);
    const seen: number[] = [];
    await computeHeatmap({
      places: [p],
      cells,
      centres,
      matrix: client,
      cache,
      batchSize: 2,
      sleep: noSleep,
      onProgress: (pr) => seen.push(pr.done),
    });
    expect(seen).toEqual([1, 3, 5]);
  });

  it('stops when aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const { client } = mockMatrix();
    await expect(
      computeHeatmap({
        places: [place('a', 1, 1, 'bike', 1)],
        cells,
        centres,
        matrix: client,
        cache: new MemoryCache(),
        signal: ctrl.signal,
        sleep: noSleep,
      }),
    ).rejects.toMatchObject({ kind: 'aborted' });
  });
});

describe('pointDurations', () => {
  it('makes one request per mode and maps durations back to places', async () => {
    const { client, calls } = mockMatrix({ car: 2 });
    const places = [place('a', 1, 1, 'bike', 1), place('b', 2, 2, 'car', 1), place('c', 3, 3, 'bike', 1)];
    const res = await pointDurations({ lng: 0, lat: 0 }, places, client, undefined, noSleep);
    expect(calls).toHaveLength(2);
    expect(calls.find((c) => c.mode === 'bike')!.destinations).toHaveLength(2);
    expect(res.get('a')).toBe(60);
    expect(res.get('b')).toBe(120);
    expect(res.get('c')).toBe(60);
  });

  it('asks providers for an exact answer', async () => {
    const seen: unknown[] = [];
    const client: MatrixClient = {
      async matrix(_m, sources, destinations, _signal, options) {
        seen.push(options);
        return sources.map(() => destinations.map(() => 60));
      },
    };
    await pointDurations({ lng: 0, lat: 0 }, [place('a', 1, 1, 'transit', 1)], client, undefined, noSleep);
    expect(seen).toEqual([{ exact: true }]);
  });

  it('treats an unroutable pin as unreachable for every place', async () => {
    const client: MatrixClient = {
      async matrix() {
        throw new TravelError('unroutable', '6010');
      },
    };
    const res = await pointDurations({ lng: 0, lat: 0 }, [place('a', 1, 1, 'walk', 1)], client, undefined, noSleep);
    expect(res.get('a')).toBeNull();
  });
});
