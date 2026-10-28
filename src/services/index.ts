import { MODES } from '../core/modes';
import type { MatrixClient } from '../core/types';
import { IdbTravelCache } from './cache';
import { MockGeocoder, MockMatrixClient } from './mock';
import { OrsGeocoder, OrsMatrixClient, orsApiKey, type Geocoder } from './ors';
import { TransitousClient } from './transitous';

export const useMock = import.meta.env.VITE_ORS_MOCK === 'true';
export const hasApiKey = useMock || !!orsApiKey();

/** Sends each mode to the service that can route it (see MODES[mode].provider). */
class RoutingClient implements MatrixClient {
  private readonly ors = new OrsMatrixClient();
  private readonly transitous = new TransitousClient();
  matrix(...args: Parameters<MatrixClient['matrix']>) {
    const client = MODES[args[0]].provider === 'transitous' ? this.transitous : this.ors;
    return client.matrix(...args);
  }
}

export const matrixClient: MatrixClient = useMock ? new MockMatrixClient() : new RoutingClient();
export const geocoder: Geocoder = useMock ? new MockGeocoder() : new OrsGeocoder();
export const travelCache = new IdbTravelCache(useMock ? 'commutable-mock' : 'commutable');
