import type { Duration, TravelCache } from './types';

/** In-memory TravelCache — used in tests and as the hot layer above IndexedDB. */
export class MemoryCache implements TravelCache {
  readonly map = new Map<string, Duration>();
  async getMany(keys: string[]) {
    return keys.map((k) => (this.map.has(k) ? this.map.get(k)! : undefined));
  }
  async setMany(entries: [string, Duration][]) {
    for (const [k, v] of entries) this.map.set(k, v);
  }
}
