import type { MatrixClient } from '../core/types';
import { IdbTravelCache } from './cache';
import { MockGeocoder, MockMatrixClient } from './mock';
import { OrsGeocoder, OrsMatrixClient, orsApiKey, type Geocoder } from './ors';

export const useMock = import.meta.env.VITE_ORS_MOCK === 'true';
export const hasApiKey = useMock || !!orsApiKey();

export const matrixClient: MatrixClient = useMock ? new MockMatrixClient() : new OrsMatrixClient();
export const geocoder: Geocoder = useMock ? new MockGeocoder() : new OrsGeocoder();
export const travelCache = new IdbTravelCache(useMock ? 'commutable-mock' : 'commutable');
