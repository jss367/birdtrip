# Target species row inputs with validation

**Date:** 2026-07-04
**Status:** Validated with Julius, ready for implementation planning

## Problem

Targets are entered in a plain textarea, one common name per line, and matched
against sightings by exact normalized-name lookup (`app.js:2724`,
`candidate.species.get(target)`). A typo ("Scarlet Tanger") silently never
matches anything and the user gets no signal that the name wasn't recognized.

## Design

Replace the `#targets` textarea with a vertical stack of single-species rows.

### UI and interaction

- Each row is a text input with a status icon on its right edge (inside the
  input, like the Species mode field) and a small × remove button.
- Exactly one empty "add" row always sits at the bottom. Typing in it and
  pressing Enter (or blurring with text) commits it as a real row and spawns a
  fresh empty row. Enter in any row moves focus to the next row.
- Each row has autocomplete wired to the existing
  `/api/ebird/taxonomy/search` endpoint — same debounce, dropdown, and
  arrow-key behavior as the Species mode picker. Picking a suggestion fills
  the row and marks it valid.
- Status icon states:
  - **Green ✓** — row text exactly matches a taxonomy common name
    (case-insensitive, via `normalizeName()`).
  - **Amber ⚠** — no exact match. If the taxonomy search returns a close hit,
    a one-line clickable "Did you mean *X*?" hint renders below the row;
    clicking it replaces the row text and turns it green.
  - **Spinner/nothing** — validation in flight; no icon on the empty add-row.
- Pasting multi-line text into any row splits on newlines, creates one row
  per name, and validates each.
- Unrecognized names are kept and still searched for, as today — flagged,
  never blocked. Validation is advisory.

### Data flow, validation, compatibility

- No server changes and no data-model changes. Rows are a rendering of the
  same newline-separated `targets` value: on any row change, rows are joined
  with newlines into the value that `parseTargetsInput()`, `PREF_FIELDS`
  persistence, the `targets=` shared-URL param, and the summary tiles already
  consume. Restoring prefs or a shared link splits the string back into rows
  and validates each.
- Validation reuses `/api/ebird/taxonomy/search?q=<row text>`: a row is valid
  if any returned entry's common name matches the row text after
  `normalizeName()`. The first non-exact result doubles as the "did you mean"
  suggestion.
- Requests are debounced per row (~300ms) and cached client-side in a `Map`
  keyed by normalized name, so re-validating a restored list doesn't refire
  settled queries. The server holds the whole taxonomy in memory, so calls
  are cheap.
- On network failure the row shows no icon rather than a false warning.
- Invariant this buys: since valid rows match taxonomy common names exactly
  and downstream target matching is exact-match on normalized names, a green
  check means "this will actually match sightings" by construction.

## Alternatives considered

- **Status list below the textarea** — smallest change, but per-line feedback
  detached from the input; Julius preferred per-row inputs.
- **Chip/tag input** — functionally near-identical to rows, but in-place
  editing of an entry is clumsier.
- **Validate only on submit** — feedback arrives after the search has run.

## Testing

No front-end test framework in this repo; verification is manual — run the
server and exercise typing/Enter/paste/did-you-mean/restore-from-prefs — plus
`npx eslint`.
