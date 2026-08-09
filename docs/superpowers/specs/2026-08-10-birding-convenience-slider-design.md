# Birding ↔ Convenience Balance Slider — Design

## Problem

BirdTrip's ranking blends bird data and proximity with a fixed weighting (up to 20 of ~115
points for practicality). Users cannot express intent: "I want the best birding within this
radius" and "I want a good stop with the least driving" produce the same ranking. The
motivating case: an area search from Nou Barris, Barcelona ranked the Delta del Llobregat
hotspots #5, #6, and #8 despite them having the strongest bird data in the search, because
city parks collected nearly full proximity points.

## Goals

- Let users re-weight bird quality vs. convenience with a visible, shareable control.
- Re-rank instantly on change (no new API calls).
- Preserve today's ranking exactly at the default position.
- Keep hotspot classification and score explanations honest at every position.

## Non-goals

- Hotspot grouping/clustering (separate feature).
- Freshness/popularity-bias rework in the scorer (separate feature).
- A bird-quality floor at the convenience end (revisit if usage shows bad stops winning).
- Re-scoring or re-ranking restored saved trips.

## Prerequisite fix (separate commit)

Target scoring currently divides by a fixed 5 slots (`scoreCandidates`), so a 1-target
search can earn at most 3 of 15 points. Normalize to the requested target count, with a
zero-target guard:

```js
const targetSlots = Math.min(params.targets.length, 5);
const targetScore = targetSlots
  ? Math.min(weightedTargets, targetSlots) / targetSlots * 15
  : 0;
```

## Design

### Score concepts

Each scored candidate carries four distinct values (raw `scoreParts` are unchanged):

| Concept | Definition | Used for |
|---|---|---|
| `siteQuality` | (species + activity + notable points) / 80 × 100 | Hotspot classification only. Excludes targets/lifers so personal inputs cannot mint a "Top hotspot". |
| `birdScore` | species + activity + notable + targets + lifers, raw points (max 95, or 113 with a life list) | The "birding" side of ranking |
| `rankUtility` | `birdScore + convMult × practicality` — unrounded; the only sort key | Ranking |
| `displayScore` | `round(rankUtility / (birdMax + convMult × 20) × 100)` | All user-facing scores (cards, popups, reports), always 0–100 |

`convMult` comes from the balance control. At `convMult = 1`, `rankUtility` equals today's
`score` before rounding, so the default ordering is exactly current behavior in every
configuration (targets, life list, route or area mode). Rounding happens only at display.

`isHotspot` switches from `score >= 65` to `siteQuality >= 55 || species.size >= 40`.
(65 of a ~115 total that included up to 20 practicality points ≈ 55 of the 80-point
site-quality subtotal; the fixture test locks in that classification does not regress on
the Barcelona fixture.) The best-birding-route / value-per-minute panel sorts by
`rankUtility` — it is a live recommendation, so it follows the user's stated preference.

### The control

A five-position segmented slider (ordinal, not a percentage):

| Position | `convMult` | Label |
|---|---|---|
| 0 | 0 | Prioritize birding |
| 1 | 0.5 | — |
| 2 (default) | 1 | Recommended |
| 3 | 2 | — |
| 4 | 5 | Less driving |

- The right endpoint is labeled "Less driving", not "closest good stop" — it is an honest
  preference, not a quality guarantee.
- Rendered twice — search form and results header — bound to one piece of state; changing
  either updates both.
- Hidden in species-sighting mode (no scored candidates there).
- Inert, with a hint, for restored saved trips (see Saved trips).
- URL: `balance=<0..4>`, omitted at the default; clamped on read like other params.
- Persisted in trip settings alongside `searchMode`.

### Evaluated candidate pool

Today both search paths score a pool and then keep only the visible top `maxStops`
(`state.results`), so re-ranking could never admit a candidate from outside the shortlist.
Instead:

- `state.candidatePool` holds every candidate that is fully scored **with complete notable
  data**, so pool members are comparable:
  - **Area mode:** the whole evaluated pool (`buildCandidates` already bounds it to
    ~3× maxStops + rescued target/lifer candidates). The area-wide notable feed already
    covers every candidate.
  - **Route mode:** the top `max(2 × maxStops, 12)` candidates plus preserved
    (target/lifer-rescued) ones; per-candidate notable fetches run for every pool member.
    This roughly doubles route-mode notable API calls — accepted, and the pool bound is
    the documented re-ranking limit.
- The visible list is always derived: sort `candidatePool` by `rankUtility` descending,
  slice `maxStops`, render.
- `selectCandidate`, pin handling, and any candidate-by-id lookup read `candidatePool`,
  not `state.results`.

### Re-ranking interaction

On balance change: recompute `rankUtility`/`displayScore` for the pool (pure client-side
math), re-derive the visible list, re-render results, markers, and report. No debounce
beyond an animation-frame guard.

Pinned and selected stops:

- The ranked list remains exactly the top `maxStops`.
- A pinned stop that falls outside the top N renders in a separate section labeled
  "Pinned — outside current top results"; it never displaces ranked entries.
- A selected stop's detail panel stays open regardless of rank; selection alone does not
  inflate the list.

### Score explanation

The two-level tooltip replaces the flat breakdown headline:

> Overall 78 of 100 · Birding 74/100 · Convenience 90/100 · Preference: Recommended

The existing raw component bars (Species 35.2/45, … Practicality 12/20) remain below as
the explanation of the Birding and Convenience subscores. The headline always sums
consistently because Overall is the weighted blend of the two subscores shown.

### Saved trips

- `serializeTripState` gains the balance position in settings; restoring a trip restores
  the stored scores and shows the stored balance.
- The slider is inert for restored trips because saved trips serialize only the truncated
  visible `results`, not the candidate pool — re-ranking a partial pool would silently
  produce wrong orderings. (Candidates do serialize raw observations, so live re-scoring
  would be possible; the pool truncation is the actual blocker.)
- Trips saved before this feature have no stored balance and display as "Recommended".

## Error handling

- Invalid/out-of-range `balance` URL or saved values clamp to the default position.
- If route-mode notable fetches fail for part of the pool, the existing warning path
  (`addWarning`) reports it; affected candidates stay in the pool with zero notable
  points, matching current failure behavior.

## Testing

Add `@playwright/test` as a devDependency with an `npm test` script (the repo is currently
lint-only; cached Chromium alone is not reproducible). Tests stub `/api/ebird/*` with
fixtures (a Barcelona-like area fixture and a route fixture) and assert:

1. Default ordering is byte-identical to the pre-change ordering, with and without a
   life list.
2. A candidate outside the default top `maxStops` enters the visible list at
   "Prioritize birding".
3. Both mirrored controls and the URL param stay synchronized.
4. Moving right reduces the average distance/detour of the top results.
5. Pins survive re-ranking; the out-of-rank pinned section appears when applicable.
6. Restored saved trips show stored scores and an inert slider.
7. Hotspot classification on the fixture is unchanged at every slider position.

`npm run lint` must pass.
