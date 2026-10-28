import type { Mode } from './types';

export interface ModeInfo {
  label: string;
  /** Material Symbols icon name */
  icon: string;
  /** OpenRouteService routing profile */
  orsProfile: string;
}

/** Add public transit here (with its own MatrixClient) when it lands. */
export const MODES: Record<Mode, ModeInfo> = {
  walk: { label: 'Walk', icon: 'directions_walk', orsProfile: 'foot-walking' },
  bike: { label: 'Bike', icon: 'directions_bike', orsProfile: 'cycling-regular' },
  car: { label: 'Car', icon: 'directions_car', orsProfile: 'driving-car' },
};

export const MODE_ORDER: Mode[] = ['walk', 'bike', 'car'];

export const TRIPS_MIN = 1;
export const TRIPS_MAX = 21;
export const TRIPS_DEFAULT = 3;
