import { createStore, getMany, setMany, clear, type UseStore } from 'idb-keyval';
import { MemoryCache } from '../core/memoryCache';
import type { Duration, TravelCache } from '../core/types';

/**
 * Durations cache: an in-memory layer over IndexedDB. Keys come from core/weekly
 * `cacheKey` (location + mode + hex id). Falls back to memory-only if IndexedDB
 * isn't available (e.g. some private windows).
 */
export class IdbTravelCache implements TravelCache {
  private readonly mem = new MemoryCache();
  private store: UseStore | null;

  constructor(dbName = 'commutable') {
    try {
      this.store = typeof indexedDB === 'undefined' ? null : createStore(dbName, 'durations');
    } catch {
      this.store = null;
    }
  }

  async getMany(keys: string[]): Promise<(Duration | undefined)[]> {
    const out: (Duration | undefined)[] = await this.mem.getMany(keys);
    const missIdx = out.flatMap((v, i) => (v === undefined ? [i] : []));
    if (!missIdx.length || !this.store) return out;
    try {
      const vals = await getMany<Duration>(
        missIdx.map((i) => keys[i]),
        this.store,
      );
      const hot: [string, Duration][] = [];
      missIdx.forEach((i, j) => {
        if (vals[j] !== undefined) {
          out[i] = vals[j];
          hot.push([keys[i], vals[j]]);
        }
      });
      await this.mem.setMany(hot);
    } catch {
      /* treat as misses */
    }
    return out;
  }

  async setMany(entries: [string, Duration][]): Promise<void> {
    await this.mem.setMany(entries);
    if (!this.store) return;
    try {
      await setMany(entries, this.store);
    } catch {
      /* quota or private mode — memory layer still works for this session */
    }
  }

  async clear(): Promise<void> {
    this.mem.map.clear();
    if (this.store) await clear(this.store);
  }
}
