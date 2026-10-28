# Handoff: Commutable — weekly travel-time heatmap

## Overview
Single-page web app for house hunters. The user lists places they visit regularly (work, school, gym…), each with a transport mode and trips per week. A full-screen map shows a hexagon heatmap of total weekly travel time from every location (green = little, yellow, red = a lot). Clicking the map drops a pin and shows the weekly total for that spot with a per-place breakdown.

## About the design files
`Commutable.dc.html` is a **design reference built in HTML** (open it in a browser; `support.js` must sit beside it). It is a working prototype of look and behaviour, not production code. Recreate it in the target codebase's stack (e.g. React + a real map library such as MapLibre/Mapbox + H3 hexagons + a routing/isochrone API). If no codebase exists, choose an appropriate stack.

The prototype fakes: the map (simple SVG shapes in a fictional city), geocoding (10 hard-coded addresses), and travel times (straight-line distance × 1.3 ÷ mode speed + overhead). Replace all three with real services.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and interactions are final. Match them.

## Layout
### Desktop (≥ 760px)
- Map fills the viewport (`position: fixed; inset: 0`).
- Sidebar floats over it: `top/left/bottom: 16px`, width `380px`, radius `26px`, panel bg, 1px border `--line`, shadow `--shadow`. Column flex: header → scrollable content → legend footer.
- Map status chip: top 20px, horizontally centred in the map area right of the sidebar (centre = 412 + (W − 412)/2).
- Result card: width 340px (shrinks to the available side room, min 240px), placed 28px to the right of the pin, or to the left if there's no room; never under the sidebar (min left 412px). Vertically centred-ish on pin (top = pin.y − 150, clamped 16px from edges).

### Mobile (< 760px)
- Sidebar becomes a bottom sheet: full width, radius `26px 26px 0 0`, drag handle (40×5px pill) at top. Heights: 44% default, 80% expanded (tap handle), 34% while a result card is shown. Height transitions `.3s ease`.
- Result card docks at top: `top/left/right: 12px`.
- Tapping the map collapses the sheet.

## Components
### Sidebar header
- Logo mark: hexagon 26×28, fill `--accent`, with 4px-radius circle in `--panel` centred. Wordmark "Commutable" 20px/700, letter-spacing −0.02em. Padding `18px 22px 14px`.
- Theme toggle: 38px circle, 1px `--line-strong` border, icon `dark_mode` / `light_mode`; hover bg `--sunk`.

### "Your places" list
- Section label: "YOUR PLACES" 13px/700, uppercase, letter-spacing .06em, `--muted`; right side "N trips / week" 13px muted.
- Items: 8px gap. Each a grid `42px | 1fr | auto`, gap 12px, padding 12px, radius 18px, bg `--sunk`.
  - Icon tile 42×42, radius 14px, bg `--panel`, icon 22px `--accent` (walk/bike/car).
  - Name 15px/700 (ellipsis) + frequency pill "5× / week" (12px/600, padding 2px 8px, radius 999, bg `--accent-soft`, text `--accent`).
  - Address 13px `--muted`, single line ellipsis.
  - Edit / delete icon buttons 34×34, radius 10px, transparent, `--muted`; hover bg `--panel` + ink (delete hover text `oklch(0.6 0.15 30)`).
  - Item being edited: `outline: 2px solid var(--accent)`, offset −2px.
- "Add a place" button: full width, 50px, radius 16px, 1.5px dashed `--line-strong`, accent text 15px/700, `add` icon. In the empty state it's solid accent: "Add your first place".

### Add / edit form (inline, below the list)
Container: margin-top 12px, padding 18px, radius 20px, bg `--sunk`, column gap 16px, enter animation `cardin .25s`.
- Title "Add a place" / "Edit place" 16px/700.
- Field labels 13px/600 `--muted`, gap 6px.
- Inputs: height 44px, radius 12px, 1px `--line-strong`, bg `--panel`, 15px/500. Focus: border `--accent` + `0 0 0 3px var(--accent-soft)` ring. Name placeholder: "e.g. Work, Gym, Mum’s".
- Address: search icon inset left (padding-left 40px), placeholder "Search an address or place". Autocomplete dropdown (shown when query non-empty): absolute below, radius 14px, panel bg, shadow, padding 6px, max 5 results; row = location_on icon + label 14px/600 + area 12px muted; hover bg `--sunk`. Empty: "No matches. Try a street or area name." Typing clears the selected address; a selection is required to save.
- Mode picker: 3-column segmented control, container padding 4px radius 14px; segments 40px tall radius 10px, icon + label (Walk / Bike / Car). Selected: bg `--accent`, text `--accent-ink`.
- Trips per week: label + helper "Counted there and back" (12px muted); stepper with −/+ 36px buttons and value "3×" 16px/700 tabular. Range 1–21. Default 3.
- Actions right-aligned: "Cancel" (text button, muted) and primary "Add place" / "Save changes" (42px, radius 12px, accent bg, 14px/700). Primary at 45% opacity and inert until name + address are set.

### Legend (sidebar footer)
Padding `16px 22px 20px`, top border `--line`. Title "Weekly travel time" 13px/700, right "hours per week" 12px muted. Bar 12px tall, fully rounded, linear gradient through 5 heat stops. Labels below: low / mid / high+ (e.g. "3h", "9h", "16h+"), 12px/600 muted, tabular. The scale is relative: low = 2nd percentile, high = 98th percentile of all hex values for the current places.

### Empty state (no places)
Centred column, padding `28px 8px 12px`, gap 18px.
- Illustration: small cluster of 4 hexagons (green, yellow, green 70%, red 75%), a dark pin dot and two accent dots. Replace with a proper illustration if available.
- Heading "Find a home that gives you time back" 20px/700.
- Body (15px/1.5 muted): "Add the places you go each week and we’ll colour the map by how many hours you’d spend getting there from each spot."
- Map shows no hexes; chip reads "Your heatmap appears once you add a place".

### Map
- Base layers: land `--land`, parks `--park` (rounded rects), river/harbour `--water`, roads `--road`, area labels (14px/700 uppercase, letter-spacing .12em, `--label`, halo stroke in `--land`).
- Hex layer sits above land/water and below roads/labels, group opacity `--heat-op` (.7 light / .55 dark). Pointy-top hexes, drawn at 93% size so land shows through as gaps. Radius tweakable 14 / 20 / 28 (in a 1600×1000 viewBox).
- Place markers: 30px accent circle, 2px panel border, filled mode icon 18px; label pill beside it (12px/600, panel bg, small shadow).
- Cursor: crosshair.

### Pin
Teardrop 30×30 (`border-radius: 50% 50% 50% 0; rotate(-45deg)`), bg `--ink`, 3px `--panel` border, 8px panel dot centre, blurred ground shadow. Drop animation `pdrop .5s cubic-bezier(.3,1.4,.5,1)` (falls 46px with slight overshoot), plus a ring `ping 1.4s ease-out` ×2 starting at .35s.

### Result card
Panel bg, 1px `--line`, radius 24px, shadow, padding `20px 22px 14px`, enter `cardin .35s`.
- Top row: location_on + "Near Canal Quarter" (nearest neighbourhood) 13px/600 muted; close button 32px circle bg `--sunk`.
- Total: "4h 10m" 46px/700, letter-spacing −0.03em, + "/ week" 17px/500 muted.
- Context line: 10px dot in the heat colour of this total + "Quicker than 78% of the map" / "Slower than 22% of the map" (13px muted).
- Divider, then a row per place: grid `32px | 1fr | auto`, gap 12px, padding 10px 0. Icon tile 32px radius 10px accent-soft; name 14px/600; 4px progress bar (accent, width relative to the largest place); detail "5× · 24 min each way" 12px muted; right total 15px/700 tabular.

### Status chip (top of map)
Pill, padding `10px 16px`, panel bg, shadow, 14px/500, non-interactive.
- Idle with places, no pin: `touch_app` icon + "Click anywhere on the map to check a spot" ("Tap the map…" on mobile).
- Loading: 72×4px track with an indeterminate accent bar (`bar 1.1s` sliding) + "Calculating travel times for 1,680 areas".
- Hidden while a card is open on mobile.

## Interactions & behaviour
- **Click/tap map** (only when ≥1 place): drop the pin at that point, compute the breakdown, show the card. A new click replaces the pin and replays the drop animation. Close (×) removes the pin.
- **Add/edit/delete place** → recalculates heatmap: enter loading state (hexes turn `--muted` and pulse `cpulse 1.4s` with a diagonal wave delay = (x/W)·0.5s + (y/H)·0.35s); when done, hexes pop in coloured (`cin .5s cubic-bezier(.2,.8,.3,1)`, same wave delay). The prototype fakes 1.5s; in production, tie it to the real computation.
- Deleting the last place → empty state, pin cleared.
- Opening the form on mobile expands the sheet.
- **Theme toggle** switches light/dark; both share the same layout.
- **Travel model (prototype only):** weekly minutes per place = 2 × trips × one-way minutes. Replace with real routing per mode (ideally isochrones or a travel-time matrix per hex).

## State
- `places[]`: `{ id, name, address {label, area, lat/lng}, mode: 'walk'|'bike'|'car', tripsPerWeek }`
- `pin`: `{ lat, lng } | null`
- `loading: boolean` (heatmap computing)
- `form`: `{ open, editId, name, query, selectedAddress, mode, trips, suggestOpen }`
- `theme: 'light'|'dark'` (default to system preference)
- `sheetOpen` (mobile)
- Derived: hex values grid, percentile scale (lo/hi), pin breakdown, rank percentile, nearest area name.
- Data needs: geocoding/autocomplete API, travel-time API per mode, hex grid (e.g. H3) over the visible area.

## Design tokens
Font: **Figtree** (400/500/600/700) from Google Fonts. Icons: **Material Symbols Rounded** (directions_walk, directions_bike, directions_car, edit, delete, add, remove, search, location_on, close, touch_app, hexagon, dark_mode, light_mode).

| Token | Light | Dark |
|---|---|---|
| --bg | #f6f4f0 | #141716 |
| --panel | #fffdf9 | #1c201f |
| --sunk | #f3efe8 | #232826 |
| --ink | #1f2523 | #ebeeec |
| --muted | #6a716d | #9aa29e |
| --line | rgba(31,37,35,.08) | rgba(255,255,255,.07) |
| --line-strong | rgba(31,37,35,.16) | rgba(255,255,255,.14) |
| --accent | oklch(0.55 0.09 195) | oklch(0.74 0.09 195) |
| --accent-ink | #ffffff | #0f1a1b |
| --accent-soft | oklch(0.94 0.03 195) | oklch(0.32 0.04 195) |
| --land | #ebe7df | #191d1c |
| --water | #d3e1e2 | #14262a |
| --park | #dde5d2 | #1a251f |
| --road | #fbf9f5 | #262c2a |
| --label | #8a8d86 | #6f7773 |
| --heat-op | .7 | .55 |
| --shadow | 0 12px 40px rgba(40,34,24,.12), 0 2px 6px rgba(40,34,24,.06) | 0 12px 40px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.3) |

**Heat scale** (interpolate in OKLCH, t = 0→1): green `oklch(0.80 0.12 150)` → yellow `oklch(0.87 0.13 95)` → red `oklch(0.69 0.15 35)`. In dark mode subtract 0.08 from L.

**Radii:** 10 (small buttons), 12 (inputs/buttons), 14 (tiles, segmented), 16 (add button), 18 (list items), 20 (form), 24 (card), 26 (sidebar), 999 (pills).
**Spacing:** 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 px. Sidebar content gutter 22px.
**Type scale:** 12 / 13 / 14 / 15 / 16 / 17 / 20 / 46 px.

## Keyframes
- `cpulse`: opacity .18 → .5 → .18
- `cin`: opacity 0, scale .5 → 1 (transform-box: fill-box; origin center)
- `pdrop`: translateY(−46px) → 3px (60%) → 0, all at rotate(−45deg); opacity 0 → 1
- `ping`: scale .4, opacity .9 → scale 1.6, opacity 0
- `cardin`: opacity 0, translateY(8px) → none
- `bar`: translateX(−100%) → 250%

## Assets
No images. Icons from Material Symbols Rounded. The empty-state illustration is made from simple shapes and is a placeholder for a real illustration.

## Files
- `Commutable.dc.html`: the full prototype (template markup + logic class at the bottom). Open in a browser.
- `support.js`: runtime needed to open the prototype. Not part of the design.
