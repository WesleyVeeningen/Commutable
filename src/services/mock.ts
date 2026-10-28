import type { Address, Duration, LngLat, MatrixClient, Mode } from '../core/types';
import type { Geocoder } from './ors';

/**
 * Offline stand-ins for ORS, enabled with VITE_ORS_MOCK=true. Lets you try the UI
 * without an API key. Travel time = straight-line distance × 1.3 ÷ speed + overhead.
 */
const SPEED_KMH: Record<Mode, number> = { walk: 5, bike: 16, car: 38 };
const OVERHEAD_MIN: Record<Mode, number> = { walk: 0, bike: 2, car: 6 };

export function haversineKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export class MockMatrixClient implements MatrixClient {
  async matrix(mode: Mode, sources: LngLat[], destinations: LngLat[]): Promise<Duration[][]> {
    await new Promise((r) => setTimeout(r, 400));
    return sources.map((s) =>
      destinations.map((d) => {
        const km = haversineKm(s, d) * 1.3;
        if (mode === 'walk' && km > 40) return null;
        return Math.round(((km / SPEED_KMH[mode]) * 60 + OVERHEAD_MIN[mode]) * 60);
      }),
    );
  }
}

const ADDRESSES: Address[] = [
  { label: 'Rotterdam Centraal', area: 'Centrum, Rotterdam, Netherlands', lng: 4.4689, lat: 51.9249 },
  { label: 'Erasmus MC', area: 'Kralingen, Rotterdam, Netherlands', lng: 4.4686, lat: 51.9106 },
  { label: 'Markthal', area: 'Centrum, Rotterdam, Netherlands', lng: 4.4866, lat: 51.92 },
  { label: 'Delft Station', area: 'Delft, Netherlands', lng: 4.3567, lat: 52.0067 },
  { label: 'Den Haag Centraal', area: 'Den Haag, Netherlands', lng: 4.3245, lat: 52.0809 },
  { label: 'Klimhal Rotterdam', area: 'Rotterdam, Netherlands', lng: 4.5137, lat: 51.9031 },
  { label: 'Kralingse Plas', area: 'Kralingen, Rotterdam, Netherlands', lng: 4.5133, lat: 51.9324 },
  { label: 'Schiedam Centrum', area: 'Schiedam, Netherlands', lng: 4.3935, lat: 51.9214 },
  { label: 'Ahoy Rotterdam', area: 'Charlois, Rotterdam, Netherlands', lng: 4.4889, lat: 51.8834 },
  { label: 'Gouda Station', area: 'Gouda, Netherlands', lng: 4.7044, lat: 52.0175 },
];

export class MockGeocoder implements Geocoder {
  async autocomplete(text: string): Promise<Address[]> {
    const q = text.trim().toLowerCase();
    return ADDRESSES.filter((a) => `${a.label} ${a.area}`.toLowerCase().includes(q)).slice(0, 5);
  }
  async nearbyName(point: LngLat): Promise<string | null> {
    const near = ADDRESSES.reduce((b, a) => (haversineKm(a, point) < haversineKm(b, point) ? a : b));
    return near.area.split(',')[0];
  }
}
