export type Mode = 'walk' | 'bike' | 'car' | 'transit';

export type Resolution = 'coarse' | 'fine';

export interface LngLat {
  lng: number;
  lat: number;
}

export interface Address extends LngLat {
  /** Main line, e.g. "Harbour Point Offices, 2 Quay Road" */
  label: string;
  /** Secondary line, e.g. "Rotterdam, Netherlands" */
  area: string;
}

export interface Place {
  id: string;
  name: string;
  address: Address;
  mode: Mode;
  tripsPerWeek: number;
}

/** One-way travel time in seconds, or null when no route exists. */
export type Duration = number | null;

/**
 * Anything that can answer "how long from each source to each destination".
 * ORS answers walk/bike/car, Transitous answers transit.
 * Returns durations[sourceIndex][destinationIndex] in seconds.
 */
export interface MatrixClient {
  matrix(
    mode: Mode,
    sources: LngLat[],
    destinations: LngLat[],
    signal?: AbortSignal,
    options?: MatrixOptions,
  ): Promise<Duration[][]>;
}

export interface MatrixOptions {
  /**
   * Ask for an exact door-to-door answer even if it's slower (the dropped pin).
   * Providers that are always exact ignore it.
   */
  exact?: boolean;
}

/** Key/value store for one-way durations. `undefined` = not cached. */
export interface TravelCache {
  getMany(keys: string[]): Promise<(Duration | undefined)[]>;
  setMany(entries: [string, Duration][]): Promise<void>;
}
