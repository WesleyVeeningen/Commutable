import type { Mode } from './types';

export interface ModeInfo {
  label: string;
  /** Material Symbols icon name */
  icon: string;
  /** Which routing service answers this mode */
  provider: 'ors' | 'transitous';
  /** OpenRouteService routing profile (ORS modes only) */
  orsProfile?: string;
}

export const MODES: Record<Mode, ModeInfo> = {
  walk: { label: 'Walk', icon: 'directions_walk', provider: 'ors', orsProfile: 'foot-walking' },
  bike: { label: 'Bike', icon: 'directions_bike', provider: 'ors', orsProfile: 'cycling-regular' },
  car: { label: 'Car', icon: 'directions_car', provider: 'ors', orsProfile: 'driving-car' },
  transit: { label: 'Transit', icon: 'directions_transit', provider: 'transitous' },
};

export const MODE_ORDER: Mode[] = ['walk', 'bike', 'transit', 'car'];

/** Public transport times assume arriving by this time on a weekday. */
export const TRANSIT_ARRIVE_BY = { hours: 8, minutes: 30 };

export const TRIPS_MIN = 1;
export const TRIPS_MAX = 21;
export const TRIPS_DEFAULT = 3;
