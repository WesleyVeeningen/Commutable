import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeHeatmap, uniqueTargets, type Progress } from '../core/compute';
import { TravelError } from '../core/errors';
import { buildGrid, type Grid } from '../core/grid';
import type { Duration, Place, Resolution } from '../core/types';
import { distribution, sumWeekly, type Distribution } from '../core/weekly';
import { hasApiKey, matrixClient, travelCache } from '../services';

export type HeatmapStatus = 'empty' | 'loading' | 'ready' | 'error';

export interface Heatmap {
  status: HeatmapStatus;
  grid: Grid | null;
  weekly: (number | null)[] | null;
  dist: Distribution | null;
  progress: Progress | null;
  error: unknown;
  retry: () => void;
}

/**
 * Runs the travel-time calculation whenever the places' locations/modes or the
 * resolution change. A trips-per-week change re-sums the durations already in
 * memory, so it is instant and makes no requests.
 */
export function useHeatmap(places: Place[], resolution: Resolution): Heatmap {
  // Only location matters for the grid.
  const locKey = places.map((p) => `${p.address.lat},${p.address.lng}`).join(';');
  const grid = useMemo(
    () =>
      places.length
        ? buildGrid(
            places.map((p) => p.address),
            resolution,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locKey, resolution],
  );
  const targetsKey = uniqueTargets(places)
    .map((t) => t.key)
    .sort()
    .join(';');

  const [durations, setDurations] = useState<{ grid: Grid; byTarget: Map<string, Duration[]> } | null>(null);
  const [status, setStatus] = useState<HeatmapStatus>('empty');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const placesRef = useRef(places);
  placesRef.current = places;

  useEffect(() => {
    if (!grid) {
      setStatus('empty');
      setDurations(null);
      return;
    }
    if (!hasApiKey) {
      setStatus('error');
      setError(new TravelError('config', 'Missing API key'));
      return;
    }
    const ctrl = new AbortController();
    setStatus('loading');
    setError(null);
    setProgress(null);
    computeHeatmap({
      places: placesRef.current,
      cells: grid.cells,
      centres: grid.centres,
      matrix: matrixClient,
      cache: travelCache,
      signal: ctrl.signal,
      onProgress: (p) => !ctrl.signal.aborted && setProgress(p),
    })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setDurations({ grid, byTarget: res.durationsByTarget });
        setStatus('ready');
      })
      .catch((e) => {
        if (ctrl.signal.aborted || (e instanceof TravelError && e.kind === 'aborted')) return;
        console.error(e);
        setError(e);
        setStatus('error');
      });
    return () => ctrl.abort();
  }, [grid, targetsKey, attempt]);

  // Re-sum on every places change (trips/week, names) using durations in memory.
  const weekly = useMemo(() => {
    if (!durations || durations.grid !== grid || status !== 'ready') return null;
    if (!places.every((p) => uniqueTargets([p]).every((t) => durations.byTarget.has(t.key)))) return null;
    return sumWeekly(places, durations.byTarget, durations.grid.cells.length);
  }, [durations, grid, places, status]);

  const dist = useMemo(() => (weekly ? distribution(weekly) : null), [weekly]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { status, grid, weekly, dist, progress, error, retry };
}
