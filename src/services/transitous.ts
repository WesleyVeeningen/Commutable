import { TravelError } from '../core/errors';
import { TRANSIT_ARRIVE_BY } from '../core/modes';
import { nextWeekdayAt, StopIndex, transitSeconds, type StopTime } from '../core/transit';
import type { Duration, LngLat, MatrixClient, MatrixOptions, Mode } from '../core/types';
import { targetKey } from '../core/weekly';

/**
 * Public transport via Transitous (https://transitous.org), a free MOTIS instance.
 * Fair use: non-commercial, open-source projects; keep heavy requests well under
 * ~720/day. That's why the heatmap costs one request per place, not per hex.
 */
const BASE = 'https://api.transitous.org';
/** Longest one-way trip we ask for; slower hexes show as unreachable. */
const MAX_TRAVEL_MIN = 90;

interface OneToAllResponse {
  all: { place: { lat: number; lon: number }; duration: number }[];
}

interface IntermodalResponse {
  street_durations: { duration?: number }[];
  transit_durations: { duration?: number }[][];
}

async function get<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    if (signal?.aborted) throw new TravelError('aborted', 'Aborted');
    throw new TravelError('network', `Transitous: ${(e as Error).message}`);
  }
  if (res.ok) return res.json() as Promise<T>;
  const text = await res.text().catch(() => '');
  if (res.status === 429) throw new TravelError('rate-limit', `Transitous: ${text || 'too many requests'}`);
  if (res.status >= 500) throw new TravelError('server', `Transitous ${res.status}: ${text}`);
  // 4xx other than 429: usually the point couldn't be matched to the network.
  throw new TravelError('unroutable', `Transitous ${res.status}: ${text}`);
}

/** Serialises calls: Transitous is a shared, best-effort service. */
function serial() {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };
}

export class TransitousClient implements MatrixClient {
  private readonly stops = new Map<string, Promise<StopIndex>>();
  private readonly queue = serial();
  /** Arrive by 08:30 on the next weekday. Fixed for the session so results are consistent. */
  readonly arriveBy = nextWeekdayAt(new Date(), TRANSIT_ARRIVE_BY.hours, TRANSIT_ARRIVE_BY.minutes);

  async matrix(
    _mode: Mode,
    sources: LngLat[],
    destinations: LngLat[],
    signal?: AbortSignal,
    options?: MatrixOptions,
  ): Promise<Duration[][]> {
    const columns = await Promise.all(
      destinations.map((d) => (options?.exact ? this.exact(sources, d, signal) : this.estimate(sources, d, signal))),
    );
    return sources.map((_, i) => columns.map((col) => col[i]));
  }

  /** Heatmap: walk to a nearby stop + that stop's time to the place (one request per place). */
  private async estimate(sources: LngLat[], destination: LngLat, signal?: AbortSignal): Promise<Duration[]> {
    const index = await this.stopIndex(destination, signal);
    return sources.map((s) => transitSeconds(s, destination, index));
  }

  private stopIndex(destination: LngLat, signal?: AbortSignal): Promise<StopIndex> {
    const key = targetKey(destination, 'transit');
    let p = this.stops.get(key);
    if (!p) {
      p = this.queue(() =>
        get<OneToAllResponse>(
          '/api/v6/one-to-all',
          {
            one: `${destination.lat},${destination.lng}`,
            arriveBy: 'true',
            time: this.arriveBy.toISOString(),
            maxTravelTime: String(MAX_TRAVEL_MIN),
          },
          signal,
        ),
      ).then((res) => {
        const stops: StopTime[] = res.all.map((s) => ({ lat: s.place.lat, lng: s.place.lon, minutes: s.duration }));
        return new StopIndex(stops);
      });
      this.stops.set(key, p);
      // Don't keep failures (or aborted requests) around.
      p.catch(() => this.stops.delete(key));
    }
    return p;
  }

  /** Pin: door-to-door routing, fastest of walking and public transport. */
  private async exact(sources: LngLat[], destination: LngLat, signal?: AbortSignal): Promise<Duration[]> {
    const res = await this.queue(() =>
      get<IntermodalResponse>(
        '/api/experimental/one-to-many-intermodal',
        {
          one: `${destination.lat};${destination.lng}`,
          many: sources.map((s) => `${s.lat};${s.lng}`).join(','),
          arriveBy: 'true',
          time: this.arriveBy.toISOString(),
          directMode: 'WALK',
        },
        signal,
      ),
    );
    return sources.map((_, i) => {
      const options = [
        res.street_durations?.[i]?.duration,
        ...(res.transit_durations?.[i] ?? []).map((t) => t.duration),
      ].filter((d): d is number => typeof d === 'number');
      return options.length ? Math.round(Math.min(...options)) : null;
    });
  }
}
