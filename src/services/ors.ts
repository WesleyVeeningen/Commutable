import { TravelError } from '../core/errors';
import { MODES } from '../core/modes';
import type { Address, Duration, LngLat, MatrixClient, Mode } from '../core/types';

const BASE = 'https://api.openrouteservice.org';

/** Free plan allows ~40 matrix requests/minute; keep at least this gap between them. */
const MIN_MATRIX_GAP_MS = 1600;

export function orsApiKey(): string | undefined {
  const k = import.meta.env.VITE_ORS_API_KEY as string | undefined;
  return k && k.trim() && !k.includes('your-openrouteservice-key') ? k.trim() : undefined;
}

/**
 * `auth: 'header'` sends the key as an Authorization header (Matrix POST).
 * `auth: 'query'` sends it as `api_key` — needed for the geocode GET endpoints, whose
 * CORS preflight doesn't allow the Authorization header.
 */
async function orsFetch(
  path: string,
  init: RequestInit,
  auth: 'header' | 'query',
  signal?: AbortSignal,
): Promise<unknown> {
  const key = orsApiKey();
  if (!key) throw new TravelError('config', 'Missing VITE_ORS_API_KEY');
  const url =
    auth === 'query'
      ? `${BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(key)}`
      : BASE + path;
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>), Accept: 'application/json' };
  if (auth === 'header') headers.Authorization = key;
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal, headers });
  } catch (e) {
    if (signal?.aborted) throw new TravelError('aborted', 'Aborted');
    throw new TravelError('network', (e as Error).message);
  }
  if (res.ok) return res.json();

  let code: number | undefined;
  let message = res.statusText;
  try {
    const body = await res.json();
    code = body?.error?.code;
    message = body?.error?.message ?? body?.error ?? message;
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 401 || res.status === 403) throw new TravelError('auth', String(message));
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after'));
    throw new TravelError('rate-limit', String(message), retryAfter > 0 ? retryAfter * 1000 : undefined);
  }
  if (code === 6004 || res.status === 413) throw new TravelError('too-large', String(message));
  if (code === 6010 || /routable point|could not find point/i.test(String(message))) {
    throw new TravelError('unroutable', String(message));
  }
  if (res.status >= 500) throw new TravelError('server', String(message));
  throw new TravelError('server', `${res.status}: ${message}`);
}

/** Serialises calls so they start at least `gap` ms apart. */
function throttle(gap: number) {
  let last = 0;
  let queue: Promise<void> = Promise.resolve();
  return () => {
    const turn = queue.then(async () => {
      const wait = last + gap - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
    });
    queue = turn.catch(() => {});
    return turn;
  };
}

export class OrsMatrixClient implements MatrixClient {
  private readonly slot = throttle(MIN_MATRIX_GAP_MS);

  async matrix(mode: Mode, sources: LngLat[], destinations: LngLat[], signal?: AbortSignal): Promise<Duration[][]> {
    const profile = MODES[mode].orsProfile;
    if (!profile) throw new Error(`ORS can't route mode "${mode}"`);
    await this.slot();
    const locations = [...sources, ...destinations].map((p) => [p.lng, p.lat]);
    const body = {
      locations,
      sources: sources.map((_, i) => i),
      destinations: destinations.map((_, i) => sources.length + i),
      metrics: ['duration'],
    };
    const json = (await orsFetch(
      `/v2/matrix/${profile}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      'header',
      signal,
    )) as { durations?: Duration[][] };
    if (!json.durations) throw new TravelError('server', 'Matrix response had no durations');
    return json.durations;
  }
}

interface PeliasFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    label?: string;
    housenumber?: string;
    street?: string;
    neighbourhood?: string;
    borough?: string;
    locality?: string;
    localadmin?: string;
    county?: string;
    region?: string;
    country?: string;
  };
}

function toAddress(f: PeliasFeature): Address {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const label = p.name ?? p.label ?? 'Unnamed place';
  const area = [p.neighbourhood ?? p.borough, p.locality ?? p.localadmin ?? p.county, p.country]
    .filter((x, i, arr): x is string => !!x && x !== label && arr.indexOf(x) === i)
    .join(', ');
  return { label, area, lng, lat };
}

export interface Geocoder {
  autocomplete(text: string, focus?: LngLat, signal?: AbortSignal): Promise<Address[]>;
  /** Neighbourhood / locality name for "Near …" */
  nearbyName(point: LngLat, signal?: AbortSignal): Promise<string | null>;
}

export class OrsGeocoder implements Geocoder {
  async autocomplete(text: string, focus?: LngLat, signal?: AbortSignal): Promise<Address[]> {
    const q = new URLSearchParams({ text, size: '5' });
    if (focus) {
      q.set('focus.point.lon', String(focus.lng));
      q.set('focus.point.lat', String(focus.lat));
    }
    const json = (await orsFetch(`/geocode/autocomplete?${q}`, { method: 'GET' }, 'query', signal)) as {
      features?: PeliasFeature[];
    };
    return (json.features ?? []).slice(0, 5).map(toAddress);
  }

  async nearbyName(point: LngLat, signal?: AbortSignal): Promise<string | null> {
    const q = new URLSearchParams({
      'point.lon': String(point.lng),
      'point.lat': String(point.lat),
      size: '1',
      layers: 'neighbourhood,borough,locality,localadmin',
    });
    const json = (await orsFetch(`/geocode/reverse?${q}`, { method: 'GET' }, 'query', signal)) as {
      features?: PeliasFeature[];
    };
    const p = json.features?.[0]?.properties;
    return p ? (p.neighbourhood ?? p.borough ?? p.locality ?? p.localadmin ?? p.name ?? null) : null;
  }
}
