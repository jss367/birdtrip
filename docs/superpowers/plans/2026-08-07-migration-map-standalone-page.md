# Migration Map Standalone Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Migration Map from a mode inside the Birdtrip trip planner into a standalone `public/migration.html` page, and remove migration mode from the main app.

**Architecture:** The existing `public/migration-map.js` module (corridor data + `MigrationController`) is kept as the shared engine. A new `public/migration.html` + `public/migration-app.js` provide a minimal standalone shell (Leaflet-only, renders on load, live controls, URL/localStorage persistence, share + HTML report). The main app (`public/app.js`, `public/index.html`) loses migration mode entirely; a self-contained redirect at the very top of `init()` keeps legacy `?bt=1&mode=migration…` share links working.

**Tech Stack:** Vanilla JS (no build step), Leaflet 1.9.4 (unpkg, SRI-pinned), Lucide icons (unpkg `@latest`, matching `index.html`), Node `server.js` static host. No test framework — verification is `npm run lint`, `node --check`, and browser checks.

**Spec:** `docs/superpowers/specs/2026-08-07-migration-map-standalone-page-design.md` — the spec is authoritative on behavior (validation rule, precedence, redirect ordering, Leaflet guard, provenance wording).

**Working conventions for every task:**
- After editing any JS file run both `npm run lint` and `node --check public/<file>.js`.
- Commit at the end of every task with the message given in the task.
- Do not reformat surrounding code; match existing style (2-space indent, double quotes, semicolons).

---

### Task 1: Create `public/migration.html`

**Files:**
- Create: `public/migration.html`

- [ ] **Step 1: Write the file**

Complete contents:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Illustrative annual bird migration patterns across the United States, by bird group and month.">
  <meta name="theme-color" content="#10b981">
  <link rel="canonical" href="https://birdtrip.org/migration.html">
  <meta property="og:site_name" content="Birdtrip">
  <meta property="og:title" content="Birdtrip Migration Map">
  <meta property="og:description" content="Animate illustrative generalized migration patterns across the United States, month by month.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://birdtrip.org/migration.html">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Birdtrip Migration Map">
  <meta name="twitter:description" content="Animate illustrative generalized migration patterns across the United States, month by month.">
  <title>Birdtrip Migration Map</title>
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
  <link rel="stylesheet" href="./styles.css">
</head>
<body class="migration-page">
  <div class="migration-shell">
    <header class="app-header migration-header">
      <a class="app-brand migration-brand-link" href="./">
        <div class="brand-mark" aria-hidden="true"><i data-lucide="binoculars"></i></div>
        <div>
          <h1>Birdtrip</h1>
          <p>Migration Map</p>
        </div>
      </a>
      <div class="header-actions">
        <span id="pageStatus" class="migration-page-status" role="status" aria-live="polite"></span>
        <button type="button" id="shareButton" class="ghost-button">
          <i data-lucide="share-2"></i>
          Share
        </button>
        <button type="button" id="downloadReportButton" class="ghost-button">
          <i data-lucide="file-down"></i>
          Download HTML
        </button>
      </div>
    </header>

    <main class="migration-layout">
      <section class="migration-map-region">
        <div id="map"></div>
        <div id="migrationTimelineBar" class="migration-timeline-bar">
          <button type="button" id="migrationPlayButton" class="migration-play-button">
            <i data-lucide="play"></i>
            <span>Play</span>
          </button>
          <div class="migration-timeline-main">
            <div class="migration-timeline-status">
              <b id="migrationMonthLabel">April</b>
              <span id="migrationPhaseLabel">Peak spring movement</span>
            </div>
            <input id="migrationMonth" name="migrationMonth" type="range" min="0" max="11" value="3" aria-label="Migration month">
            <div id="migrationTimeline" class="migration-months" aria-label="Migration months"></div>
          </div>
        </div>
      </section>

      <section class="migration-results-region">
        <div class="results-header">
          <div>
            <h2>Migration Map</h2>
            <p id="resultContext">Illustrative generalized patterns; not live radar.</p>
          </div>
          <label class="migration-group-picker">
            <span>Bird group</span>
            <select id="migrationGroup" name="migrationGroup">
              <option value="all">All nocturnal migrants</option>
              <option value="warblers">Warblers and songbirds</option>
              <option value="waterfowl">Waterfowl</option>
              <option value="shorebirds">Shorebirds</option>
              <option value="raptors">Raptors</option>
              <option value="hummingbirds">Hummingbirds</option>
            </select>
          </label>
        </div>
        <div class="results-list migration-results" id="resultsList"></div>
      </section>
    </main>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <script src="./migration-map.js"></script>
  <script src="./migration-app.js"></script>
</body>
</html>
```

Note: the timeline bar markup and the group `<select>` options are copied verbatim from `index.html` (lines 342–355 and 93–100) except the timeline bar has no `hidden` attribute here.

- [ ] **Step 2: Commit**

```bash
git add public/migration.html
git commit -m "Add standalone migration map page shell"
```

---

### Task 2: Create `public/migration-app.js`

**Files:**
- Create: `public/migration-app.js`
- Reference (do not modify yet): `public/app.js:5545-5588` (`LeafletMapAdapter.setMigration` — source of the corridor drawing code), `public/app.js:1816-1832` (`copyTextToClipboard` — duplicated here per spec)

- [ ] **Step 1: Write the file**

Complete contents:

```js
(function () {
  const MM = window.BirdtripMigrationMap;
  const STORAGE_KEY = "birdtripMigrationView";
  const DEFAULTS = { group: "all", month: 3 };

  const els = {
    group: document.querySelector("#migrationGroup"),
    month: document.querySelector("#migrationMonth"),
    monthLabel: document.querySelector("#migrationMonthLabel"),
    phaseLabel: document.querySelector("#migrationPhaseLabel"),
    play: document.querySelector("#migrationPlayButton"),
    timeline: document.querySelector("#migrationTimeline"),
    resultContext: document.querySelector("#resultContext"),
    resultsList: document.querySelector("#resultsList"),
    shareButton: document.querySelector("#shareButton"),
    downloadButton: document.querySelector("#downloadReportButton"),
    status: document.querySelector("#pageStatus")
  };

  function parseGroup(value) {
    return typeof value === "string" && MM.isGroup(value) ? value : null;
  }

  function parseMonth(value) {
    return typeof value === "string" && /^(?:[0-9]|1[01])$/.test(value.trim())
      ? Number(value.trim())
      : null;
  }

  function readStoredView() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || typeof raw !== "object") return { group: null, month: null };
      return {
        group: parseGroup(String(raw.group ?? "")),
        month: parseMonth(String(raw.month ?? ""))
      };
    } catch {
      return { group: null, month: null };
    }
  }

  function readUrlView() {
    const search = new URLSearchParams(window.location.search);
    return {
      group: parseGroup(search.get("group") || ""),
      month: parseMonth(search.get("month") || "")
    };
  }

  function resolveInitialView() {
    const stored = readStoredView();
    const fromUrl = readUrlView();
    return {
      group: fromUrl.group ?? stored.group ?? DEFAULTS.group,
      month: fromUrl.month ?? stored.month ?? DEFAULTS.month
    };
  }

  class MigrationLeafletAdapter {
    constructor(container) {
      this.container = container;
      this.map = null;
      this.migrationLayer = null;
    }

    init() {
      this.map = L.map(this.container, { zoomControl: true }).setView([38.5, -95.5], 4);
      this.map.attributionControl.setPrefix(false);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(this.map);
    }

    setMigration(migration, selectedId, onSelect) {
      if (this.migrationLayer) {
        this.map.removeLayer(this.migrationLayer);
        this.migrationLayer = null;
      }
      const layers = [];
      migration.corridors.forEach((corridor) => {
        const selected = corridor.id === selectedId;
        const latLngs = corridor.path.map((point) => [point.lat, point.lng]);
        const line = L.polyline(latLngs, {
          color: corridor.color,
          weight: selected ? corridor.width + 7 : corridor.width,
          opacity: selected ? 0.88 : 0.56,
          lineCap: "round",
          lineJoin: "round"
        }).bindPopup(MM.popup(corridor));
        line.on("click", () => onSelect(corridor.id));
        layers.push(line);
        const dot = L.circleMarker([corridor.anchor.lat, corridor.anchor.lng], {
          radius: selected ? 10 : 7,
          color: "#ffffff",
          weight: 2,
          fillColor: corridor.color,
          fillOpacity: selected ? 0.96 : 0.82
        }).bindPopup(MM.popup(corridor));
        dot.on("click", () => onSelect(corridor.id));
        layers.push(dot);
        for (const flow of MM.flowMarkers(corridor)) {
          const flowMarker = L.marker([flow.lat, flow.lng], {
            interactive: false,
            icon: L.divIcon({
              className: "",
              html: MM.flowMarkerHtml(flow),
              iconSize: [flow.size + 10, flow.size + 10],
              iconAnchor: [(flow.size + 10) / 2, (flow.size + 10) / 2]
            })
          });
          layers.push(flowMarker);
        }
      });
      this.migrationLayer = L.featureGroup(layers).addTo(this.map);
      this.map.fitBounds(this.migrationLayer.getBounds(), { padding: [36, 36] });
    }

    flyTo(point, minZoom) {
      this.map.flyTo([point.lat, point.lng], Math.max(this.map.getZoom(), minZoom), { duration: 0.6 });
    }
  }

  const mapAdapter = window.L ? new MigrationLeafletAdapter(document.querySelector("#map")) : null;
  if (mapAdapter) mapAdapter.init();

  let selectedId = null;

  const controller = MM.createController({
    elements: {
      group: els.group,
      month: els.month,
      monthLabel: els.monthLabel,
      phaseLabel: els.phaseLabel,
      play: els.play,
      timeline: els.timeline,
      resultContext: els.resultContext,
      resultsList: els.resultsList
    },
    getMapAdapter: () => mapAdapter,
    getSelectedId: () => selectedId,
    setSelectedId: (id) => {
      selectedId = id;
    },
    onControlsChanged: renderFromControls,
    onLayerChange: persistView,
    renderIcons: () => {
      if (window.lucide) window.lucide.createIcons();
    }
  });

  function renderFromControls() {
    selectedId = null;
    controller.render({
      migrationGroup: els.group.value,
      migrationMonth: Number(els.month.value)
    });
  }

  function persistView(layer) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ group: layer.groupKey, month: layer.monthValue }));
    } catch {
      // Storage unavailable (private mode, quota) - the view still works, it just isn't remembered.
    }
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("group", layer.groupKey);
    url.searchParams.set("month", String(layer.monthValue));
    window.history.replaceState(null, "", url);
  }

  function setPageStatus(message) {
    if (els.status) els.status.textContent = message;
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard copy failed");
  }

  els.shareButton?.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await copyTextToClipboard(url);
      setPageStatus("Link copied.");
    } catch {
      setPageStatus(`Copy this link: ${url}`);
    }
  });

  function reportDocumentCss() {
    return `
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; }
  .report { max-width: 760px; margin: 0 auto; padding: 28px 20px 60px; }
  h1 { font-size: 1.6rem; margin-bottom: 4px; }
  h2 { font-size: 1.15rem; margin-top: 28px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .report-sub { color: #6b7280; margin-top: 0; }
  .report-params { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .report-params dt { font-size: 0.78rem; text-transform: uppercase; color: #6b7280; }
  .report-params dd { margin: 2px 0 0; font-weight: 600; }
  .report-stop { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-top: 12px; }
  .report-stop h3 { margin: 0 0 4px; }
  .report-stop-meta { color: #6b7280; margin: 0 0 6px; font-size: 0.9rem; }
  .report-stop-reason { margin: 0; }
`;
  }

  els.downloadButton?.addEventListener("click", () => {
    const layer = controller.layer;
    const title = `Birdtrip Migration Map - ${MM.fileLabel(layer)}`;
    const documentHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</title>
  <style>${reportDocumentCss()}</style>
</head>
<body>
  <main class="report">
${MM.reportMarkup(layer)}
  </main>
</body>
</html>
`;
    const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `birdtrip-migration-${layer.groupKey}-${layer.month.label.toLowerCase()}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPageStatus("Report downloaded.");
  });

  const initial = resolveInitialView();
  els.group.value = initial.group;
  els.month.value = String(initial.month);
  controller.attach();
  renderFromControls();
  if (window.lucide) window.lucide.createIcons();
})();
```

Implementation notes:
- `MigrationLeafletAdapter.setMigration` is the body of `LeafletMapAdapter.setMigration` (`app.js:5545-5588`) minus the `this.clear()` call (there are no other layer types on this page) with `window.BirdtripMigrationMap` references shortened to `MM`.
- The `window.L` guard implements the spec's Leaflet-failure behavior: `controller.renderMap()` already early-returns on a null adapter (`migration-map.js:279`), so controls and cards stay live.
- `controller.layer` is always set before the download handler can run because `renderFromControls()` runs at startup.
- Precedence (spec): URL param → localStorage → default, per field, via `??` on the `null`-for-invalid parsers. No clamping.
- The storage key is `birdtripMigrationView` (the spec sketch said `birdtrip.migration`; this deliberately follows the repo's existing key convention, e.g. `birdtripSavedTrips`). Nothing else reads either key.
- `styles.css` has no `--border` custom property (it has `--accent-border`); the fallbacks in Task 3's CSS are therefore the effective values — that is intended.

- [ ] **Step 2: Lint and syntax-check**

Run: `node --check public/migration-app.js && npm run lint`
Expected: no output from `node --check`; lint passes. If eslint flags the empty `catch {}` block, add `// ignored` comments or adjust to match the repo's eslint config rather than disabling rules broadly.

- [ ] **Step 3: Commit**

```bash
git add public/migration-app.js
git commit -m "Add migration page bootstrap with live controls and guarded map init"
```

---

### Task 3: Add standalone-page styles to `styles.css`

**Files:**
- Modify: `public/styles.css` (append at end of file)

- [ ] **Step 1: Append the page layout styles**

The page reuses existing classes (`.app-header`, `.app-brand`, `.header-actions`, `.ghost-button`, `.results-header`, `.results-list`, `.migration-*`). Append only the layout scoped to `body.migration-page`:

```css
/* Standalone migration map page */
body.migration-page {
  margin: 0;
}

.migration-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}

.migration-brand-link {
  text-decoration: none;
  color: inherit;
}

.migration-page-status {
  font-size: 0.82rem;
  color: var(--muted, #6b7280);
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.migration-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 400px;
}

.migration-map-region {
  position: relative;
  min-height: 0;
}

.migration-map-region #map {
  position: absolute;
  inset: 0;
}

.migration-map-region .migration-timeline-bar {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 14px;
  z-index: 500;
}

.migration-results-region {
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
  border-left: 1px solid var(--border, #e5e7eb);
}

.migration-group-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.82rem;
}

.migration-group-picker select {
  min-width: 210px;
}

@media (max-width: 900px) {
  .migration-layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(320px, 48vh) 1fr;
  }

  .migration-results-region {
    border-left: none;
    border-top: 1px solid var(--border, #e5e7eb);
  }
}
```

Adjustment note for the implementer: check whether `styles.css` defines CSS custom properties (e.g. `--border`, `--muted`) near the top of the file; if it uses different variable names, use those instead of the fallbacks above. Also confirm `.app-header`, `.ghost-button`, `.results-header` render acceptably on the new page; if `.app-header` styling depends on a parent grid (e.g. `.app-shell`), copy the minimal needed rules into a `.migration-header` override rather than restructuring the shared rules.

- [ ] **Step 2: Visual smoke check**

Run: `node server.js` (background), open `http://localhost:<port>/migration.html` in a browser (use the `run` skill / screenshot tooling).
Expected: header, map filling the left column with the timeline bar overlaid at the bottom, results pane on the right with group picker; corridors drawn on load.

- [ ] **Step 3: Commit**

```bash
git add public/styles.css
git commit -m "Add layout styles for standalone migration page"
```

---

### Task 4: Simplify `migration-map.js` renderResults + provenance wording

**Files:**
- Modify: `public/migration-map.js:283-317` (`renderResults` head), `public/migration-map.js:315` (note copy), `public/migration-map.js:553` (report copy)

- [ ] **Step 1: Trim the trip-planner element writes**

In `renderResults`, replace lines 285–300 (from `const els = this.els;` through the `resultContext` assignment):

```js
    renderResults() {
      const layer = this.layer;
      if (!layer) return;
      const els = this.els;
      if (els.resultContext) {
        els.resultContext.textContent = `${layer.group.label}; ${layer.month.name}; ${layer.month.phase.toLowerCase()}.`;
      }
      if (!els.resultsList) return;
```

Deleted lines: the writes to `resultsTitle`, `resultLegend`, `itineraryBuilder`, `comparisonPanel`, `routeDistance`, `hotspotCount`, `notableCount`, `candidateCount`, `liferCount`, `targetCount`, `maxAdded`. Also delete the now-unused `directionShort` function (`migration-map.js:434-439`) — after this change nothing calls it (verify with `grep -n directionShort public/migration-map.js`).

- [ ] **Step 2: Update provenance wording (two strings)**

In the note block (line ~315), change:
`This annual timeline shows modeled macro patterns for the United States; it is not live radar and does not identify individual birds.`
to:
`This annual timeline shows illustrative generalized patterns for the United States; intensity values are relative, synthetic indicators, not measurements. It is not live radar and does not identify individual birds.`

In `reportMarkup` (line ~553), change:
`This is a modeled macro visualization, not live radar or species-level tracking.`
to:
`This is an illustrative generalized visualization; intensity values are relative, synthetic indicators, not measurements. It is not live radar or species-level tracking.`

- [ ] **Step 3: Lint, syntax-check, commit**

Run: `node --check public/migration-map.js && npm run lint`
Expected: pass.

```bash
git add public/migration-map.js
git commit -m "Trim trip-planner element writes and clarify data provenance wording"
```

Note: at this point the main app's migration mode still works (the stat tiles simply stay at their defaults); it is removed in Task 5–6.

---

### Task 5: `index.html` — Migration link, remove migration markup

**Files:**
- Modify: `public/index.html:67-84` (mode switch), `public/index.html:86-103` (migration controls — delete), `public/index.html:342-355` (timeline bar — delete), `public/index.html` bottom (script tag — delete)

- [ ] **Step 1: Convert the mode switch**

Replace the mode-switch block (lines 67–84) with:

```html
        <div class="mode-switch" role="group" aria-label="Birdtrip tools">
          <button type="button" id="routeModeButton" class="mode-switch-item is-active" data-mode="route" aria-pressed="true">
            <i data-lucide="route"></i>
            Route
          </button>
          <button type="button" id="areaModeButton" class="mode-switch-item" data-mode="area" aria-pressed="false">
            <i data-lucide="map"></i>
            Area
          </button>
          <button type="button" id="speciesModeButton" class="mode-switch-item" data-mode="species" aria-pressed="false">
            <i data-lucide="bird"></i>
            Species
          </button>
          <a id="migrationMapLink" class="mode-switch-item" href="./migration.html">
            <i data-lucide="waves"></i>
            Migration
          </a>
        </div>
```

- [ ] **Step 2: Delete migration markup and script**

- Delete the `#migrationControls` section (lines 86–103).
- Delete the `#migrationTimelineBar` block inside `.map-region` (lines 342–355).
- Delete the `<script src="./migration-map.js"></script>` tag near the end of the file.

- [ ] **Step 3: Update mode-switch CSS selectors**

In `public/styles.css`, update every `.mode-switch button` selector to `.mode-switch .mode-switch-item` at these sites: base rule (line ~188), `.mode-switch button.is-active` (~203), the two responsive blocks (~2794 with its `svg` child rule ~2801, and ~2929). Keep `.mode-switch button:disabled` (~209) targeting `button` (anchors can't be disabled). Add alongside the base rule:

```css
.mode-switch a.mode-switch-item {
  text-decoration: none;
  text-align: center;
}

.mode-switch a.mode-switch-item:focus-visible {
  outline: 2px solid var(--accent, #10b981);
  outline-offset: 1px;
}
```

(Confirm hover styling: if the existing base rule includes a `:hover` variant scoped to `button`, rescope it to `.mode-switch-item` too.)

- [ ] **Step 4: Verify in browser and commit**

Load `/`: the Migration entry looks like the sibling buttons (including hover/focus) and navigates to `migration.html`. Expect console errors at this point (app.js still references removed elements) — that is fixed in Task 6; only verify appearance/navigation here.

```bash
git add public/index.html public/styles.css
git commit -m "Replace migration mode with link to standalone page"
```

---

### Task 6: `app.js` — legacy redirect + full migration-mode removal

**Files:**
- Modify: `public/app.js` (sites listed below)

This is the largest task. Work top-to-bottom; the file must end with **zero** case-insensitive matches for `migration` (verified in Step 4).

- [ ] **Step 1: Add the redirect and remove migration from init**

At the top of `init()` (`app.js:237`), add as the **first statement**:

```js
function init() {
  if (redirectLegacyMigrationLink()) return;
  ...
```

Remove the `setupMigrationController();` call (line 244).

Add these self-contained helpers above `init()` (they intentionally do NOT use `normalizeMode`, `cleanSharedNumber`, or `window.BirdtripMigrationMap` — per spec the redirect must not depend on anything the cleanup removes, and must run before any other parsing):

```js
const MIGRATION_PAGE_GROUPS = ["all", "warblers", "waterfowl", "shorebirds", "raptors", "hummingbirds"];

function redirectLegacyMigrationLink() {
  const search = new URLSearchParams(window.location.search);
  if (search.get("bt") !== SHARE_URL_VERSION || search.get("mode") !== "migration") return false;
  const url = new URL("./migration.html", window.location.href);
  const group = search.get("migrationGroup");
  if (MIGRATION_PAGE_GROUPS.includes(group)) url.searchParams.set("group", group);
  const month = legacyMigrationMonth(search);
  if (month !== "") url.searchParams.set("month", month);
  window.location.replace(url);
  return true;
}

function legacyMigrationMonth(search) {
  const num = (value, min, max) => {
    if (value === null) return "";
    const number = clamp(Number(value), min, max);
    return Number.isFinite(number) ? String(number) : "";
  };
  const month = num(search.get("migrationMonth"), 0, 11);
  if (month !== "") return month;
  const legacySeason = search.get("migrationSeason");
  const legacyWeek = num(search.get("migrationWeek"), 0, 8);
  if (legacySeason === "fall") return legacyWeek === "" ? "8" : String(clamp(7 + Math.round(Number(legacyWeek) / 4), 7, 10));
  if (legacySeason === "spring") return legacyWeek === "" ? "3" : String(clamp(1 + Math.round(Number(legacyWeek) / 3), 1, 4));
  return "";
}
```

(`clamp` and `SHARE_URL_VERSION` are module-level and hoisted/initialized before `init()` runs at the file's end, so this is safe. `legacyMigrationMonth` reproduces `cleanSharedMigrationMonth` exactly, including its clamping — the spec's strict no-clamp rule applies to migration.html's own params, not the legacy redirect.)

- [ ] **Step 2: Remove migration-mode code, site by site**

Line numbers are pre-edit references; delete/edit these (re-grep as lines shift):

1. `state` (23–24): delete `migration: null,` and `selectedMigrationId: null,`.
2. `els` (58–66): delete the 9 `migration*` element entries — including `migrationModeButton` at line 58 (the button no longer exists after Task 5).
3. `PREF_FIELDS` (183–184): delete `"migrationGroup"`, `"migrationMonth"`.
4. Delete `let migrationController = null;` (187) and all of `setupMigrationController` (196–235).
5. `normalizeMode` (189–191): `return mode === "area" || mode === "species" ? mode : "route";`
6. `readSharedSearchFromUrl` (389–390): delete the `migrationGroup` and `migrationMonth` properties; (400): `return shared.origin ? shared : null;`
7. `applySharedSearch` (415–418): delete the migration branch.
8. Delete `cleanSharedMigrationMonth` (461–469) — replaced by `legacyMigrationMonth` in Step 1.
9. `setSearchMode` (527–587): delete `const isMigration = …` and every `isMigration` usage — the stopPlayback line (535), `els.migrationControls.hidden` (544), and simplify each ternary that branches on `isMigration` (545, 549, 552, 554–566) to its non-migration form; delete `els.migrationTimelineBar.hidden`, the `is-migration` class toggle, `migrationController.syncControls()` (568), and the migration progress-message branch (570–571). Also update line 580's condition to drop `|| state.migration`.
10. Saved-trip serialize (791–792): delete `migration` and `selectedMigrationId`.
11. Saved-trip restore (838–839, 850–851): delete the fields and the `renderMigrationMap()` branch.
12. Provider-switch preserve (1072–1073, 1098–1100): delete migration preservation.
13. Sample/clear (1128–1133): delete the migration branch.
14. `clearResults` (1191–1192): delete the two state resets; (1207–1208) and (1223–1224): drop the migration text branches.
15. `runSearch` (1244–1245): delete the migration branch (keep species/area/route).
16. Delete `runMigrationMap` (1510–1520), `renderMigrationMap` (1522–1524), `handleMigrationControlChange` (1526–1532).
17. `updateMapLegend` (1536–1540): delete the migration branch.
18. `readParams` (1704–1705): delete `migrationGroup` and `migrationMonth`.
19. `buildShareUrl` (1788, 1793–1796): `url.searchParams.set("origin", …)` unconditionally; delete the migration block.
20. `hasRunnableSearchInputs` (1809): delete the migration early-return.
21. `updateInputSummaries` (1875–1879): reduce both ternaries to their non-migration expressions.
22. Busy message (2150): drop the migration option from the nested ternary.
23. `renderComparison` (4105–4109): the guard becomes unnecessary — but it also handles `state.params?.mode`; simply delete the whole migration `if` block (the following `!state.results.length` check covers the empty case).
24. `renderInsights` (4545–4549): delete the migration branch.
25. `buildReportMarkup` (4959): delete the migration line; delete `buildMigrationReportMarkup` (5113–5115).
26. `buildStandaloneReportDocument` (5141): drop the `mode === "migration"` ternary arm.
27. `reportFileName` (5405–5418): drop both migration ternary arms.
28. `reportModeNoun` (5422): delete the migration line.
29. `hasReportableSearch` (5430): delete the migration line.
30. `LeafletMapAdapter`: delete `this.migrationLayer = null;` (5454), `setMigration` (5545–5588), and the migrationLayer block in `clear()` (5605–5608).
31. `GoogleMapAdapter`: delete `this.migrationLayers = [];` (5629), `setMigration` (5747–5799), and any `migrationLayers` cleanup in its `clear()` (read the remainder of `clear()` past line 5819 and remove the loop that unsets `migrationLayers`).

- [ ] **Step 3: Prune now-dead CSS**

In `public/styles.css` delete: both `.map-region.is-migration .map-glass` rules (~929 and a second occurrence inside a responsive block at ~2877) and the legend rules `.legend-line.migration` (~1146), `.legend-dot.migration-peak` (~1153), `.legend-dot.migration-stop` (~1157). Keep all other `.migration-*` rules — the standalone page uses them.

- [ ] **Step 4: Verify zero references, lint, commit**

Run: `grep -cin "migration" public/app.js public/index.html`
Expected: `public/app.js:0` and `public/index.html:1` (the single `migrationMapLink` anchor; `grep -in migration public/index.html` should show only that line — if the id was named without "migration" adjust accordingly).

(Amended during execution: the redirect helper introduced in Step 1 itself contains migration-named identifiers; the correct outcome is that all remaining matches are inside `redirectLegacyMigrationLink`/`legacyMigrationMonth`/`MIGRATION_PAGE_GROUPS`, and index.html's matches are the single anchor.)

Run: `node --check public/app.js && npm run lint`
Expected: pass.

Browser check: load `/`, exercise route mode with the sample button; switch area/species modes; no console errors.

```bash
git add public/app.js public/styles.css
git commit -m "Remove migration mode from main app; redirect legacy migration links"
```

---

### Task 7: Sitemap

**Files:**
- Modify: `public/sitemap.xml`

- [ ] **Step 1: Add the URL**

```xml
  <url>
    <loc>https://birdtrip.org/migration.html</loc>
  </url>
```

(inside `<urlset>`, after the existing `<url>` entry)

- [ ] **Step 2: Commit**

```bash
git add public/sitemap.xml
git commit -m "Add migration page to sitemap"
```

---

### Task 8: Full verification pass (spec's Testing/verification section)

**Files:** none (verification only). Use the `run` skill for browser automation/screenshots; `node server.js` serves `public/`.

- [ ] **Step 1: Lint** — `npm run lint` passes.
- [ ] **Step 2: On-load render** — `migration.html` shows corridors immediately (April, all migrants) with no interaction.
- [ ] **Step 3: Live controls** — group change, month scrub, month button click, Play/Pause all re-render; corridor card click selects + flies to the corridor; Share sets the "Link copied." status; Download HTML produces a self-contained report file.
- [ ] **Step 4: Main app** — Migration link styled like siblings, navigates to the page; route/area/species unaffected; no console errors (including no `BirdtripMigrationMap` references).
- [ ] **Step 5: Legacy links** —
  - `/?bt=1&mode=migration&migrationGroup=warblers&migrationMonth=8` → redirects to `migration.html?group=warblers&month=8`
  - `/?bt=1&mode=migration&migrationSeason=fall` → redirects with `month=8`
  - `/?bt=1&mode=migration` → redirects with no `month` param; page uses defaults
- [ ] **Step 6: Precedence & bad input** —
  - Set a group via UI (persists to localStorage), then open `migration.html?group=raptors` → raptors wins.
  - `migration.html?month=bad`, `?month=99`, `?group=owls` → invalid source ignored; falls through to localStorage/defaults (never January-by-clamping).
  - Corrupt localStorage (`localStorage.setItem("birdtripMigrationView", "{oops")`) → page loads with defaults, no errors.
- [ ] **Step 7: Leaflet guard** — block the Leaflet script (devtools request blocking, or temporarily point the script src at a bogus URL), reload `migration.html`: group picker, timeline, Play, and corridor cards all render and respond; no uncaught errors; map region empty.
- [ ] **Step 8: Layout** — screenshot desktop and a ~400px-wide viewport; map and results usable in both.
- [ ] **Step 9: Fix anything found, then final commit if changes were made.**
