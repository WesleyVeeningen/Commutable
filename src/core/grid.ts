import { cellToBoundary, cellToLatLng, polygonToCells } from 'h3-js';
import type { LngLat, Resolution } from './types';

/** H3 resolution per setting: res 7 ≈ 2.4 km across, res 8 ≈ 0.9 km across. */
export const H3_RES: Record<Resolution, number> = { coarse: 7, fine: 8 };

/** Average cell area in km² per H3 resolution (from the H3 docs). */
const CELL_AREA_KM2: Record<number, number> = { 7: 5.161, 8: 0.737 };

export const DEFAULT_MARGIN_KM = 15;
/** Upper bound so a spread-out list of places can't burn the daily API quota. */
export const MAX_CELLS = 4000;

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const KM_PER_DEG_LAT = 110.574;

export function bboxAround(points: LngLat[], marginKm: number): BBox {
  if (points.length === 0) throw new Error('bboxAround needs at least one point');
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const p of points) {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  const midLat = (south + north) / 2;
  const dLat = marginKm / KM_PER_DEG_LAT;
  const dLng = marginKm / (111.32 * Math.cos((midLat * Math.PI) / 180));
  return {
    west: west - dLng,
    south: Math.max(-85, south - dLat),
    east: east + dLng,
    north: Math.min(85, north + dLat),
  };
}

export function bboxAreaKm2(b: BBox): number {
  const midLat = (b.south + b.north) / 2;
  const h = (b.north - b.south) * KM_PER_DEG_LAT;
  const w = (b.east - b.west) * 111.32 * Math.cos((midLat * Math.PI) / 180);
  return w * h;
}

export function estimateCellCount(b: BBox, resolution: Resolution): number {
  return Math.round(bboxAreaKm2(b) / CELL_AREA_KM2[H3_RES[resolution]]);
}

export interface Grid {
  resolution: Resolution;
  /** True when "fine" was requested but too many cells forced "coarse". */
  downgraded: boolean;
  bbox: BBox;
  cells: string[];
  centres: LngLat[];
}

export function buildGrid(
  points: LngLat[],
  requested: Resolution,
  marginKm = DEFAULT_MARGIN_KM,
  maxCells = MAX_CELLS,
): Grid {
  const bbox = bboxAround(points, marginKm);
  let resolution = requested;
  if (requested === 'fine' && estimateCellCount(bbox, 'fine') > maxCells) resolution = 'coarse';

  const ring: [number, number][] = [
    [bbox.south, bbox.west],
    [bbox.south, bbox.east],
    [bbox.north, bbox.east],
    [bbox.north, bbox.west],
  ];
  let cells = polygonToCells(ring, H3_RES[resolution]);
  if (cells.length > maxCells) {
    // Keep the cells closest to the places' centre so the useful middle survives.
    const c = centreOf(points);
    cells = cells
      .map((id) => ({ id, d: dist2(cellCentre(id), c) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, maxCells)
      .map((x) => x.id);
  }
  cells.sort();
  return {
    resolution,
    downgraded: resolution !== requested,
    bbox,
    cells,
    centres: cells.map(cellCentre),
  };
}

export function cellCentre(cell: string): LngLat {
  const [lat, lng] = cellToLatLng(cell);
  return { lng, lat };
}

/** GeoJSON ring ([lng, lat], closed) for a cell. */
export function cellRing(cell: string): [number, number][] {
  return cellToBoundary(cell, true) as [number, number][];
}

function centreOf(points: LngLat[]): LngLat {
  const n = points.length;
  return {
    lng: points.reduce((s, p) => s + p.lng, 0) / n,
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
  };
}

function dist2(a: LngLat, b: LngLat): number {
  const k = Math.cos((b.lat * Math.PI) / 180);
  return ((a.lng - b.lng) * k) ** 2 + (a.lat - b.lat) ** 2;
}
