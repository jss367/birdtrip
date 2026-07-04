# Target Species Row Inputs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the target-species textarea with a stack of single-species row inputs, each with eBird-taxonomy validation (green ✓ / amber ⚠ + "did you mean" fix) and Species-mode-style autocomplete.

**Architecture:** The existing `<textarea id="targets">` stays in the DOM but hidden — it remains the single source of truth that all existing code reads and writes (`parseTargetsInput()`, `PREF_FIELDS` persistence, shared URLs, trip settings). The row UI is a pure view over it: row edits serialize into the textarea; external writes to the textarea trigger a row rebuild via an equality-guarded `renderTargetRows()` hooked into `updateInputSummaries()`. Validation and autocomplete both call the existing `/api/ebird/taxonomy/search` endpoint through one shared client-side cache.

**Tech Stack:** Vanilla JS (`public/app.js`, ~5000 lines, no framework, no build step), plain CSS (`public/styles.css`), lucide icons via `data-lucide` + `window.lucide.createIcons()`. No front-end test framework exists — verification is `npm run lint` (eslint 9) plus scripted manual browser checks against `npm start` (Node ≥18 server on, by default, port 8080 — check `server.js` output line for the actual port).

**Design doc:** `docs/plans/2026-07-04-target-species-validation-design.md`

**Manual testing setup (used by every task):** run `npm start` from the repo root, open `http://localhost:<port>`. Taxonomy endpoints need an eBird token: either export `EBIRD_API_KEY=<key>` before `npm start` or paste a token into the "eBird API token" field in the UI. Without a token, validation intentionally shows no icons (advisory-only behavior).

---

### Task 1: HTML markup, `els` entry, and CSS

**Files:**
- Modify: `public/index.html` (the Target species label, ~line 187)
- Modify: `public/app.js:76` (the `els` map, next to `targets`)
- Modify: `public/styles.css` (after the `.autocomplete-list` rules, ~line 374)

**Step 1: Replace the textarea markup**

In `public/index.html`, replace:

```html
          <label>
            <span>Target species</span>
            <textarea id="targets" name="targets" rows="4" placeholder="One common name per line"></textarea>
          </label>
```

with:

```html
          <div class="target-field">
            <span>Target species</span>
            <textarea id="targets" name="targets" hidden></textarea>
            <div id="targetRows" class="target-rows"></div>
            <small class="field-hint">Press Enter to add another species, or paste a list.</small>
          </div>
```

Keep the textarea (hidden) — every existing consumer (`els.targets.value` reads at `app.js:650`, `app.js:1526`, `app.js:1618`, `app.js:1700`; writes at `app.js:347`, `app.js:392`, `app.js:665`, `app.js:1027`, `app.js:1035`) continues to work untouched.

**Step 2: Add the container to `els`**

In `public/app.js`, directly below `targets: document.querySelector("#targets"),` (line 76), add:

```js
  targetRows: document.querySelector("#targetRows"),
```

**Step 3: Add CSS**

In `public/styles.css`, after the `.autocomplete-list li.is-loading:hover` block (~line 374), add:

```css
.target-field {
  display: grid;
  gap: 6px;
}

.target-field > span {
  color: var(--muted-strong);
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
}

.target-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.target-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.target-row .autocomplete input {
  padding-right: 32px;
}

.target-status {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  display: inline-flex;
  pointer-events: none;
}

.target-status svg {
  width: 14px;
  height: 14px;
}

.target-row[data-state="valid"] .target-status {
  color: var(--accent-strong);
}

.target-row[data-state="unknown"] .target-status {
  color: var(--amber);
}

.target-row[data-state="pending"] .target-status {
  color: var(--muted);
}

.target-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
}

.target-remove:hover {
  color: var(--rose);
  border-color: var(--rose);
}

.target-remove svg {
  width: 12px;
  height: 12px;
}

.target-row[data-state="empty"] .target-remove {
  visibility: hidden;
}

.target-hint {
  grid-column: 1 / -1;
  color: var(--amber-strong);
  font-size: 0.75rem;
  line-height: 1.3;
}

.target-suggestion {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-strong);
  font: inherit;
  font-weight: 750;
  text-decoration: underline;
  cursor: pointer;
}
```

(`.target-field` deliberately mirrors the `label` / `label > span` rules at `styles.css:255-265`; we use a `div` because a `label` wrapping multiple inputs would misdirect clicks to the hidden textarea.)

**Step 4: Verify**

Run: `npm run lint` — expected: passes.
Run `npm start`, load the page: the Target species field shows the uppercase heading and the hint line, no visible textarea, and an empty gap where rows will render. Nothing is broken in the rest of the form.

**Step 5: Commit**

```bash
git add public/index.html public/app.js public/styles.css
git commit -m "Add target-rows markup, els entry, and styles"
```

---

### Task 2: Row rendering, serialization, and editing (no validation yet)

**Files:**
- Modify: `public/app.js` — new functions after `hideSpeciesAutocomplete()` (~line 2531); one-line hooks in `updateInputSummaries()` (line 1687) and `applyTripSettings()` (line 663)

**Step 1: Add the row engine**

In `public/app.js`, after `hideSpeciesAutocomplete()` (ends ~line 2531), add:

```js
// --- Target species rows ---

const targetRowsState = {
  taxonomy: new Map(), // normalized name -> Promise<matches[]|null>
  contexts: new WeakMap() // row element -> { acTimer, valToken, items, activeIndex }
};

function targetRowContext(row) {
  let ctx = targetRowsState.contexts.get(row);
  if (!ctx) {
    ctx = { acTimer: 0, valToken: 0, items: [], activeIndex: -1 };
    targetRowsState.contexts.set(row, ctx);
  }
  return ctx;
}

function cleanTargetName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function targetRowInputs() {
  return Array.from(els.targetRows.querySelectorAll(".target-row input"));
}

function serializeTargetRows() {
  return targetRowInputs()
    .map((input) => cleanTargetName(input.value))
    .filter(Boolean)
    .join("\n");
}

function syncTargetsFromRows() {
  els.targets.value = serializeTargetRows();
  updateInputSummaries();
}

function renderTargetRows() {
  if (!els.targetRows || !els.targets) return;
  const names = els.targets.value.split(/\n|,/).map(cleanTargetName).filter(Boolean);
  if (els.targetRows.childElementCount && serializeTargetRows() === names.join("\n")) return;
  els.targetRows.innerHTML = "";
  for (const name of names) els.targetRows.appendChild(createTargetRow(name));
  els.targetRows.appendChild(createTargetRow(""));
  if (window.lucide) window.lucide.createIcons();
}

function createTargetRow(name) {
  const row = document.createElement("div");
  row.className = "target-row";
  row.dataset.state = "empty";

  const wrap = document.createElement("div");
  wrap.className = "autocomplete";
  const input = document.createElement("input");
  input.type = "text";
  input.value = name;
  input.placeholder = "Add a species";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-label", "Target species");
  const status = document.createElement("span");
  status.className = "target-status";
  status.setAttribute("aria-hidden", "true");
  status.hidden = true;
  const list = document.createElement("ul");
  list.className = "autocomplete-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  wrap.append(input, status, list);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "target-remove";
  remove.setAttribute("aria-label", "Remove target species");
  remove.innerHTML = '<i data-lucide="x"></i>';

  const hint = document.createElement("small");
  hint.className = "target-hint";
  hint.hidden = true;

  row.append(wrap, remove, hint);

  input.addEventListener("input", () => handleTargetRowInput(row));
  input.addEventListener("keydown", (event) => handleTargetRowKeydown(row, event));
  input.addEventListener("blur", () => handleTargetRowBlur(row));
  input.addEventListener("paste", (event) => handleTargetRowPaste(row, event));
  remove.addEventListener("click", () => removeTargetRow(row));

  if (name) scheduleTargetRowValidation(row);
  return row;
}

function ensureTargetAddRow() {
  const inputs = targetRowInputs();
  const last = inputs[inputs.length - 1];
  if (!last || cleanTargetName(last.value)) {
    const row = createTargetRow("");
    els.targetRows.appendChild(row);
    if (window.lucide) window.lucide.createIcons();
  }
}

function removeTargetRow(row) {
  row.remove();
  syncTargetsFromRows();
  ensureTargetAddRow();
}

function commitTargetRow(row) {
  const input = row.querySelector("input");
  if (!cleanTargetName(input.value)) return;
  hideTargetRowAutocomplete(row);
  ensureTargetAddRow();
  const inputs = targetRowInputs();
  const next = inputs[inputs.indexOf(input) + 1];
  if (next) next.focus();
}

function handleTargetRowInput(row) {
  syncTargetsFromRows();
  scheduleTargetRowValidation(row);
}

function handleTargetRowKeydown(row, event) {
  if (event.key === "Enter") {
    event.preventDefault();
    commitTargetRow(row);
  }
}

function handleTargetRowBlur(row) {
  setTimeout(() => {
    hideTargetRowAutocomplete(row);
    const input = row.querySelector("input");
    if (!input || document.activeElement === input) return;
    if (!cleanTargetName(input.value) && row !== els.targetRows.lastElementChild) {
      removeTargetRow(row);
    } else {
      ensureTargetAddRow();
    }
  }, 120);
}

function handleTargetRowPaste(row, event) {
  const text = event.clipboardData?.getData("text") || "";
  if (!/[\n,]/.test(text)) return;
  event.preventDefault();
  const names = text.split(/\n|,/).map(cleanTargetName).filter(Boolean);
  if (!names.length) return;
  const input = row.querySelector("input");
  input.value = names[0];
  let anchor = row;
  for (const name of names.slice(1)) {
    const newRow = createTargetRow(name);
    anchor.after(newRow);
    anchor = newRow;
  }
  scheduleTargetRowValidation(row);
  syncTargetsFromRows();
  ensureTargetAddRow();
  if (window.lucide) window.lucide.createIcons();
}

function hideTargetRowAutocomplete(row) {
  const ctx = targetRowContext(row);
  const listEl = row.querySelector(".autocomplete-list");
  const input = row.querySelector("input");
  if (listEl) listEl.hidden = true;
  if (input) input.setAttribute("aria-expanded", "false");
  ctx.activeIndex = -1;
}

function scheduleTargetRowValidation(row) {
  const input = row.querySelector("input");
  row.dataset.state = cleanTargetName(input.value) ? "pending" : "empty";
}
```

Notes for the implementer:
- `scheduleTargetRowValidation` is a placeholder here; Task 3 replaces it with real validation. Keeping the name now means `createTargetRow` never changes again.
- `Enter` MUST call `event.preventDefault()` — these are `<input>`s inside the search `<form>`, and Enter would otherwise submit the form (the textarea never had this problem).
- Row edits do NOT call `savePreferences()` — the old textarea persisted only when a search ran, and we keep that behavior identical.
- Paste splits on `/\n|,/` to match exactly what `parseTargetsInput()` (`app.js:1699-1704`) treats as separators.

**Step 2: Hook rebuilds into `updateInputSummaries()`**

`updateInputSummaries()` (line 1687) is already called after every external write to `els.targets.value` (`applySharedSearch` line 349, `fillSample` line 1039, init line 177). Add `renderTargetRows();` as its first line:

```js
function updateInputSummaries() {
  renderTargetRows();
  const targets = parseTargetsInput();
  ...
```

The equality guard in `renderTargetRows()` makes this safe: when the call originates from row typing (via `syncTargetsFromRows()`), the serialized rows already equal the textarea value, so no rebuild happens and focus is never stolen. A rebuild only fires when the textarea was written externally.

**Step 3: Cover `applyTripSettings`**

`applyTripSettings()` (line 663) writes `els.targets.value` but only reaches `updateInputSummaries()` when `settings.searchMode` is a string. Append a direct call at the end of the function:

```js
function applyTripSettings(settings) {
  for (const field of PREF_FIELDS) {
    if (typeof settings[field] === "string" && els[field]) els[field].value = settings[field];
  }
  if (typeof settings.searchMode === "string") {
    setSearchMode(settings.searchMode, { persist: false });
  }
  updateInputSummaries();
}
```

**Step 4: Verify with lint**

Run: `npm run lint` — expected: passes (watch for unused-var warnings on the placeholder pieces; `targetRowsState.taxonomy` and `targetRowContext` are used from Task 3 on — if eslint flags them, it's acceptable to move those two definitions into Task 3 instead).

**Step 5: Verify manually**

With `npm start` running:
1. Load the page → one empty "Add a species" row shows.
2. Type `Gilded Flicker`, press Enter → a second empty row appears and takes focus; the Targets tile count reads 1.
3. Add two more names; click a row's × → it disappears, count drops.
4. Paste `Rosy-faced Lovebird\nAbert's Towhee, Bendire's Thrasher` (mixed newline/comma) into the empty row → three rows plus an empty add row.
5. Click the sample button (map-pinned icon) → rows repopulate with the sample targets.
6. Run a search, reload the page → rows restore from saved preferences.
7. Clear a middle row's text and click elsewhere → the row is removed.

**Step 6: Commit**

```bash
git add public/app.js
git commit -m "Render target species as editable rows backed by hidden textarea"
```

---

### Task 3: Taxonomy validation with ✓ / ⚠ status

**Files:**
- Modify: `public/app.js` — replace the placeholder `scheduleTargetRowValidation`, add lookup/validate/status functions in the same section

**Step 1: Add the shared taxonomy lookup**

Add after `hideTargetRowAutocomplete`:

```js
function targetTaxonomyLookup(name) {
  const key = normalizeName(name);
  if (!key) return Promise.resolve([]);
  if (!targetRowsState.taxonomy.has(key)) {
    const promise = apiJson(
      `/api/ebird/taxonomy/search?q=${encodeURIComponent(name)}`,
      { token: els.apiToken.value.trim() }
    )
      .then((matches) => (Array.isArray(matches) ? matches : []))
      .catch(() => {
        targetRowsState.taxonomy.delete(key);
        return null;
      });
    targetRowsState.taxonomy.set(key, promise);
  }
  return targetRowsState.taxonomy.get(key);
}
```

Failed requests return `null` AND evict themselves from the cache so a later attempt can retry. The cache is shared with Task 5's autocomplete.

**Step 2: Replace the placeholder validation**

Replace the placeholder `scheduleTargetRowValidation` from Task 2 with:

```js
function scheduleTargetRowValidation(row) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  const name = cleanTargetName(input.value);
  const token = ++ctx.valToken;
  if (!name) {
    setTargetRowStatus(row, "empty", null);
    return;
  }
  setTargetRowStatus(row, "pending", null);
  setTimeout(() => {
    if (ctx.valToken !== token) return;
    validateTargetRow(row, name, token);
  }, 300);
}

async function validateTargetRow(row, name, token) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  const items = await targetTaxonomyLookup(name);
  if (ctx.valToken !== token || cleanTargetName(input.value) !== name) return;
  if (!items) {
    setTargetRowStatus(row, "empty", null);
    return;
  }
  const key = normalizeName(name);
  const exact = items.find((item) => normalizeName(item.comName) === key);
  setTargetRowStatus(row, exact ? "valid" : "unknown", exact ? null : items[0] || null);
}

function setTargetRowStatus(row, rowState, suggestion) {
  row.dataset.state = rowState;
  const status = row.querySelector(".target-status");
  const hint = row.querySelector(".target-hint");
  if (rowState === "valid") {
    status.innerHTML = '<i data-lucide="check"></i>';
    status.hidden = false;
  } else if (rowState === "unknown") {
    status.innerHTML = '<i data-lucide="triangle-alert"></i>';
    status.hidden = false;
  } else {
    status.innerHTML = "";
    status.hidden = true;
  }
  hint.hidden = true;
  hint.textContent = "";
  if (window.lucide) window.lucide.createIcons();
}
```

The `token` check makes stale async results harmless (user kept typing, picked a suggestion, or cleared the row). The `suggestion` parameter is unused until Task 4 — eslint 9 defaults allow unused function parameters only in some configs; if `npm run lint` flags it, name it `_suggestion` in this task and rename back in Task 4.

The validity rule (`normalizeName(item.comName) === normalizeName(rowText)`) is deliberately the same comparison used for matching sightings at `app.js:2724` (`candidate.species.get(target)` where both sides went through `normalizeName`), so a green check means "this will actually match sightings" by construction.

**Step 3: Verify with lint**

Run: `npm run lint` — expected: passes.

**Step 4: Verify manually**

With `npm start` running and a token available:
1. Type `Gilded Flicker` in a row → after ~300ms + fetch, a green ✓ appears at the input's right edge.
2. Type `Gilded Flickr` → amber ⚠ appears.
3. Fix it back → ✓ returns instantly on settle (cache hit for repeated names).
4. Case-insensitivity: `gilded flicker` → ✓.
5. Reload after a search → restored rows validate on load.
6. Stop the server, type a new name → row shows no icon (state `empty`), no console spam beyond the failed fetch. Restart server, edit the row → validation recovers (cache self-evicted).

**Step 5: Commit**

```bash
git add public/app.js
git commit -m "Validate target rows against the eBird taxonomy"
```

---

### Task 4: "Did you mean …?" suggestion with click-to-fix

**Files:**
- Modify: `public/app.js` — extend `setTargetRowStatus`, add `applyTargetSuggestion`

**Step 1: Render the suggestion hint**

In `setTargetRowStatus`, replace the two lines

```js
  hint.hidden = true;
  hint.textContent = "";
```

with:

```js
  hint.textContent = "";
  if (rowState === "unknown" && suggestion?.comName) {
    hint.append("Not in the eBird taxonomy. Did you mean ");
    const fixButton = document.createElement("button");
    fixButton.type = "button";
    fixButton.className = "target-suggestion";
    fixButton.textContent = suggestion.comName;
    fixButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applyTargetSuggestion(row, suggestion);
    });
    hint.append(fixButton, "?");
    hint.hidden = false;
  } else if (rowState === "unknown") {
    hint.textContent = "Not found in the eBird taxonomy. It will still be searched as typed.";
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
```

(`mousedown` + `preventDefault` rather than `click`, matching the autocomplete list items at `app.js:2477-2480` — it fires before the input's blur can remove or re-render the row.)

**Step 2: Add the fix action**

```js
function applyTargetSuggestion(row, item) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  input.value = item.comName;
  ctx.valToken += 1;
  hideTargetRowAutocomplete(row);
  syncTargetsFromRows();
  setTargetRowStatus(row, "valid", null);
}
```

(Bumping `valToken` cancels any in-flight validation so it can't overwrite the immediate ✓.)

**Step 3: Verify with lint**

Run: `npm run lint` — expected: passes.

**Step 4: Verify manually**

1. Type `Scarlet Tanger` → ⚠ plus hint: Not in the eBird taxonomy. Did you mean **Scarlet Tanager**?
2. Click the suggestion → input text becomes `Scarlet Tanager`, ✓ shows, hint disappears, Targets tile still counts 1.
3. Type gibberish (`zzzzz`) → ⚠ plus the no-suggestion fallback text.

**Step 5: Commit**

```bash
git add public/app.js
git commit -m "Offer did-you-mean fix for unrecognized target species"
```

---

### Task 5: Per-row autocomplete

**Files:**
- Modify: `public/app.js` — extend `handleTargetRowInput` and `handleTargetRowKeydown`, add fetch/render/select/navigation functions

**Step 1: Trigger autocomplete from typing**

Replace `handleTargetRowInput` with:

```js
function handleTargetRowInput(row) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  syncTargetsFromRows();
  scheduleTargetRowValidation(row);
  const value = cleanTargetName(input.value);
  if (ctx.acTimer) clearTimeout(ctx.acTimer);
  if (value.length < 2) {
    hideTargetRowAutocomplete(row);
    return;
  }
  ctx.acTimer = setTimeout(() => fetchTargetRowAutocomplete(row, value), 220);
}
```

**Step 2: Keyboard navigation**

Replace `handleTargetRowKeydown` with:

```js
function handleTargetRowKeydown(row, event) {
  const ctx = targetRowContext(row);
  const listEl = row.querySelector(".autocomplete-list");
  if (!listEl.hidden && ctx.items.length) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveTargetRowSelection(row, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveTargetRowSelection(row, -1);
      return;
    }
    if (event.key === "Escape") {
      hideTargetRowAutocomplete(row);
      return;
    }
    if (event.key === "Enter" && ctx.activeIndex >= 0) {
      event.preventDefault();
      selectTargetRowItem(row, ctx.activeIndex);
      commitTargetRow(row);
      return;
    }
  }
  if (event.key === "Enter") {
    event.preventDefault();
    commitTargetRow(row);
  }
}
```

**Step 3: Fetch, render, select**

Add after `hideTargetRowAutocomplete`:

```js
async function fetchTargetRowAutocomplete(row, query) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  const listEl = row.querySelector(".autocomplete-list");
  listEl.innerHTML = '<li class="is-loading">Searching…</li>';
  listEl.hidden = false;
  input.setAttribute("aria-expanded", "true");
  const items = await targetTaxonomyLookup(query);
  if (cleanTargetName(input.value) !== query || listEl.hidden) return;
  if (!items || !items.length) {
    ctx.items = [];
    ctx.activeIndex = -1;
    listEl.innerHTML = '<li class="is-empty">No matches.</li>';
    return;
  }
  ctx.items = items;
  ctx.activeIndex = -1;
  listEl.innerHTML = "";
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");
    li.dataset.index = String(index);
    li.innerHTML = '<i data-lucide="bird"></i><span class="ac-name"></span>';
    li.querySelector(".ac-name").textContent = item.sciName
      ? `${item.comName} · ${item.sciName}`
      : item.comName;
    li.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectTargetRowItem(row, index);
    });
    li.addEventListener("mouseenter", () => setTargetRowActive(row, index));
    listEl.appendChild(li);
  });
  if (window.lucide) window.lucide.createIcons();
}

function moveTargetRowSelection(row, delta) {
  const ctx = targetRowContext(row);
  if (!ctx.items.length) return;
  setTargetRowActive(row, (ctx.activeIndex + delta + ctx.items.length) % ctx.items.length);
}

function setTargetRowActive(row, index) {
  const ctx = targetRowContext(row);
  const listEl = row.querySelector(".autocomplete-list");
  ctx.activeIndex = index;
  Array.from(listEl.children).forEach((li, i) => {
    const isActive = i === index;
    li.classList.toggle("is-active", isActive);
    li.setAttribute("aria-selected", String(isActive));
    if (isActive) li.scrollIntoView({ block: "nearest" });
  });
}

function selectTargetRowItem(row, index) {
  const ctx = targetRowContext(row);
  const item = ctx.items[index];
  if (!item) return;
  const input = row.querySelector("input");
  input.value = item.comName;
  ctx.valToken += 1;
  hideTargetRowAutocomplete(row);
  syncTargetsFromRows();
  setTargetRowStatus(row, "valid", null);
}
```

This mirrors the Species-mode picker (`setupSpeciesAutocomplete` and friends, `app.js:2365-2531`) with per-row context instead of a module-level singleton. The 220ms debounce matches `app.js:2389`. No AbortController: responses come through the shared cache (aborting would poison it), and staleness is handled by re-checking the input value.

**Step 4: Verify with lint**

Run: `npm run lint` — expected: passes.

**Step 5: Verify manually**

1. Type `verm` in a row → dropdown appears with bird icons, `Vermilion Flycatcher · Pyrocephalus obscurus` style entries — visually identical to the Species-mode picker.
2. ArrowDown/ArrowUp cycle the highlight; Enter on a highlighted item fills the row, shows ✓, and jumps focus to the next (empty) row.
3. Mouse: hover highlights, mousedown selects without losing the dropdown to blur.
4. Escape closes the dropdown; Enter afterwards commits the row as typed.
5. Blur (click elsewhere) closes the dropdown ~120ms later.
6. Two rows open in sequence never cross-contaminate suggestions.

**Step 6: Commit**

```bash
git add public/app.js
git commit -m "Add per-row taxonomy autocomplete to target species"
```

---

### Task 6: Full regression pass

**Files:** none new — fixes only if a check fails.

**Step 1: Lint everything**

Run: `npm run lint` — expected: clean.

**Step 2: End-to-end manual checklist**

With `npm start` and a token:

1. **Route search end-to-end:** sample button → rows fill → run search → target-match badges/tiles behave as before (targets flow through `parseTargetsInput()` unchanged).
2. **Preferences roundtrip:** edit rows, run a search, hard-reload → rows restore.
3. **Shared URL:** run a search with targets, use Share to get a URL with `targets=` param, open it in a private window → rows populate from the shared list and validate.
4. **Trip save/load:** save a trip, clear, load it → rows restore (exercises `applyTripSettings`).
5. **Mode switching:** flip Route/Area/Species modes → no console errors; target rows unaffected.
6. **No-token behavior:** without any token, rows accept text with no icons and search still submits.
7. **Typo catch (the original feature ask):** type `Scarlet Tanger` → ⚠ + did-you-mean → click → ✓.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "Fix issues found in target-rows regression pass"
```

(Skip the commit if nothing needed fixing.)
