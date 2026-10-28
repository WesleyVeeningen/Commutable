# Commutable

Find a home that gives you time back. Add the places you travel to every week (work, school, gym, friends), each with
a transport mode and trips per week, and Commutable colours the map by **total weekly travel time** from every spot.
Click anywhere to drop a pin and see that spot's weekly total with a per-place breakdown.

Built with Vite, React, TypeScript, Tailwind CSS, MapLibre GL JS (OpenFreeMap tiles), h3-js and the OpenRouteService
(ORS) API. Design reference: [`design/design_handoff_commutable`](design/design_handoff_commutable/README.md).

## 1. Get a free OpenRouteService API key

1. Go to <https://openrouteservice.org> and click **Sign up**. You can also sign in with GitHub.
2. Confirm your email (check your spam folder), then log in and open the **Dashboard**.
3. Create a **Standard** (free) token and copy the key. Accept the terms of service if asked, because tokens stay inactive
   until you do.

The free Standard plan is plenty for personal use. Its quota is roughly 500 Matrix requests per day and about 40 per
minute, plus geocoding. Commutable batches up to 3,000 map cells into one Matrix request and caches everything. A
typical heatmap costs one request per place, and a dropped pin costs one request per transport mode.

## 2. Set up `.env`

```bash
cp .env.example .env
```

Open `.env` and paste your key:

```
VITE_ORS_API_KEY=your-key-here
```

`.env` is git-ignored, so never commit it. Restart the dev server after changing it.

> Note: this is a front-end-only app, so the key is sent from the browser and is visible to anyone using your running
> copy. That is fine for running it locally. If you deploy it publicly, put a small proxy in front of ORS.
> Geocoding requests send the key as an `api_key` URL parameter, because the ORS geocode endpoints don't allow the
> `Authorization` header from browsers. Matrix requests use the header.

## 3. Run it locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

**No key yet?** Run `npm run dev:mock` to try the UI offline. It uses fake straight-line travel times and a handful of
built-in addresses around Rotterdam (try typing "Erasmus", "Delft" or "Markthal").

Other scripts:

| Command             | What it does                    |
| ------------------- | ------------------------------- |
| `npm test`          | Run the unit tests (Vitest)     |
| `npm run typecheck` | Type-check the project          |
| `npm run build`     | Production build into `dist/`   |
| `npm run format`    | Format the source with Prettier |

## How it works

1. **Grid.** The app takes the bounding box around your places plus a 15 km margin and fills it with H3 hexagons. _Coarse_
   uses resolution 7 (cells about 2.4 km across) and _fine_ uses resolution 8 (about 0.9 km across). Switch between them in
   the legend. The grid is capped at 4,000 cells, and fine falls back to coarse when your places are very spread out.
2. **Travel times.** For each place, the app calls the ORS Matrix API with the hex centres as sources and the place as
   the destination, using that place's profile (`foot-walking`, `cycling-regular` or `driving-car`). Each request holds
   at most 3,000 sources, under the 3,500-pair limit. Requests are spaced to respect the per-minute limit. Rate limits
   are retried with exponential backoff, oversized batches are halved, and cells that can't be routed (for example in a
   lake) turn grey.
3. **Weighting.** Weekly minutes for a hex = Σ over places of one-way minutes × 2 (round trip) × trips per week. If a hex
   can't reach one of your places, it is grey.
4. **Colour.** The colour runs green → yellow → red, interpolated in OKLCH. The scale is relative: the low end is the 2nd
   percentile of your map and the high end is the 98th.
5. **Cache.** Durations are stored in IndexedDB under `lat,lng|mode|h3cell`. Changing trips per week or a name
   recalculates instantly with no requests. Only a new location or mode fetches, and only for cells not already cached.
6. **Pin.** The pin uses a direct Matrix call from the exact point, not the hexagon's value. The "Near …" name comes from
   ORS reverse geocoding.

Your places are saved in `localStorage`. The theme follows your system setting, and the header button overrides it for
the session.

## Project structure

```
src/
  core/        Pure travel-time logic, no DOM or network. Unit tested.
    types.ts     Place, Mode, MatrixClient and TravelCache interfaces
    modes.ts     Mode → label, icon and ORS profile (one table)
    grid.ts      Bounding box + margin → H3 cells
    weekly.ts    Weighting, summing, percentiles, breakdown, formatting
    compute.ts   Orchestrator: cache lookup → batched matrix calls → sums
    batch.ts     Chunking, retry with backoff, concurrency pool
    scale.ts     OKLCH heat colours
  services/    ORS client, IndexedDB cache, localStorage, offline mock
  map/         MapLibre view, base-map theming, hex layer, markers
  components/  Sidebar pieces, form, address search, legend, chip, result card
  hooks/       usePlaces, useHeatmap, usePin, useTheme, useMediaQuery
```

### Adding features later

- **Public transit:** add a `transit` entry to `MODES` and a `MatrixClient` for a transit-capable router. `computeHeatmap`
  only depends on the `MatrixClient` interface, so you can route per mode inside a composite client.
- **Two people:** run `sumWeekly` once per person over the same grid and combine the arrays (sum, max or fairness). The
  durations cache is shared, so overlapping places cost nothing extra.
- **Rent overlay:** add another GeoJSON source and layer in `MapView`, inserted below the hex layer.
- **Score a listing link:** geocode the listing's address and reuse `pointDurations` and `breakdown`, exactly like the
  pin.

## Attribution

Map data © OpenStreetMap contributors, tiles by [OpenFreeMap](https://openfreemap.org) / OpenMapTiles. Routing and
geocoding by [openrouteservice](https://openrouteservice.org) (HeiGIT).
