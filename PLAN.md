# Commutable — build plan

Design source: `design/design_handoff_commutable/` (README + HTML prototype). Tokens, sizes,
copy and animations come from there.

## Key decisions

- **Hex resolution:** H3 res 7 = "coarse" (~2.4 km across, ~5 km²), res 8 = "fine"
  (~1 km across, ~0.7 km²). Default coarse. Grid = bbox around all places + 15 km margin.
  Hard cap on cell count (e.g. 4,000) so a far-flung place list can't burn the daily quota;
  if exceeded, fall back to coarse and say so in the chip.
- **ORS limits (checked):** Matrix allows 3,500 sources × destinations per request; free plan
  is roughly 500 matrix requests/day and ~40/min. So: one destination per place, batches of
  up to 3,000 sources, a small concurrency limit (2) with spacing between calls. If ORS
  answers 6004 ("exceeds server limits") the batch is halved and retried; 429 → wait with
  exponential backoff, then surface "Rate limit reached — Retry" in the chip.
- **Matrix direction:** sources = hex centres, destination = the place (as specified).
  `null` durations → hex is unreachable for that place → grey.
- **Weighting:** `weekly = Σ places (oneWayMin × 2 × tripsPerWeek)`. A hex unreachable for
  *any* place is grey.
- **Cache:** IndexedDB store keyed `"{lat.5dp},{lng.5dp}|{mode}|{h3}" → seconds | null`.
  Changing trips/week recomputes from cache with zero requests; only a new location or mode
  fetches missing cells. Name changes never fetch.
- **Pin:** separate direct Matrix call (1 source = pin, N destinations grouped by mode → one
  call per distinct mode). Not cached by hex.
- **Colour scale:** relative, lo = p2, hi = p98 of current hex values, OKLCH
  green → yellow → red (dark mode L − 0.08), as in the design. Legend shows hours/week.
- **Map:** MapLibre + OpenFreeMap vector style, restyled to the design's land/water/park/road
  colours for light and dark (swap paint properties on theme change). Hex fill layer is
  inserted below road/label layers; opacity .7 light / .55 dark.
- **"Near X" in the result card:** nearest place name from ORS reverse geocode (one call per
  pin, falls back to coordinates).
- **Theme:** follows the system by default; header toggle overrides for the session (design
  shows a toggle).

## Code structure (built for later extensions)

```
src/
  core/                 pure, no DOM/network — unit tested
    types.ts            Place, Mode, TravelProfile, HexResult…
    grid.ts             bbox + margin → H3 cells (resolution param)
    weekly.ts           weighting + summing, unreachable handling, percentiles
    scale.ts            OKLCH heat colour, legend labels, rank percentile
    compute.ts          orchestrator: given places + grid + cache + matrix client →
                        figure out missing (place, cell) pairs, batch, fill cache, sum
    batch.ts            chunking + retry/backoff policy
  services/
    ors.ts              Matrix + geocode autocomplete + reverse (key from env)
    cache.ts            IndexedDB cache (implements a TravelCache interface;
                        an in-memory one is used in tests)
    storage.ts          localStorage for places
  map/                  MapLibre setup, base style theming, hex layer, markers, pin
  components/           Sidebar, PlaceList, PlaceForm, AddressSearch, Legend,
                        EmptyState, StatusChip, ResultCard, BottomSheet, ThemeToggle
  hooks/                usePlaces, useHeatmap, usePin, useTheme, useMediaQuery
```

Extension points: `Mode` is a union mapped to ORS profiles in one table (transit = new entry
+ a different provider behind the same `MatrixClient` interface); `compute` takes a list of
"people" internally (one now) so two-person mode is a combine step on top; the map has a
generic overlay slot for rent prices; scoring a listing = the existing pin breakdown fed by
a geocoded address.

## Steps (run the app after each)

1. **Scaffold:** Vite + React + TS, Tailwind, Vitest, `.env.example`, `.gitignore`, Figtree +
   Material Symbols, design tokens as CSS variables (light/dark). `git init`.
2. **Core module + tests:** types, grid, weekly sums, scale, batching, compute orchestrator
   with an in-memory cache and mocked matrix client. Tests cover weighting, summing,
   unreachable cells, percentiles, cache hits/misses (frequency edit = 0 calls, mode change =
   refetch), batch splitting, retry on 429/6004.
3. **Map shell:** full-screen MapLibre with themed OpenFreeMap style, crosshair cursor.
4. **Sidebar + places:** header, theme toggle, list, empty state, add/edit/delete form with
   mode picker and trips stepper, localStorage persistence. Address autocomplete via ORS
   (debounced, 5 results).
5. **Heatmap:** ORS matrix client + IndexedDB cache wired into `compute`; hex layer, loading
   pulse, status chip with progress ("Calculating travel times for 1,680 areas — 3/8"),
   errors + Retry, coarse/fine switch, legend.
6. **Pin + result card:** drop animation, direct matrix call, breakdown, rank percentile,
   card positioning rules.
7. **Mobile:** bottom sheet (44% / 80% / 34%), docked result card, tap-to-collapse.
8. **Polish + README:** compare side by side with the prototype in both themes and both
   widths; README on getting an ORS key, `.env`, running locally and tests.

## Open questions (I'll go with the default unless you say otherwise)

- Coarse/fine switch placement isn't in the mockups → small segmented control in the legend
  footer, styled like the mode picker.
- No ORS key yet? The app still runs: it shows a clear "Add VITE_ORS_API_KEY to .env" message
  instead of the heatmap. I'll need a key in `.env` to test steps 4–6 against the real API.
