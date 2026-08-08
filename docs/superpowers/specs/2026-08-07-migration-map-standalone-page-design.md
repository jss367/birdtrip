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
  as-is. (Descriptive copy about the data is updated — see "Data provenance
  wording" — but the data and rendering are not.)
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
added for the standalone shell), Leaflet and Lucide icons from the same CDN URLs as
`index.html` (the corridor cards, flow markers, and Play/Pause button all use
`data-lucide` icons; note `index.html` uses unpinned `lucide@latest` — the new
page matches it rather than diverging), `migration-map.js`, and the new
`migration-app.js`.

### 2. New bootstrap: `public/migration-app.js`

A small page controller that:

- Initializes a Leaflet map (OSM tiles, same tile config as the main app's
  `LeafletMapAdapter`).
- Owns the corridor drawing code, moved from `LeafletMapAdapter.setMigration` in
  `app.js`: corridor polylines, anchor dots, animated flow markers
  (`flowMarkers` / `flowMarkerHtml`), popups, fit-to-bounds, and fly-to on
  corridor selection.
- Instantiates `window.BirdtripMigrationMap.createController` with the page's
  elements and renders immediately on `DOMContentLoaded`. Setting precedence
  (highest first): URL params, then localStorage, then defaults (April + "all").
- Live updates: group change, month slider/buttons, and Play all re-render
  directly (the controller's existing `onControlsChanged` path, without the
  `state.migration` guard that made controls dead before first submit).
- **URL params:** reads and writes `?group=<key>&month=<0-11>` via
  `history.replaceState` so the current view is always shareable. Invalid values
  are ignored and resolution continues through the precedence chain.
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

**Data provenance wording:** the corridor data is hand-authored, not derived from
a documented model, and a standalone page lends the visualization more apparent
authority. The note block and the HTML report replace "modeled macro patterns"
with "illustrative generalized patterns", and state that intensity values are
relative, synthetic indicators — not measurements. No other copy changes.

### 4. Main app cleanup: `index.html` + `app.js`

- The Migration entry in the mode switch stays in the same visual position but
  becomes an `<a href="./migration.html">`. The mode-switch CSS currently targets
  only `.mode-switch button` (base, `.is-active`, `:disabled`, and two responsive
  blocks), so a shared class (e.g. `.mode-switch-item`) is introduced and applied
  to both the buttons and the link, with all selectors updated; the link gets the
  same hover/focus states. The group's `aria-label` changes from "Search mode"
  (inaccurate once it contains a navigation link) to "Birdtrip tools", and the
  link needs no external-page affordance — it is plain same-site navigation.
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
(plus legacy `migrationSeason`/`migrationWeek`). The redirect check runs as the
**first statement of `init()`**, before `readSharedSearchFromUrl`,
`restorePreferences`, `normalizeMode`, controller setup, and map initialization —
the current parse path calls `normalizeMode` and
`window.BirdtripMigrationMap.isGroup`, so running it first would either coerce
migration links to route mode or reference a global the main page no longer
loads. The redirect helper is self-contained: it uses a small local whitelist of
the six group keys and a local copy of the season/week→month mapping from
`cleanSharedMigrationMonth` (that logic moves out of the shared-search parser,
which no longer handles migration). If the URL is a migration share link, the
page redirects via `location.replace` to `migration.html?group=<group>&month=<month>`;
if no month is resolvable, the `month` param is omitted and the new page uses
its default.

### 6. Housekeeping

- Add `https://birdtrip.org/migration.html` to `public/sitemap.xml`.
- `migration.html` gets its own title/meta description; canonical URL
  `https://birdtrip.org/migration.html`.
- No `server.js` changes (static files under `public/` are already served).

## Error handling

- **Input validation rule (exact):** a `month` is accepted only if it is an
  integer string 0–11; a `group` only if it is one of the six known keys. An
  invalid value causes that *source* to be ignored (not clamped — note the
  existing `clamp` turns `NaN` into January, which is not the desired fallback),
  falling through the precedence chain: URL param → localStorage → defaults
  (April, all migrants). Corrupt localStorage JSON is treated the same as
  absent.
- Share uses the same clipboard approach as the main app's `copyTextToClipboard`
  (app.js:1816): `navigator.clipboard` when available, hidden-textarea
  `execCommand("copy")` fallback otherwise; if both fail, the status line shows
  the URL for manual copying. The helper is duplicated into `migration-app.js`
  (it is ~15 lines; not worth a shared module for one function).
- **Leaflet CDN failure:** map initialization is guarded (`window.L` check). If
  Leaflet is absent, the bootstrap skips map creation and passes a null map
  adapter — the controller already no-ops its map rendering when the adapter is
  null (`renderMap` early-returns), so the group picker, timeline, and corridor
  cards still render and stay interactive; only the map itself is empty.

## Testing / verification

There is no automated test suite (lint only). Verification:

1. `npm run lint` passes.
2. Run `node server.js`; screenshot `migration.html` on load — corridors render
   immediately with April/all defaults.
3. Exercise group change, month scrub, Play, corridor card click (map fly-to +
   selection highlight), Share, Download HTML.
4. Main app: migration link navigates to the new page and is styled/focusable
   like the sibling mode buttons; route/area/species modes unaffected; no
   console errors referencing removed migration elements or the absent
   `BirdtripMigrationMap` global.
5. Legacy link checks: `/?bt=1&mode=migration&migrationGroup=warblers&migrationMonth=8`
   redirects to `migration.html?group=warblers&month=8`; a `migrationSeason=fall`
   legacy URL maps to the expected month; a migration share link with no month
   redirects without a `month` param.
6. Precedence and bad input: a URL param overrides a differing localStorage
   value; corrupt localStorage and invalid params (`month=bad`, `month=99`,
   unknown group) fall through to defaults rather than clamping to January.
7. Leaflet-failure guard: load `migration.html` with `window.L` unavailable
   (e.g. block the Leaflet script) — the group picker, timeline, Play, and
   corridor cards still render and respond; no uncaught errors; only the map
   region is empty.
8. Layout check at desktop and a narrow/mobile viewport for the new page.
