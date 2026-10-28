import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { FeatureCollection, Polygon } from 'geojson';
import type { BBox } from '../core/grid';
import type { LngLat, Place } from '../core/types';
import type { HexProps } from './hexes';
import { PinMarker, PlaceMarker } from './Markers';
import { applyBaseTheme, heatColorExpression, HEAT_OPACITY, HEX_BEFORE_LAYER, MAP_PALETTE, STYLE_URL, type Theme } from './theme';

export type HexState = 'none' | 'loading' | 'ready';

export interface Pin extends LngLat {
  id: number;
}

export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Props {
  theme: Theme;
  hexes: FeatureCollection<Polygon, HexProps> | null;
  hexState: HexState;
  places: Place[];
  pin: Pin | null;
  /** Fit the view to this box whenever `fitKey` changes */
  fitBounds: BBox | null;
  fitKey: string;
  padding: MapPadding;
  onMapClick: (p: LngLat) => void;
  onReady?: (map: MlMap) => void;
}

const SOURCE = 'hexes';
const LAYER = 'hexes-fill';
/** Netherlands Randstad — the starting view before any places exist. */
const DEFAULT_VIEW = { center: [4.65, 52.1] as [number, number], zoom: 8.6 };

export function MapView(props: Props) {
  const { theme, hexes, hexState, places, pin, fitBounds, fitKey, padding, onMapClick } = props;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  // Create the map once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: STYLE_URL,
      ...DEFAULT_VIEW,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    map.on('click', (e: maplibregl.MapMouseEvent) => clickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    map.on('load', () => {
      map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer(
        { id: LAYER, type: 'fill', source: SOURCE, paint: { 'fill-opacity': 0, 'fill-antialias': true } },
        map.getLayer(HEX_BEFORE_LAYER) ? HEX_BEFORE_LAYER : undefined,
      );
      setLoaded(true);
      props.onReady?.(map);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base map colours.
  useEffect(() => {
    if (loaded) applyBaseTheme(mapRef.current!, theme);
  }, [loaded, theme]);

  // Hex data.
  useEffect(() => {
    if (!loaded) return;
    (mapRef.current!.getSource(SOURCE) as GeoJSONSource).setData(hexes ?? { type: 'FeatureCollection', features: [] });
  }, [loaded, hexes]);

  // Hex paint + loading pulse / pop-in wave (the design's cpulse and cin keyframes).
  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current!;
    const op = HEAT_OPACITY[theme];
    if (hexState === 'none') {
      map.setPaintProperty(LAYER, 'fill-opacity', 0);
      return;
    }
    map.setPaintProperty(LAYER, 'fill-color', hexState === 'loading' ? MAP_PALETTE[theme].loading : heatColorExpression(theme));

    const start = performance.now();
    let raf = 0;
    let lastFrame = 0;
    const since = (s: number): ExpressionSpecification => ['-', s, ['get', 'delay']];
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - lastFrame < 45) return; // ~20 fps is plenty for a pulse
      lastFrame = now;
      const s = (now - start) / 1000;
      if (hexState === 'loading') {
        // opacity .18 → .5 → .18 every 1.4s, phase-shifted by each hex's delay
        map.setPaintProperty(LAYER, 'fill-opacity', [
          '*',
          op,
          ['+', 0.18, ['*', 0.16, ['-', 1, ['cos', ['*', (2 * Math.PI) / 1.4, since(s)]]]]],
        ]);
      } else {
        // fade in over .5s with ease-out, after each hex's delay
        if (s > 1.4) {
          map.setPaintProperty(LAYER, 'fill-opacity', op);
          cancelAnimationFrame(raf);
          return;
        }
        const x: ExpressionSpecification = ['max', 0, ['min', 1, ['/', since(s), 0.5]]];
        map.setPaintProperty(LAYER, 'fill-opacity', ['*', op, ['-', 1, ['^', ['-', 1, x], 3]]]);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [loaded, hexState, theme, hexes]);

  // Fit to the places when they change.
  useEffect(() => {
    if (!loaded || !fitBounds) return;
    mapRef.current!.fitBounds(
      [
        [fitBounds.west, fitBounds.south],
        [fitBounds.east, fitBounds.north],
      ],
      { padding, maxZoom: 13, duration: 900 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, fitKey]);

  return (
    <div className="absolute inset-0" style={{ background: 'var(--land)' }}>
      {/* inline style: maplibre-gl.css sets .maplibregl-map { position: relative } */}
      <div ref={container} style={{ position: "absolute", inset: 0 }} />
      {loaded &&
        places.map((p) => (
          <MapMarker key={p.id} map={mapRef.current!} at={p.address} anchor="left" offset={[-17, 0]}>
            <PlaceMarker place={p} />
          </MapMarker>
        ))}
      {loaded && pin && (
        <MapMarker key={`pin${pin.id}`} map={mapRef.current!} at={pin} anchor="center">
          <PinMarker />
        </MapMarker>
      )}
    </div>
  );
}

/** A maplibre Marker whose content is rendered by React. */
function MapMarker({
  map,
  at,
  anchor,
  offset,
  children,
}: {
  map: MlMap;
  at: LngLat;
  anchor: maplibregl.PositionAnchor;
  offset?: [number, number];
  children: ReactNode;
}) {
  const [el] = useState(() => {
    const d = document.createElement('div');
    d.style.pointerEvents = 'none';
    return d;
  });
  const markerRef = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const m = new maplibregl.Marker({ element: el, anchor, offset }).setLngLat([at.lng, at.lat]).addTo(map);
    markerRef.current = m;
    return () => {
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, el]);
  useEffect(() => {
    markerRef.current?.setLngLat([at.lng, at.lat]);
  }, [at.lng, at.lat]);
  return createPortal(children, el);
}
