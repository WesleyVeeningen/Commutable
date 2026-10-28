import type { Map as MlMap } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { userMessage } from './core/errors';
import { bboxAround } from './core/grid';
import type { LngLat, Place, Resolution } from './core/types';
import { EmptyState } from './components/EmptyState';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { Legend } from './components/Legend';
import { PlaceForm } from './components/PlaceForm';
import { PlaceList } from './components/PlaceList';
import { ResultCard } from './components/ResultCard';
import { StatusChip, type ChipContent } from './components/StatusChip';
import { useHeatmap } from './hooks/useHeatmap';
import { useIsMobile } from './hooks/useMediaQuery';
import { usePin } from './hooks/usePin';
import { usePlaces, type PlaceDraft } from './hooks/usePlaces';
import { useTheme } from './hooks/useTheme';
import { hexFeatures } from './map/hexes';
import { MapView, type HexState, type MapPadding, type Pin } from './map/MapView';
import { loadResolution, saveResolution } from './services/storage';

const SIDEBAR_W = 380;
/** Left edge of the free map area on desktop: 16 + 380 + 16 */
const SIDEBAR_X = 16 + SIDEBAR_W + 16;
const CARD_W = 340;

type FormState = { open: false } | { open: true; editing: Place | null };

export function App() {
  const [theme, toggleTheme] = useTheme();
  const isMobile = useIsMobile();
  const { places, add, update, remove } = usePlaces();
  const [resolution, setResolution] = useState<Resolution>(loadResolution);
  const [form, setForm] = useState<FormState>({ open: false });
  const [pin, setPin] = useState<Pin | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(places.length === 0);
  const [map, setMap] = useState<MlMap | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [, setMoveTick] = useState(0);

  const heat = useHeatmap(places, resolution);
  const pinResult = usePin(pin, places);
  const hasPlaces = places.length > 0;

  useEffect(() => saveResolution(resolution), [resolution]);
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Re-render on map movement so the result card follows the pin.
  useEffect(() => {
    if (!map || !pin) return;
    const tick = () => setMoveTick((t) => t + 1);
    map.on('move', tick);
    return () => {
      map.off('move', tick);
    };
  }, [map, pin]);
  // Deleting the last place clears the pin.
  useEffect(() => {
    if (!hasPlaces) setPin(null);
  }, [hasPlaces]);

  const hexState: HexState = !heat.grid ? 'none' : heat.weekly ? 'ready' : heat.status === 'error' ? 'none' : 'loading';
  const hexes = useMemo(
    () => (heat.grid ? hexFeatures(heat.grid, heat.weekly, heat.dist) : null),
    [heat.grid, heat.weekly, heat.dist],
  );

  // Fit the view whenever the set of locations changes.
  const fitKey = places.map((p) => `${p.address.lat},${p.address.lng}`).join(';');
  const fitBounds = useMemo(
    () =>
      hasPlaces
        ? bboxAround(
            places.map((p) => p.address),
            4,
          )
        : null,
    [fitKey],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const padding: MapPadding = isMobile
    ? { top: 70, right: 24, left: 24, bottom: Math.round(viewport.h * 0.44) + 16 }
    : { top: 70, right: 40, left: SIDEBAR_X + 24, bottom: 40 };

  const onMapClick = useCallback(
    (p: LngLat) => {
      if (!hasPlaces) return;
      setPin((old) => ({ ...p, id: (old?.id ?? 0) + 1 }));
      if (isMobile) {
        setSheetExpanded(false);
        // The card docks at the top and the sheet at the bottom: move the pin into the gap.
        const h = window.innerHeight;
        const cardH = Math.min(190 + places.length * 62, h * 0.66 - 24);
        map?.easeTo({
          center: [p.lng, p.lat],
          padding: { top: cardH + 12, bottom: h * 0.34, left: 0, right: 0 },
          duration: 500,
        });
      }
    },
    [hasPlaces, isMobile, map, places.length],
  );

  const savePlace = (draft: PlaceDraft) => {
    if (form.open && form.editing) update(form.editing.id, draft);
    else add(draft);
    setForm({ open: false });
  };
  const openForm = (editing: Place | null) => {
    setForm({ open: true, editing });
    if (isMobile) setSheetExpanded(true);
  };

  // --- Status chip ---
  const chipLeft = isMobile ? '50%' : `${SIDEBAR_X + (viewport.w - SIDEBAR_X) / 2}px`;
  let chip: ChipContent | null = null;
  if (!hasPlaces) chip = { kind: 'info', icon: 'hexagon', text: 'Your heatmap appears once you add a place' };
  else if (heat.status === 'error') {
    const kind = (heat.error as { kind?: string })?.kind;
    chip = { kind: 'error', text: userMessage(heat.error), onRetry: kind === 'config' ? undefined : heat.retry };
  } else if (heat.status === 'loading' && heat.grid) {
    const n = heat.grid.cells.length.toLocaleString();
    const p = heat.progress;
    const pct = p && p.total ? Math.floor((p.done / p.total) * 100) : 0;
    chip = { kind: 'loading', text: `Calculating travel times for ${n} areas${pct > 0 ? ` · ${pct}%` : ''}` };
  } else if (!pin) {
    chip = {
      kind: 'info',
      icon: 'touch_app',
      text: isMobile ? 'Tap the map to check a spot' : 'Click anywhere on the map to check a spot',
    };
  }
  const showCard = !!(pin && pinResult && hasPlaces);
  if (isMobile && (showCard || (!hasPlaces && sheetExpanded))) chip = null;

  // --- Result card position ---
  let cardStyle: CSSProperties = {};
  if (showCard && pin) {
    if (isMobile || !map) cardStyle = { top: 12, left: 12, right: 12, maxHeight: 'calc(66% - 24px)' };
    else {
      const ps = map.project([pin.lng, pin.lat]);
      const { w: W, h: H } = viewport;
      const cardH = 190 + places.length * 62;
      const roomR = W - 16 - (ps.x + 28);
      const roomL = ps.x - 28 - SIDEBAR_X;
      let w = CARD_W;
      let left: number;
      if (roomR >= CARD_W) left = ps.x + 28;
      else if (roomL >= CARD_W) left = ps.x - 28 - CARD_W;
      else if (roomR >= roomL) {
        w = Math.max(240, roomR);
        left = ps.x + 28;
      } else {
        w = Math.max(240, roomL);
        left = ps.x - 28 - w;
      }
      left = Math.max(SIDEBAR_X, Math.min(W - w - 16, left));
      const top = Math.max(16, Math.min(H - cardH - 16, ps.y - 150));
      cardStyle = { left, top, width: w };
    }
  }

  // --- Sidebar / bottom sheet ---
  const sheetHeight = sheetExpanded ? '80%' : showCard ? '34%' : '44%';
  const sidebarStyle: CSSProperties = isMobile
    ? {
        left: 0,
        right: 0,
        bottom: 0,
        height: sheetHeight,
        borderRadius: '26px 26px 0 0',
        transition: 'height .3s ease',
      }
    : { top: 16, left: 16, bottom: 16, width: SIDEBAR_W, borderRadius: 26 };

  const mapCentre = map ? map.getCenter() : undefined;

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg font-sans text-ink">
      <MapView
        theme={theme}
        hexes={hexes}
        hexState={hexState}
        places={places}
        pin={hasPlaces ? pin : null}
        fitBounds={fitBounds}
        fitKey={fitKey}
        padding={padding}
        onMapClick={onMapClick}
        onReady={setMap}
      />

      {chip && <StatusChip content={chip} style={{ left: chipLeft }} />}

      {showCard && pinResult && (
        <ResultCard result={pinResult} dist={heat.dist} theme={theme} style={cardStyle} onClose={() => setPin(null)} />
      )}

      <aside
        aria-label="Your places"
        className="absolute z-30 flex flex-col overflow-hidden border border-line bg-panel shadow-panel"
        style={sidebarStyle}
      >
        {isMobile && (
          <button
            onClick={() => setSheetExpanded((e) => !e)}
            aria-label={sheetExpanded ? 'Collapse panel' : 'Expand panel'}
            aria-expanded={sheetExpanded}
            className="flex justify-center border-none bg-transparent pt-2.5"
          >
            <span className="h-[5px] w-10 rounded-[5px] bg-line-strong" />
          </button>
        )}
        <Header theme={theme} onToggleTheme={toggleTheme} />

        <div className="min-h-0 flex-1 overflow-auto px-[22px] pt-1 pb-[22px]">
          {hasPlaces ? (
            <PlaceList
              places={places}
              editingId={form.open && form.editing ? form.editing.id : null}
              onEdit={(p) => openForm(p)}
              onDelete={(p) => {
                if (form.open && form.editing?.id === p.id) setForm({ open: false });
                remove(p.id);
              }}
            />
          ) : (
            !form.open && <EmptyState />
          )}

          {form.open ? (
            <PlaceForm
              key={form.editing?.id ?? 'new'}
              editing={form.editing}
              focus={mapCentre ? { lng: mapCentre.lng, lat: mapCentre.lat } : undefined}
              onSave={savePlace}
              onCancel={() => setForm({ open: false })}
            />
          ) : (
            <button
              onClick={() => openForm(null)}
              className={`mt-3 flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold hover:brightness-[.97] ${
                hasPlaces
                  ? 'border-[1.5px] border-dashed border-line-strong bg-transparent text-accent'
                  : 'border-none bg-accent text-accent-ink'
              }`}
            >
              <Icon name="add" size={20} />
              <span>{hasPlaces ? 'Add a place' : 'Add your first place'}</span>
            </button>
          )}
        </div>

        {hasPlaces && (
          <Legend
            theme={theme}
            dist={heat.dist}
            resolution={resolution}
            downgraded={!!heat.grid?.downgraded}
            showDetail={!isMobile || sheetExpanded}
            onResolution={setResolution}
          />
        )}
      </aside>
    </div>
  );
}
