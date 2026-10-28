import type { Map as MlMap, ExpressionSpecification } from 'maplibre-gl';
import { heatHex } from '../core/scale';

export type Theme = 'light' | 'dark';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Map colours from the design tokens (MapLibre needs hex, not CSS variables). */
export const MAP_PALETTE: Record<Theme, Record<string, string>> = {
  light: {
    land: '#ebe7df',
    water: '#d3e1e2',
    park: '#dde5d2',
    road: '#fbf9f5',
    casing: '#ddd8ce',
    building: '#e3ded5',
    rail: '#d6d1c7',
    boundary: '#c4beb3',
    label: '#8a8d86',
    halo: '#ebe7df',
    unreachable: '#b5b3ad',
    loading: '#6a716d',
  },
  dark: {
    land: '#191d1c',
    water: '#14262a',
    park: '#1a251f',
    road: '#262c2a',
    casing: '#1e2322',
    building: '#1d2120',
    rail: '#262c2a',
    boundary: '#343a38',
    label: '#6f7773',
    halo: '#191d1c',
    unreachable: '#4a504e',
    loading: '#9aa29e',
  },
};

export const HEAT_OPACITY: Record<Theme, number> = { light: 0.7, dark: 0.55 };

/** Hexes sit above land/water/buildings and minor streets, below main roads and labels (dense OSM streets would otherwise mesh over the heat). */
export const HEX_BEFORE_LAYER = 'highway_major_casing';

const PLACE_LABELS = ['label_other', 'label_village', 'label_town', 'label_city', 'label_city_capital'];
const HIDDEN = [
  'highway-shield-non-us',
  'highway-shield-us-interstate',
  'road_shield_us',
  'airport',
  'highway-name-path',
  'boundary_3',
];

function setPaint(map: MlMap, id: string, prop: string, value: unknown) {
  if (map.getLayer(id)) (map.setPaintProperty as (i: string, p: string, v: unknown) => void).call(map, id, prop, value);
}

/** Recolour the OpenFreeMap Positron style to match the design. */
export function applyBaseTheme(map: MlMap, theme: Theme) {
  const c = MAP_PALETTE[theme];
  for (const layer of map.getStyle().layers) {
    const { id, type } = layer;
    const src = 'source-layer' in layer ? layer['source-layer'] : undefined;
    if (HIDDEN.includes(id)) {
      map.setLayoutProperty(id, 'visibility', 'none');
      continue;
    }
    if (type === 'background') setPaint(map, id, 'background-color', c.land);
    else if (type === 'fill') {
      if (src === 'water') setPaint(map, id, 'fill-color', c.water);
      else if (src === 'park' || id === 'landcover_wood') {
        setPaint(map, id, 'fill-color', c.park);
        setPaint(map, id, 'fill-opacity', 1);
      } else if (src === 'building') setPaint(map, id, 'fill-color', c.building);
      else if (src === 'landuse') setPaint(map, id, 'fill-color', c.land);
      else if (src === 'aeroway' || src === 'transportation') setPaint(map, id, 'fill-color', c.road);
    } else if (type === 'line') {
      if (src === 'waterway') setPaint(map, id, 'line-color', c.water);
      else if (src === 'boundary') setPaint(map, id, 'line-color', c.boundary);
      else if (id.startsWith('railway')) setPaint(map, id, 'line-color', c.rail);
      else if (id.includes('casing')) setPaint(map, id, 'line-color', c.casing);
      else if (src === 'transportation' || src === 'aeroway') setPaint(map, id, 'line-color', c.road);
    } else if (type === 'symbol') {
      setPaint(map, id, 'text-color', c.label);
      setPaint(map, id, 'text-halo-color', c.halo);
      setPaint(map, id, 'text-halo-width', 1.6);
      if (PLACE_LABELS.includes(id)) {
        map.setLayoutProperty(id, 'text-transform', 'uppercase');
        map.setLayoutProperty(id, 'text-letter-spacing', 0.12);
        map.setLayoutProperty(id, 'text-font', ['Noto Sans Bold']);
      }
    }
  }
}

/** fill-color expression: t ∈ [0,1] → heat colour, t < 0 → unreachable grey. */
export function heatColorExpression(theme: Theme): ExpressionSpecification {
  const stops: (number | string)[] = [];
  for (let i = 0; i <= 8; i++) stops.push(i / 8, heatHex(i / 8, theme === 'dark'));
  return [
    'case',
    ['<', ['get', 't'], 0],
    MAP_PALETTE[theme].unreachable,
    ['interpolate', ['linear'], ['get', 't'], ...stops] as unknown as ExpressionSpecification,
  ];
}
