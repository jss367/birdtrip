# Migration Map Standalone Page — Design

**Date:** 2026-08-07
**Status:** Approved by Julius (chat, 2026-08-07)

## Problem

The Migration Map is currently a fourth "mode" inside the Birdtrip trip-planner UI.
It shares almost no plumbing with the other modes (no eBird API, no routing, no
geocoding — its corridor data is hardcoded in `public/migration-map.js`), yet it
inherits the full trip-planner shell:

- Panels that do nothing in migration mode: Search Settings (recent days, radius,
  stops), Birding Data (eBird token, targets, life list), Saved Trips, the eBird
  setup badge, and the marker-dot map legend.
- Summary tiles repurposed with confusing semantics (`migration-map.js`
  `renderResults`): "Notable Birds" shows a direction letter, "Top Hotspots" shows
  a corridor intensity percentage, "Target Species" shows a hardcoded "6", etc.
- Nothing renders until the user clicks the "Show Map" submit button, even though
  the empty-state text tells them to use the timeline (which is a no-op before the
  first submit).

Decision: move the Migration Map to its own page on the same site.

## Goals

- A standalone `public/migration.html` whose UI contains only migration-relevant
  controls and content.
- The map renders immediately on page load; all controls are live (no submit step).
- The main Birdtrip app no longer contains migration mode; its Migration button
  links to the new page.
- Existing migration share links keep working via redirect.
- No new server routes, hosting, or API keys.

## Non-goals

- No new migration features or data changes; corridor data and visuals carry over
  as-is.
- No Google Maps support on the new page (Leaflet/OSM only).
- No visual redesign of the corridor rendering, timeline bar, or corridor cards.

## Design

### 1. New page: `public/migration.html`

Minimal standalone shell:

- **Header:** Birdtrip brand mark linking back to `/`, page title "Migration Map",
  Share button (copies permalink), Download HTML button (report).
- **Map region:** full-bleed Leaflet map with the existing migration timeline bar
  overlaid (Play button, month range slider, Jan–Dec month buttons).
- **Results pane:** bird-group `<select>` (all / warblers / waterfowl / shorebirds /
  raptors / hummingbirds), the month/phase overview block, the "not live radar"
  note, and the per-corridor cards with intensity meters.

Nothing else: no trip-planner sidebar, no stat tiles, no eBird setup UI.

Loads `styles.css` (migration styles already live there; a few new layout rules are
added for the standalone shell), Leaflet and Lucide icons from the same CDN pins as
`index.html` (the corridor cards, flow markers, and Play/Pause button all use
`data-lucide` icons), `migration-map.js`, and the new `migration-app.js`.

### 2. New bootstrap: `public/migration-app.js`

A small page controller that:

- Initializes a Leaflet map (OSM tiles, same tile config as the main app's
  `LeafletMapAdapter`).
- Owns the corridor drawing code, moved from `LeafletMapAdapter.setMigration` in
  `app.js`: corridor polylines, anchor dots, animated flow markers
  (`flowMarkers` / `flowMarkerHtml`), popups, fit-to-bounds, and fly-to on
  corridor selection.
- Instantiates `window.BirdtripMigrationMap.createController` with the page's
  elements and renders immediately on `DOMContentLoaded` — precedence:
  defaults (April + "all"), then localStorage, then URL params.
- Live updates: group change, month slider/buttons, and Play all re-render
  directly (the controller's existing `onControlsChanged` path, without the
  `state.migration` guard that made controls dead before first submit).
- **URL params:** reads and writes `?group=<key>&month=<0-11>` via
  `history.replaceState` so the current view is always shareable. Invalid values
  fall back to defaults.
- **Persistence:** saves group + month to `localStorage` under a new
  `birdtrip.migration` key; URL params take precedence over stored values.
- **Share button:** copies the current URL to the clipboard.
- **Download HTML:** reuses the existing `BirdtripMigrationMap.reportMarkup` and
  the report download approach from `app.js` (self-contained HTML file).

### 3. `migration-map.js` changes

Kept as the shared data/controller module, with `renderResults` simplified to
only what the new page has: it no longer writes to trip-planner elements
(`routeDistance`, `hotspotCount`, `notableCount`, `candidateCount`, `liferCount`,
`targetCount`, `maxAdded`, `resultLegend`, `itineraryBuilder`, `comparisonPanel`,
`resultsTitle`). The `resultContext` context line ("group; month; phase") is kept —
the new page's results pane includes an equivalent subtitle element. The
overview/note/corridor-card rendering, month buttons,
playback, and `buildLayer` logic are unchanged.

### 4. Main app cleanup: `index.html` + `app.js`

- The Migration entry in the mode switch stays in the same visual position but
  becomes an `<a href="./migration.html">` styled like the sibling mode buttons.
- Removed from `index.html`: the migration controls form group and the migration
  timeline bar; the `migration-map.js` script tag.
- Removed from `app.js`: the `migration` mode from `normalizeMode`, all
  `isMigration` branches in `setSearchMode`, `runMigrationMap` /
  `renderMigrationMap` / `handleMigrationControlChange`, the
  `migrationController` wiring, `setMigration` in both map adapters,
  migration handling in saved state / preferences / saved trips / report
  generation, and migration element refs.
- Saved state or preferences referencing migration mode fall back to route mode.

### 5. Legacy share-link redirect

`app.js` currently parses `?bt=1&mode=migration&migrationGroup=…&migrationMonth=…`
(plus legacy `migrationSeason`/`migrationWeek`). On load, if a shared URL resolves
to migration mode, the main page redirects
(`location.replace`) to `migration.html?group=<group>&month=<month>`, mapping
legacy season/week to a month exactly as `cleanSharedMigrationMonth` does today.
If the shared URL carries no resolvable month, the `month` param is omitted and
the new page uses its default. The month-mapping helper moves out of the
migration-mode code path so it survives the cleanup.

### 6. Housekeeping

- Add `https://birdtrip.org/migration.html` to `public/sitemap.xml`.
- `migration.html` gets its own title/meta description; canonical URL
  `https://birdtrip.org/migration.html`.
- No `server.js` changes (static files under `public/` are already served).

## Error handling

- Invalid/missing URL params and corrupt localStorage values fall back to
  defaults (April, all migrants) — same clamping the module already does.
- Clipboard write failure on Share falls back to showing the URL in a prompt
  (same behavior as the main app's share fallback, if present; otherwise a
  minimal inline fallback).
- Leaflet CDN failure: page shows the results pane content; no special handling
  beyond what the main app does today.

## Testing / verification

There is no automated test suite (lint only). Verification:

1. `npm run lint` passes.
2. Run `node server.js`; screenshot `migration.html` on load — corridors render
   immediately with April/all defaults.
3. Exercise group change, month scrub, Play, corridor card click (map fly-to +
   selection highlight), Share, Download HTML.
4. Main app: migration button navigates to the new page; route/area/species
   modes unaffected; no console errors referencing removed migration elements.
5. Legacy link check: `/?bt=1&mode=migration&migrationGroup=warblers&migrationMonth=8`
   redirects to `migration.html?group=warblers&month=8`; a `migrationSeason=fall`
   legacy URL maps to the expected month.
