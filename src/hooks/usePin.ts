import { useEffect, useMemo, useRef, useState } from 'react';
import { pointDurations } from '../core/compute';
import { TravelError } from '../core/errors';
import type { Duration, LngLat, Place } from '../core/types';
import { breakdown, type Breakdown } from '../core/weekly';
import { geocoder, matrixClient } from '../services';

export interface PinResult {
  status: 'loading' | 'ready' | 'error';
  breakdown: Breakdown | null;
  areaName: string | null;
  error: unknown;
  retry: () => void;
}

/**
 * Exact travel times from the pin to every place, via a direct Matrix call
 * (not the hex value). Refetches when the pin or any place's location/mode changes;
 * trips-per-week edits just re-weight.
 */
export function usePin(pin: LngLat | null, places: Place[]): PinResult | null {
  const [secs, setSecs] = useState<Map<string, Duration> | null>(null);
  const [areaName, setAreaName] = useState<string | null>(null);
  const [status, setStatus] = useState<PinResult['status']>('loading');
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const placesRef = useRef(places);
  placesRef.current = places;
  const routeKey = places.map((p) => `${p.id}:${p.address.lat},${p.address.lng}:${p.mode}`).join(';');

  useEffect(() => {
    if (!pin) return;
    const ctrl = new AbortController();
    setStatus('loading');
    setSecs(null);
    pointDurations(pin, placesRef.current, matrixClient, ctrl.signal)
      .then((m) => {
        if (ctrl.signal.aborted) return;
        setSecs(m);
        setStatus('ready');
      })
      .catch((e) => {
        if (ctrl.signal.aborted || (e instanceof TravelError && e.kind === 'aborted')) return;
        setError(e);
        setStatus('error');
      });
    return () => ctrl.abort();
  }, [pin, routeKey, attempt]);

  useEffect(() => {
    if (!pin) return;
    const ctrl = new AbortController();
    setAreaName(null);
    geocoder
      .nearbyName(pin, ctrl.signal)
      .then((n) => !ctrl.signal.aborted && setAreaName(n))
      .catch(() => {});
    return () => ctrl.abort();
  }, [pin]);

  const result = useMemo(() => (secs ? breakdown(places, secs) : null), [secs, places]);

  if (!pin) return null;
  return { status, breakdown: result, areaName, error, retry: () => setAttempt((a) => a + 1) };
}
