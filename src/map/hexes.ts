import type { FeatureCollection, Polygon } from 'geojson';
import { cellRing, type Grid } from '../core/grid';
import { scalePosition, type Distribution } from '../core/weekly';

export interface HexProps {
  cell: string;
  /** 0..1 on the legend scale; -1 = unreachable */
  t: number;
  /** wave delay in seconds for the loading pulse / pop-in */
  delay: number;
}

/** Hex polygons with their legend position and wave delay. Gaps come from MapView's outline layer. */
export function hexFeatures(
  grid: Grid,
  weekly: (number | null)[] | null,
  dist: Distribution | null,
): FeatureCollection<Polygon, HexProps> {
  const { west, east, south, north } = grid.bbox;
  return {
    type: 'FeatureCollection',
    features: grid.cells.map((cell, i) => {
      const ring = cellRing(cell);
      const c = grid.centres[i];
      const v = weekly?.[i];
      const x = (c.lng - west) / (east - west);
      const y = (north - c.lat) / (north - south);
      return {
        type: 'Feature',
        id: i,
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: {
          cell,
          t: v === null || v === undefined || !dist ? -1 : scalePosition(v, dist),
          delay: x * 0.5 + y * 0.35,
        },
      };
    }),
  };
}
