# Birding ↔ Convenience Balance Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a five-position "Prioritize birding ↔ Less driving" control that re-ranks search results instantly, per `docs/superpowers/specs/2026-08-10-birding-convenience-slider-design.md`.

**Architecture:** All client logic lives in the single non-module script `public/app.js` (~5200 lines); markup in `public/index.html`, styles in `public/styles.css`. Scoring gains four per-candidate values (`siteQuality`, `birdPoints`, `rankUtility`, display `score` 0–100). Searches keep a full `state.candidatePool`; the visible list is always derived from it. A `state.balance` index (0–4) maps to `convMult` ∈ {0, 0.5, 1, 2, 5}; default index 2 reproduces today's ranking.

**Tech Stack:** Vanilla JS browser script, Node ≥18 server (`server.js`), ESLint. Tests: `@playwright/test` (new devDependency) with `page.route()` fixtures stubbing `/api/geocode` and `/api/ebird/*` — the real eBird API is never called.

**Read the spec first.** Every decision below traces to it. Line numbers reference the state of `public/app.js` at commit `b1e6e3b` and will drift as you edit — verify context with grep before each edit.

---

## Key existing code map (verify before editing)

| What | Where |
|---|---|
| `scoreCandidates` + weighting helpers | `public/app.js:3574-3649` |
| `SCORE_COMPONENTS`, `scoreComponents`, `scoreScale`, `scoreTooltip`, `scoreRow` | `public/app.js:4451-4510` |
| `isHotspot` | `public/app.js:4683` |
| Route search results truncation | `public/app.js:1281-1295` |
| Area search results truncation | `public/app.js:1335-1354` |
| `selectNotableCandidates` (route notable pool) | `public/app.js:3514-3521` |
| `renderResultsIfPresent`, `applyLifeListToCurrentResults` | `public/app.js:1922-1951` |
| `pinnedStops`/`isPinned`/`togglePinned` | `public/app.js:3666-3690` |
| `selectCandidate` | `public/app.js:4186` |
| `renderResults` | `public/app.js:4054` |
| Shared URL read/build | `public/app.js:344-399`, `1677-1698` |
| Trip settings read/apply, candidate (de)serialization | `public/app.js:684-755`, `757+`, `820-863` |
| Search Settings form group / results header | `public/index.html:139-174`, `public/index.html:286-308` |
| Mode-dependent field visibility (`maxDetourField`) | `public/app.js:501` |
| Event wiring block | `public/app.js:233-304` |

---

### Task 1: Playwright infrastructure and fixture harness

**Files:**
- Modify: `package.json` (add devDependency + `test` script)
- Create: `playwright.config.js`
- Create: `tests/fixtures.js`
- Create: `tests/area-search.spec.js`

- [ ] **Step 1: Install Playwright**

```bash
npm install --save-dev @playwright/test
```

Add to `package.json` scripts: `"test": "playwright test"`.

- [ ] **Step 2: Check the server's port and start command**

Run: `grep -n "PORT\|listen" server.js | head`. Use the discovered port (call it `PORT`) in the config below.

- [ ] **Step 3: Create `playwright.config.js`**

```js
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:PORT" },
  webServer: {
    command: "node server.js",
    port: PORT,
    reuseExistingServer: true
  }
});
```

- [ ] **Step 4: Create `tests/fixtures.js`**

The fixture encodes the hand-designed area scenario from the spec discussion. All observations are same-day so every freshness weight is exactly 1 and scores are exact arithmetic. One observation per species, so `activity = 0.06 × n`. With no targets and no life list: `birdPoints = 0.5n + 0.06n + 2.5 × notableCount = 0.56n + 2.5 × nb` and `convenience points = 20 × (1 − d/25)`.

**Critical constraint the geometry encodes:** area-mode notables are attributed *by distance*, not locId — every feed observation within `min(radiusKm, 10) = 10 km` of a candidate counts for it (`addAreaNotableObservations`, `public/app.js:3562-3568`). Route mode requests notables per candidate with a `dist` query param. So: only the three far reserves carry notables, and they sit pairwise >10 km apart (east / west / north); the city parks carry none and are >17 km from any notable. Each candidate therefore collects exactly its own notables in both modes. Do not move hotspots or add notables without rechecking pairwise distances.

| id | name | direction, d (km) | species n | notables | birdPoints (0.56n + 2.5nb) | conv pts | utility @ convMult=1 |
|---|---|---|---|---|---|---|---|
| L1 | City Park Alpha | east 2 | 78 | 0 | 43.68 | 18.4 | 62.08 |
| L2 | City Park Beta | south 3 | 72 | 0 | 40.32 | 17.6 | 57.92 |
| L3 | City Park Gamma | west 2.5 | 75 | 0 | 42.00 | 18.0 | 60.00 |
| L4 | Harbor Park | north 1.5 | 70 | 0 | 39.20 | 18.8 | 58.00 |
| L5 | Near Pond | east 1 | 20 | 0 | 11.20 | 19.2 | 30.40 |
| L6 | Wetland Reserve North | east 20 | 84 | 2 | 47.04 + 5 = 52.04 | 4.0 | 56.04 |
| L7 | Wetland Reserve South | west 21 | 64 | 1 | 35.84 + 2.5 = 38.34 | 3.2 | 41.54 |
| L8 | Far Rich Reserve | north 24.5 | 85 | 3 | 47.60 + 7.5 = 55.10 | 0.4 | 55.50 |

Expected orders (maxStops = 5):
- **Default (convMult 1):** L1 62.08, L3 60.00, L4 58.00, L2 57.92, L6 56.04 — L8 (55.50) is #6, outside the visible list. Note the L4-vs-L2 margin is only 0.08 utility points — deliberate, it exercises unrounded sorting.
- **Prioritize birding (convMult 0, birdPoints only):** L8 55.10, L6 52.04, L1 43.68, L3 42.00, L2 40.32 — L8 enters and is #1.
- **Less driving (convMult 5):** L1 135.68, L4 133.20, L3 132.00, L2 128.32, L5 107.20 — all city stops; average distance drops. (L6 72.04, L8 57.10, L7 54.34.)

Do not "round off" fixture numbers; re-derive all three orderings if you change any row.

```js
const CENTER = { lat: 41.4, lng: 2.1 };
const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LNG = 111.32 * Math.cos((41.4 * Math.PI) / 180); // ≈ 83.5

// eastKm/northKm may be negative (west/south).
function kmOffset(eastKm, northKm) {
  return { lat: CENTER.lat + northKm / KM_PER_DEG_LAT, lng: CENTER.lng + eastKm / KM_PER_DEG_LNG };
}

function haversineKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 09:00`;
}

const HOTSPOTS = [
  { locId: "L1", name: "City Park Alpha", east: 2, north: 0, species: 78, notables: 0 },
  { locId: "L2", name: "City Park Beta", east: 0, north: -3, species: 72, notables: 0 },
  { locId: "L3", name: "City Park Gamma", east: -2.5, north: 0, species: 75, notables: 0 },
  { locId: "L4", name: "Harbor Park", east: 0, north: 1.5, species: 70, notables: 0 },
  { locId: "L5", name: "Near Pond", east: 1, north: 0, species: 20, notables: 0 },
  { locId: "L6", name: "Wetland Reserve North", east: 20, north: 0, species: 84, notables: 2 },
  { locId: "L7", name: "Wetland Reserve South", east: -21, north: 0, species: 64, notables: 1 },
  { locId: "L8", name: "Far Rich Reserve", east: 0, north: 24.5, species: 85, notables: 3 }
];

function positionOf(h) {
  return kmOffset(h.east, h.north);
}

function hotspotList() {
  return HOTSPOTS.map((h) => ({ ...positionOf(h), locId: h.locId, locName: h.name, numSpeciesAllTime: h.species }));
}

function recentFor(locId) {
  const h = HOTSPOTS.find((x) => x.locId === locId);
  const pos = positionOf(h);
  return Array.from({ length: h.species }, (_, i) => ({
    comName: `${h.name} Species ${i + 1}`,
    sciName: `Fixturus ${h.locId.toLowerCase()}${i + 1}`,
    locId: h.locId,
    locName: h.name,
    obsDt: today(),
    howMany: 1,
    lat: pos.lat,
    lng: pos.lng
  }));
}

function allNotables() {
  return HOTSPOTS.flatMap((h) => {
    const pos = positionOf(h);
    return Array.from({ length: h.notables }, (_, i) => ({
      comName: `${h.name} Notable ${i + 1}`,
      sciName: `Rarus ${h.locId.toLowerCase()}${i + 1}`,
      locId: h.locId,
      locName: h.name,
      obsDt: today(),
      howMany: 1,
      lat: pos.lat,
      lng: pos.lng
    }));
  });
}

const GEOCODE = [{ lat: CENTER.lat, lng: CENTER.lng, name: "Test Center, Barcelona" }];

async function stubApis(page) {
  await page.route("**/api/geocode**", (route) => route.fulfill({ json: GEOCODE }));
  await page.route("**/api/ebird/hotspots**", (route) => route.fulfill({ json: hotspotList() }));
  await page.route("**/api/ebird/hotspot-recent**", (route) => {
    const url = new URL(route.request().url());
    route.fulfill({ json: recentFor(url.searchParams.get("locId")) });
  });
  await page.route("**/api/ebird/notable**", (route) => {
    // Honor the request's lat/lng/dist exactly as the real eBird API would.
    // Route mode assigns the raw response per candidate with NO client-side
    // distance filter (fetchNotablesPerCandidate, app.js:3529), so an
    // unfiltered stub would give every candidate all notables.
    const url = new URL(route.request().url());
    const at = { lat: Number(url.searchParams.get("lat")), lng: Number(url.searchParams.get("lng")) };
    const dist = Number(url.searchParams.get("dist")) || 10;
    route.fulfill({ json: allNotables().filter((obs) => haversineKm(at, obs) <= dist) });
  });
  await page.route("**/api/ebird/**", (route) => route.fulfill({ json: [] })); // any other eBird call
}

module.exports = { stubApis, HOTSPOTS, CENTER };
```

Check the exact geocode response shape the client expects (`geocodeField`, `public/app.js:2208-2230`) and the hotspot list shape (`rankAreaHotspots`, `public/app.js:3256`) — adjust `GEOCODE`/`hotspotList()` fields to match what the code reads (e.g. `name` vs `displayName`, `locName`). The area-mode notable feed is requested from the center with `feedDistKm = 35 ≥ 24.5 + 10`, so the distance-filtered stub returns all 6 notables for that request and area attribution happens client-side at `app.js:3562-3568`.

- [ ] **Step 5: Write the smoke test (`tests/area-search.spec.js`)**

The app requires an eBird token before searching (`shouldAttemptEbirdSearch`). Set it through the settings UI so the test doesn't depend on storage internals — find the modal controls (`els.settingsButton`, `els.apiToken` — `#settingsButton`, `#apiToken` in `index.html`).

```js
const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");

async function runAreaSearch(page, { maxStops = 5 } = {}) {
  await stubApis(page);
  await page.goto("/");
  await page.click("#settingsButton");
  await page.fill("#apiToken", "TEST_TOKEN");
  await page.keyboard.press("Escape");
  await page.click('[data-mode="area"]');
  await page.fill("#origin", "Test Center, Barcelona");
  await page.fill("#maxStops", String(maxStops));
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(maxStops, { timeout: 15000 });
}

function visibleOrder(page) {
  return page.locator(".stop-card .stop-name").allTextContents();
}

test("area search renders ranked stops from fixtures", async ({ page }) => {
  await runAreaSearch(page);
  const names = await visibleOrder(page);
  expect(names).toHaveLength(5);
});

module.exports = { runAreaSearch, visibleOrder };
```

Adapt selectors to reality: check `index.html` for the mode buttons (`data-mode` attributes near the form top), how the settings modal closes, and whether geocoding uses autocomplete selection rather than plain fill (see `geocodeField` — a plain value plus submit resolves via `/api/geocode`, which is stubbed). Debug with `npx playwright test --headed` if the search stalls.

- [ ] **Step 6: Run the test, verify it passes**

Run: `npx playwright test tests/area-search.spec.js`
Expected: PASS (this validates the harness itself; ordering assertions come later).

- [ ] **Step 7: Run lint, then commit**

```bash
npm run lint
git add package.json package-lock.json playwright.config.js tests/
git commit -m "Add Playwright test harness with stubbed eBird fixtures"
```

---

### Task 2: Target-normalization prerequisite fix

**Files:**
- Modify: `public/app.js:3583` (inside `scoreCandidates`)
- Test: `tests/area-search.spec.js`

- [ ] **Step 1: Write the failing test**

A 1-target search should be able to earn the full 15 target points. Add to the spec file (uses the score-pill tooltip, which today reads `Score N of M — … Targets x/15 …`):

```js
test("single-target search earns full target points", async ({ page }) => {
  await stubApis(page);
  await page.goto("/");
  await page.click("#settingsButton");
  await page.fill("#apiToken", "TEST_TOKEN");
  await page.keyboard.press("Escape");
  await page.click('[data-mode="area"]');
  await page.fill("#origin", "Test Center, Barcelona");
  await page.fill("#maxStops", "5");
  // Target a species that exists at Far Rich Reserve (L8) only:
  await page.locator("#targetRows input").first().fill("Far Rich Reserve Species 1");
  await page.keyboard.press("Enter");
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card").first()).toBeVisible({ timeout: 15000 });
  const tooltips = await page.locator(".score-pill").evaluateAll((els) => els.map((e) => e.title));
  expect(tooltips.some((t) => /Targets 15(\.0)?\/15/.test(t))).toBe(true);
});
```

Verify how target rows are actually entered (`#targetRows`, `serializeTargetRows` around `public/app.js:2729-2735`) and adjust the fill/Enter interaction.

- [ ] **Step 2: Run it, verify it fails**

Run: `npx playwright test -g "single-target"`
Expected: FAIL — with the fixed `/5` denominator a single fresh match yields `Targets 3.0/15`.

- [ ] **Step 3: Implement the fix**

In `scoreCandidates`, replace the `targetScore` line:

```js
const targetSlots = Math.min(params.targets.length, 5);
const targetScore = targetSlots
  ? Math.min(weightedTargets, targetSlots) / targetSlots * 15
  : 0;
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx playwright test`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add public/app.js tests/
git commit -m "Normalize target score to requested target count"
```

---

### Task 3: Score concepts — siteQuality, birdPoints, applyBalance, display score

This task changes scoring/display only; ranking still passes through the old path, and `convMult` is fixed at 1 until Task 5.

**Files:**
- Modify: `public/app.js` — `scoreCandidates`, new `applyBalance`, `isHotspot`, `scoreScale`/`scoreTooltip`, sorts at route/area search + `applyLifeListToCurrentResults`, candidate (de)serialization
- Test: `tests/area-search.spec.js`

- [ ] **Step 1: Write the failing ordering test**

```js
test("default ordering matches the balanced baseline", async ({ page }) => {
  await runAreaSearch(page);
  expect(await visibleOrder(page)).toEqual([
    "City Park Alpha",
    "City Park Gamma",
    "Harbor Park",
    "City Park Beta",
    "Wetland Reserve North"
  ]);
});

test("scores display on a 0-100 scale", async ({ page }) => {
  await runAreaSearch(page);
  const title = await page.locator(".score-pill").first().getAttribute("title");
  expect(title).toMatch(/Overall \d+ of 100/);
  expect(title).toMatch(/Birding \d+\/100/);
  expect(title).toMatch(/Convenience \d+\/100/);
  expect(title).toMatch(/Preference: Recommended/);
});
```

Run: `npx playwright test -g "baseline|0-100"` — the ordering test may already pass (same formula); the display test must FAIL.

- [ ] **Step 2: Add balance constants near `PREF_FIELDS` (`public/app.js:163`)**

```js
const BALANCE_LEVELS = [
  { convMult: 0, label: "Prioritize birding" },
  { convMult: 0.5, label: "Leaning birding" },
  { convMult: 1, label: "Recommended" },
  { convMult: 2, label: "Leaning convenience" },
  { convMult: 5, label: "Less driving" }
];
const DEFAULT_BALANCE = 2;
```

Add to the `state` object initializer: `balance: DEFAULT_BALANCE`, `candidatePool: []`, `balanceLocked: false`.

- [ ] **Step 3: Extend `scoreCandidates` and add `applyBalance`**

At the end of the per-candidate loop in `scoreCandidates` (after `scoreParts` is set), replace the final `candidate.score = …` line with:

```js
    candidate.siteQuality = Math.round((speciesScore + activityScore + notableScore) / 80 * 100);
    candidate.birdPoints = speciesScore + activityScore + notableScore + targetScore + liferScore;
    candidate.birdMax = params.lifeList?.size ? 113 : 95;
  }
  applyBalance(candidates);
}

function applyBalance(candidates, balanceIndex = state.balance) {
  const level = BALANCE_LEVELS[balanceIndex] || BALANCE_LEVELS[DEFAULT_BALANCE];
  for (const candidate of candidates) {
    const practicality = Number(candidate.scoreParts?.practicality) || 0;
    candidate.rankUtility = candidate.birdPoints + level.convMult * practicality;
    candidate.score = Math.round(candidate.rankUtility / (candidate.birdMax + level.convMult * 20) * 100);
  }
}

function compareByRankUtility(a, b) {
  return (b.rankUtility - a.rankUtility) || String(a.id).localeCompare(String(b.id));
}
```

- [ ] **Step 4: Switch every ranking sort to `compareByRankUtility`**

Replace `.sort((a, b) => b.score - a.score)` at the route search (`~1287`), area search (`~1346`), and `applyLifeListToCurrentResults` (`~1950`) with `.sort(compareByRankUtility)`. Also check `compareBirdingRouteValue` (`public/app.js:3923`) — its first clause `b.score - a.score` becomes `b.rankUtility - a.rankUtility`.

- [ ] **Step 5: Reclassify hotspots on `siteQuality`**

```js
function isHotspot(candidate) {
  return siteQualityOf(candidate) >= 55 || candidate.species.size >= 40;
}

function siteQualityOf(candidate) {
  if (Number.isFinite(candidate.siteQuality)) return candidate.siteQuality;
  const parts = candidate.scoreParts || {};
  const raw = (Number(parts.species) || 0) + (Number(parts.activity) || 0) + (Number(parts.notable) || 0);
  return Math.round(raw / 80 * 100);
}
```

The fallback covers restored saved trips, whose candidates carry `scoreParts` but not the new fields.

- [ ] **Step 6: Rebuild derived fields when restoring candidates**

In the candidate-restore normalizer (`public/app.js:820-863`, where `scoreParts` defaults are filled), after `scoreParts` is resolved add:

```js
  const parts = normalized.scoreParts;
  normalized.siteQuality = Math.round(((parts.species || 0) + (parts.activity || 0) + (parts.notable || 0)) / 80 * 100);
  normalized.birdPoints = (parts.species || 0) + (parts.activity || 0) + (parts.notable || 0) + (parts.targets || 0) + (parts.lifers || 0);
  normalized.birdMax = (typeof candidate.scoredWithLifeList === "boolean" ? candidate.scoredWithLifeList : (parts.lifers || 0) > 0) ? 113 : 95;
```

(Adapt the variable names to that function's actual local names.) Then have the restore path call `applyBalance(restoredCandidates, restoredBalanceIndex)` — for now pass `DEFAULT_BALANCE`; Task 7 threads the stored balance through. Also add `siteQuality`, `birdPoints`, `birdMax` to `serializeCandidate` (`public/app.js:735`) so future saves round-trip exactly.

- [ ] **Step 7: Replace the score tooltip headline**

Replace `scoreScale` + `scoreTooltip` (`public/app.js:4470-4494`) with:

```js
function scoreTooltip(candidate, isArea) {
  const birdPct = Math.round((candidate.birdPoints / candidate.birdMax) * 100);
  const convPct = Math.round(((Number(candidate.scoreParts?.practicality) || 0) / 20) * 100);
  const level = BALANCE_LEVELS[state.balance] || BALANCE_LEVELS[DEFAULT_BALANCE];
  const breakdown = scoreComponents(candidate, isArea)
    .filter((part) => part.key !== "lifers" || part.value > 0)
    .map((part) => `${part.label} ${part.value.toFixed(1)}/${part.max}`)
    .join(", ");
  return `Overall ${candidate.score} of 100 — Birding ${birdPct}/100, Convenience ${convPct}/100, Preference: ${level.label} — ${breakdown}`;
}
```

Update every `scoreTooltip(...)`/`scoreScale(...)` caller — grep both names; expect the results list (`~4093`), the details panel, map popups, and the report. Delete `scoreScale` and its comment block once no callers remain. Where the UI prints `of ${scale.max}`, print `of 100`. Keep the raw `scoreRow` bars as they are.

- [ ] **Step 8: Run the full suite and lint**

Run: `npx playwright test && npm run lint`
Expected: all PASS. The ordering test guards against regressions introduced here.

- [ ] **Step 9: Commit**

```bash
git add public/app.js tests/
git commit -m "Split scoring into siteQuality, birdPoints, and balance-weighted rank utility"
```

---

### Task 4: Candidate pool and derived visible results

Behavior-preserving at default balance; the pool exists so re-ranking can admit outside candidates.

**Files:**
- Modify: `public/app.js` — route/area search endings, `selectNotableCandidates`, new `deriveVisibleResults`, `applyLifeListToCurrentResults`, `selectCandidate`, `pinnedStops`, `togglePinned`, `clearResults`

- [ ] **Step 1: Add `deriveVisibleResults` and `candidateById`**

```js
function deriveVisibleResults() {
  applyBalance(state.candidatePool);
  const maxStops = Number.isFinite(state.params?.maxStops)
    ? state.params.maxStops
    : clamp(Number(els.maxStops.value || 10), 3, 20);
  state.results = [...state.candidatePool].sort(compareByRankUtility).slice(0, maxStops);
}

function candidateById(id) {
  return state.candidatePool.find((item) => item.id === id)
    || state.results.find((item) => item.id === id)
    || null;
}
```

- [ ] **Step 2: Area search keeps the whole evaluated pool**

At `public/app.js:1345-1347` replace the truncation with:

```js
  state.balanceLocked = false;
  state.candidatePool = practical;
  deriveVisibleResults();
```

- [ ] **Step 3: Route search pool = bounded, fully-notable-fetched set**

Widen `selectNotableCandidates`'s bound from `Math.max(params.maxStops, 6)` to `Math.max(params.maxStops * 2, 12)`. Then at `public/app.js:1281-1288`, filter by detour budget *before* notable fetching so the pool only contains eligible candidates, and keep the fetched set as the pool:

```js
  const eligible = practical.filter((candidate) => candidate.addedMinutes <= params.maxDetour);
  const pool = selectNotableCandidates(eligible, params);
  setStatus("Adding notable birds", "Checking recent notable reports for the strongest candidates.");
  await fetchNotablesPerCandidate(pool, params);
  scoreCandidates(pool, params);
  state.balanceLocked = false;
  state.candidatePool = pool;
  deriveVisibleResults();
```

`addNotableObservations` (`3506-3512`) is then only called from the area path — simplify accordingly (area keeps `addAreaNotableObservations`). `eligible` relies on `practical` arriving in `preliminaryScore` order from `buildCandidates` — confirm no intermediate sort disturbs it. Note: `evaluateDetours` (`~3494`) already drops candidates over `maxDetour` when building `practical`, so the `addedMinutes` filter here (like the old one at 1286) is belt-and-suspenders — keep it or drop it after confirming, but don't build logic that depends on over-budget candidates being present.

- [ ] **Step 4: Pool-aware lookups**

- `selectCandidate` (`4186`): `const candidate = candidateById(id);`
- `togglePinned` (`3680`): same replacement.
- `pinnedStops` (`3666`): build `byId` from `state.candidatePool.length ? state.candidatePool : state.results` so out-of-rank pins survive.
- `renderResultsIfPresent` (`1932`): selected-candidate lookup via `candidateById`.

- [ ] **Step 5: Life-list upload re-scores the pool**

Rewrite `applyLifeListToCurrentResults` (`1937-1951`):

```js
function applyLifeListToCurrentResults() {
  const pool = state.candidatePool.length ? state.candidatePool : state.results;
  if (!pool.length) return;
  const params = {
    ...(state.params || {}),
    maxDetour: state.params?.maxDetour ?? clamp(Number(els.maxDetour.value || 60), 0, 240),
    lifeList: new Set(state.lifeList.species)
  };
  for (const candidate of pool) {
    candidate.liferSpecies = params.lifeList.size
      ? Array.from(candidate.species.values()).filter((obs) => !isSeenObservation(obs, params.lifeList))
      : [];
  }
  scoreCandidates(pool, params);
  if (state.candidatePool.length) {
    deriveVisibleResults();
  } else {
    state.results.sort(compareByRankUtility);
  }
}
```

- [ ] **Step 6: Reset the pool on clear**

In `clearResults` (grep for it), add `state.candidatePool = [];` and `state.balanceLocked = false;` wherever `state.results` is reset.

- [ ] **Step 7: Run suite + lint, commit**

Run: `npx playwright test && npm run lint` — all PASS (no visible behavior change at default).

```bash
git add public/app.js
git commit -m "Keep full scored candidate pool and derive visible results from it"
```

---

### Task 5: The balance control — markup, wiring, URL, live re-rank

**Files:**
- Modify: `public/index.html` (two control instances), `public/styles.css`, `public/app.js` (els, wiring, `setBalance`, mode visibility, share URL)
- Test: `tests/balance-slider.spec.js` (new)

- [ ] **Step 1: Write the failing tests (`tests/balance-slider.spec.js`)**

```js
const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");
const { runAreaSearch, visibleOrder } = require("./area-search.spec.js");

test("prioritize-birding admits Far Rich Reserve at #1", async ({ page }) => {
  await runAreaSearch(page);
  await page.locator("#balanceSliderResults").fill("0");
  const names = await visibleOrder(page);
  expect(names[0]).toBe("Far Rich Reserve");
  expect(names).toContain("Wetland Reserve North");
});

test("less-driving keeps only nearby stops", async ({ page }) => {
  await runAreaSearch(page);
  await page.locator("#balanceSliderResults").fill("4");
  // Utilities at convMult 5: L1 135.68, L4 133.20, L3 132.00, L2 128.32, L5 107.20.
  expect(await visibleOrder(page)).toEqual([
    "City Park Alpha", "Harbor Park", "City Park Gamma", "City Park Beta", "Near Pond"
  ]);
});

test("both controls and the URL stay synchronized", async ({ page }) => {
  await runAreaSearch(page);
  await page.locator("#balanceSlider").fill("0");
  await expect(page.locator("#balanceSliderResults")).toHaveValue("0");
  // Default position omits the param; non-default sets it.
  await page.click("#shareTripButton").catch(() => {});
  expect(page.url()).toContain("balance=0");
  await page.locator("#balanceSliderResults").fill("2");
  await expect(page.locator("#balanceSlider")).toHaveValue("2");
});

test("shared URL restores the balance position", async ({ page }) => {
  await stubApis(page);
  await page.goto("/?bt=1&mode=area&origin=Test+Center%2C+Barcelona&maxStops=5&balance=0&run=1");
  await page.click("#settingsButton");
  await page.fill("#apiToken", "TEST_TOKEN");
  await page.keyboard.press("Escape");
  // May need to re-submit after token entry; follow the app's shared-autorun flow.
  await expect(page.locator(".stop-card .stop-name").first()).toHaveText("Far Rich Reserve", { timeout: 15000 });
});
```

Notes: `page.locator(...).fill()` on a range input sets value + fires events in Playwright ≥1.38; if it doesn't trigger `input`, use `el.evaluate` to set value and dispatch `new Event("input", { bubbles: true })`. The URL sync assertion depends on when the app rewrites the URL (`refreshSharedUrlIfPresent` only rewrites when `bt=1` is present) — align the test with actual behavior after reading `updateSharedUrlFromCurrentInputs` callers; asserting on `buildShareUrl` output via the Share button's clipboard is an alternative.

Run: `npx playwright test tests/balance-slider.spec.js` — FAIL (controls don't exist).

- [ ] **Step 2: Markup**

In `index.html`, append inside the Search Settings `form-group` (after the `control-grid`, `~line 173`):

```html
<div class="balance-field" id="balanceField">
  <div class="balance-labels" aria-hidden="true">
    <span>Prioritize birding</span>
    <span>Less driving</span>
  </div>
  <input id="balanceSlider" type="range" min="0" max="4" step="1" value="2"
         aria-label="Ranking preference: prioritize birding versus less driving">
  <small class="field-hint" id="balanceHint">Recommended</small>
</div>
```

In the results header (`~line 287`), inside `.results-header` after the legend:

```html
<div class="balance-field balance-field-results" id="balanceFieldResults" hidden>
  <div class="balance-labels" aria-hidden="true">
    <span>Prioritize birding</span>
    <span>Less driving</span>
  </div>
  <input id="balanceSliderResults" type="range" min="0" max="4" step="1" value="2"
         aria-label="Ranking preference: prioritize birding versus less driving">
  <small class="field-hint" id="balanceHintResults">Recommended</small>
</div>
```

- [ ] **Step 3: Styles**

Add a `.balance-field` block to `public/styles.css` following the file's existing custom-property conventions (check how `.number-field`/`.field-hint` are styled and match): labels row as small muted text with `display:flex; justify-content:space-between`, full-width range input, compact variant for `.balance-field-results`. Style `input:disabled` at reduced opacity for the locked state.

- [ ] **Step 4: Wiring in `app.js`**

Add to `els`: `balanceField`, `balanceSlider`, `balanceHint`, `balanceFieldResults`, `balanceSliderResults`, `balanceHintResults`.

```js
function setBalance(index, options = {}) {
  const next = clamp(Math.round(Number(index)), 0, BALANCE_LEVELS.length - 1);
  state.balance = Number.isFinite(next) ? next : DEFAULT_BALANCE;
  syncBalanceControls();
  if (options.skipRerank || state.balanceLocked || !state.candidatePool.length) return;
  deriveVisibleResults();
  renderResults();
  renderMarkers();
  renderReport();
  refreshSharedUrlIfPresent();
}

function syncBalanceControls() {
  const level = BALANCE_LEVELS[state.balance];
  for (const [slider, hint] of [[els.balanceSlider, els.balanceHint], [els.balanceSliderResults, els.balanceHintResults]]) {
    if (!slider) continue;
    slider.value = String(state.balance);
    slider.disabled = state.balanceLocked;
    hint.textContent = state.balanceLocked
      ? "Saved trips keep their original ranking."
      : level.label;
  }
  els.balanceFieldResults.hidden = state.mode === "species" || !state.results.length;
}
```

Event wiring (in the block at `~233-304`):

```js
els.balanceSlider.addEventListener("input", () => setBalance(els.balanceSlider.value));
els.balanceSliderResults.addEventListener("input", () => setBalance(els.balanceSliderResults.value));
```

Call `syncBalanceControls()` at the end of `renderResults` and inside `setSearchMode` next to the `maxDetourField` toggle (`~501`), adding `els.balanceField.hidden = state.mode === "species";` there too.

- [ ] **Step 5: Share URL round-trip**

- `buildShareUrl` (`1677`): `if (state.balance !== DEFAULT_BALANCE) url.searchParams.set("balance", String(state.balance));`
- Shared-search reader (`~344-368`): add `balance: search.has("balance") ? cleanSharedNumber(search.get("balance"), 0, 4) : null` — read `cleanSharedNumber` first; if it can return `null`/`0` ambiguously, parse with `Number` + `clamp` and `Number.isFinite` instead, so position 0 survives.
- `applySharedSearch` (`371`): `setBalance(shared.balance ?? DEFAULT_BALANCE, { skipRerank: true });`

- [ ] **Step 6: Run all tests + lint**

Run: `npx playwright test && npm run lint`
Expected: all PASS, including Task 3's baseline test (default unchanged) and the new slider tests.

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/styles.css public/app.js tests/
git commit -m "Add mirrored birding-vs-convenience balance control with live re-ranking"
```

---### Task 6: Out-of-rank pinned stops (route mode)

Pins exist only in route mode (`applyPendingSharedPins` bails for area, `public/app.js:1615`; the itinerary builder is route-only). Route searches need their own fixture.

**Files:**
- Modify: `public/app.js` (`renderResults` pinned section, marker set), `tests/fixtures.js` (route stubs), `public/styles.css`
- Test: `tests/route-pins.spec.js` (new)

- [ ] **Step 1: Discover the route-mode network calls**

Run: `grep -n "api/route\|api/directions\|osrm\|route(" server.js public/app.js | head -20` and read `runRouteSearch` (`1229+`) to list every endpoint a route search hits (geocode ×2, routing, hotspots per corridor sample, recent observations per sample, notable per candidate). Extend `stubApis` in `tests/fixtures.js` with a straight west→east route whose corridor passes the same 8 fixture hotspots. Two requirements:

- **Detours must be proportional to area distance, not uniform.** Route practicality is `20·(1 − addedMinutes/maxDetour)` (`app.js:3591`); uniform detours would give every candidate identical practicality and collapse the ranking to pure birdPoints at every slider position — Harbor Park would never render at #3 and the pin test below could not even start. Make the routing/detour stub yield `addedMinutes_i = maxDetour × d_i / 25` for each fixture site (read `evaluateDetours`, `app.js:3483`, to see what response shape produces that). Route practicality then exactly reproduces the area conv-points column, and the fixture table's orderings carry over unchanged.
- Route mode also fetches recent observations per corridor sample via `/api/ebird/recent` (`fetchRecentForSamples`, `app.js:3234`, called at `~1261`) — the current catch-all returns `[]`, which yields zero candidates. Stub it to return all fixture observations unfiltered; the `obsKey` dedupe (`app.js:3417-3421`) collapses duplicates across samples, so no distance filtering is needed there.

This step is investigation-heavy; budget for iteration with `--headed`.

- [ ] **Step 2: Write the failing test (`tests/route-pins.spec.js`)**

```js
test("pinned stop outside the top results stays visible in its own section", async ({ page }) => {
  await runRouteSearch(page, { maxStops: 5 });          // helper added to fixtures in step 1
  // Pin Harbor Park (#3 at default), then slide left: the convMult-0 top 5 is
  // L8, L6, L1, L3, L2 — Harbor Park (L4) drops to #6 and must go out-of-rank.
  await page.locator('.stop-card:has-text("Harbor Park")').locator("[data-pin], .pin-button").click();
  await page.locator("#balanceSliderResults").fill("0");
  const ranked = page.locator(".results-list .stop-card:not(.is-out-of-rank)");
  await expect(ranked).toHaveCount(5);
  const outOfRank = page.locator(".stop-card.is-out-of-rank");
  await expect(outOfRank).toHaveCount(1);
  await expect(page.locator(".out-of-rank-heading")).toContainText("Pinned — outside current top results");
});
```

Find the real pin control selector in the stop-card template (`index.html`, `<template id="resultTemplate">` — grep `resultTemplate`). The Harbor Park choice is verified against the fixture table: it is #3 at default (utility 58.00) and #6 at convMult 0 (birdPoints 39.20, behind L8/L6/L1/L3/L2). If route-mode detour math shifts the ordering, re-derive from the table — utilities in route mode use `addedMinutes`-based practicality, so keep the routing stub's detours proportional (`addedMinutes_i = maxDetour × d_i / 25`, per Step 1) so route practicality reproduces the area conv-points column, or recompute expectations.

Run: FAIL (no out-of-rank section exists).

- [ ] **Step 3: Implement the pinned section in `renderResults`**

After the ranked-cards loop (`~4079-4130`):

```js
  const outOfRank = pinnedStops().filter((stop) => !state.results.some((item) => item.id === stop.id));
  if (outOfRank.length) {
    const heading = document.createElement("p");
    heading.className = "out-of-rank-heading";
    heading.textContent = "Pinned — outside current top results";
    els.resultsList.appendChild(heading);
    outOfRank.forEach((candidate) => {
      // Reuse the same card-building code path as ranked cards, with:
      //   rank.textContent = "📌" (or "—"); card.classList.add("is-out-of-rank");
    });
  }
```

Extract the card-building body of the `state.results.forEach` loop into `buildStopCard(candidate, rankLabel)` so both loops share it (DRY — do not duplicate the ~60-line card template code). `renderMarkers` (`4181`) should show them too: `state.mapAdapter.setMarkers(state.results.concat(outOfRank), …)`.

- [ ] **Step 4: Style `.out-of-rank-heading` and `.is-out-of-rank`** (muted heading, slightly dimmed card border — match existing card styles).

- [ ] **Step 5: Run all tests + lint, commit**

```bash
npx playwright test && npm run lint
git add public/app.js public/styles.css public/index.html tests/
git commit -m "Keep pinned stops visible outside the ranked list when re-ranking"
```

---

### Task 7: Saved trips — persist balance, inert slider on restore

**Files:**
- Modify: `public/app.js` — `readTripSettings`, `applyTripSettings`, `restoreTripState`, `clearResults`
- Test: `tests/saved-trips.spec.js` (new)

- [ ] **Step 1: Write the failing test**

```js
test("restored trips keep stored scores and an inert slider", async ({ page }) => {
  await runAreaSearch(page);
  await page.locator("#balanceSliderResults").fill("0");
  const orderBefore = await visibleOrder(page);
  await page.fill("#tripName", "Fixture Trip");
  await page.click("#saveTripButton");
  await page.reload();
  await stubApis(page);
  await page.selectOption("#savedTripSelect", { label: /Fixture Trip/ });
  await page.click("#loadTripButton");
  await expect(page.locator(".stop-card").first()).toBeVisible();
  expect(await visibleOrder(page)).toEqual(orderBefore);
  await expect(page.locator("#balanceSliderResults")).toHaveValue("0");
  await expect(page.locator("#balanceSliderResults")).toBeDisabled();
  await expect(page.locator("#balanceHintResults")).toContainText("Saved trips keep their original ranking");
});
```

(`selectOption` label matching may need the exact option text — check `renderSavedTrips`.) Run: FAIL.

- [ ] **Step 2: Persist balance in trip settings**

- `readTripSettings` (`684-705`): add `balance: String(state.balance)` to both branches.
- `applyTripSettings` (`707+`): after the `PREF_FIELDS` loop add:

```js
  setBalance(settings.balance !== undefined ? Number(settings.balance) : DEFAULT_BALANCE, { skipRerank: true });
```

Trips saved before this feature have no `balance` → default position "Recommended", per spec.

- [ ] **Step 3: Lock the slider on restore**

In `restoreTripState` (`757+`): set `state.candidatePool = []; state.balanceLocked = true;` before rendering, and ensure the restore path ends with `applyBalance(state.results)` **using the stored balance** (which `applyTripSettings` already set into `state.balance`) so display scores recompute consistently from `scoreParts` on the 0–100 scale, then `syncBalanceControls()`. Restored order: keep the saved array order (do NOT re-sort a restored trip — the pool is truncated; sorting by recomputed utility is fine only if it matches, so simply preserve saved order).

Fresh searches and `clearResults` already reset `balanceLocked = false` (Tasks 4-5) — verify.

- [ ] **Step 4: Run all tests + lint, commit**

```bash
npx playwright test && npm run lint
git add public/app.js tests/
git commit -m "Persist balance in saved trips and lock the slider on restore"
```

---

### Task 8: Cross-cutting assertions and final verification

**Files:**
- Test: `tests/balance-slider.spec.js` (additions)

- [ ] **Step 1: Add the remaining spec tests**

```js
test("moving right reduces the average distance of top results", async ({ page }) => {
  await runAreaSearch(page);
  const distances = async () => {
    const texts = await page.locator(".stop-card .metric-detour").allTextContents();
    return texts.map((t) => parseFloat(t)).reduce((a, b) => a + b, 0) / texts.length;
  };
  await page.locator("#balanceSliderResults").fill("0");
  const left = await distances();
  await page.locator("#balanceSliderResults").fill("4");
  const right = await distances();
  expect(right).toBeLessThan(left);
});

test("hotspot classification is stable across slider positions", async ({ page }) => {
  await runAreaSearch(page);
  const hotspotCount = () => page.locator("#hotspotCount").textContent();
  const atDefault = await hotspotCount();
  await page.locator("#balanceSliderResults").fill("4");
  // The *set* of hotspot-classified sites can differ because the visible list changes,
  // but no site may flip classification: assert per-name via card tier markers instead
  // if #hotspotCount proves list-dependent. Minimum bar: a near, low-species stop
  // (Near Pond) never renders as "Top hotspot" at any position.
  await expect(page.locator('.stop-card:has-text("Near Pond") .tier.high')).toHaveCount(0);
});

test("life-list ranking matches the lifer-weighted baseline", async ({ page }) => {
  await runAreaSearch(page);
  // Upload a life list naming every "City Park Alpha Species N" (all 78) as seen.
  // Species names are unique per fixture hotspot, so L1 gains 0 lifer points while
  // every other candidate has ≥20 unseen species → capped at min(8,·)/8 × 18 = +18.
  // Default-balance utilities become: L3 78.00, L4 76.00, L2 75.92, L6 74.04,
  // L8 73.50, then L1 62.08 (#6 — the fully-birded park drops out), L7 59.54, L5 48.40.
  const csv = Array.from({ length: 78 }, (_, i) => `City Park Alpha Species ${i + 1}`).join("\n");
  await page.setInputFiles("#lifeListInput", {
    name: "life-list.csv", mimeType: "text/csv", buffer: Buffer.from(`Common Name\n${csv}`)
  });
  await expect(page.locator(".stop-card")).toHaveCount(5);
  expect(await visibleOrder(page)).toEqual([
    "City Park Gamma", "Harbor Park", "City Park Beta", "Wetland Reserve North", "Far Rich Reserve"
  ]);
});
```

Check `parseLifeListText` (`public/app.js:1953+`) for the accepted CSV/header shape and adjust the header row if "Common Name" alone isn't recognized. Note the L4-vs-L2 margin here is again 0.08 utility points.

- [ ] **Step 2: Full suite, lint, and a manual pass**

```bash
npx playwright test && npm run lint
```

Then run `node server.js` and manually check: slider drag feels instant on the fixture data; tooltip reads sensibly; species mode hides both controls; a restored pre-feature trip (if any exist locally) loads without errors.

- [ ] **Step 3: Final commit**

```bash
git add tests/
git commit -m "Cover balance-slider edge cases: distance trend, classification stability, life list"
```

---

## Deferred / out of scope (per spec)

Hotspot grouping, freshness rework, quality floor at the convenience end, re-ranking restored trips, migrating `public/migration-app.js` (it has its own scoring — confirm it doesn't share these functions; it is a separate script and should be untouched).
