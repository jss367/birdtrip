# Place recommendations and bird likelihood

**Date:** 2026-08-08
**Status:** Current-API phases implemented 2026-08-08; seasonal likelihood pending data permission and source selection

## Summary

Birdtrip should answer two related but distinct questions:

1. **Where should I stop?** Find every plausible public birding destination near
   the route, then rank those destinations by birding value and route cost.
2. **What might I see there?** Separate species with recent reports from species
   that are consistently reported at that place during the relevant season.

The current recent-observation feed is a useful signal for both questions, but it
cannot be the source of truth for either. In route mode it is also being used for
candidate discovery, which means a location must surface in a recent feed before
it can be scored. A major hotspot with no qualifying report in the selected
window can therefore disappear entirely.

This design changes the pipeline from **recent reports -> candidate places** to
**known places + a cheap current-activity prior -> per-place evidence -> route
impact -> recommendation**. It also reserves the word “likely” for
checklist-frequency or modeled seasonal data. Until that data is available, the
product will describe species as “reported recently.”

## Problem

### Candidate discovery is coupled to recent sightings

Route mode samples 14 points along the drive and calls eBird's nearby recent
observations endpoint with `hotspot=true`. Locations returned by those calls are
grouped into candidates. This has four consequences:

- A known hotspot is absent if it has not been visited or reported during the
  selected 1–30 day window.
- Fourteen fixed samples can leave gaps on a long route or over-query a short
  one. A user-visible “corridor radius” does not guarantee that the entire
  geometric corridor was searched.
- Personal eBird locations are excluded even when they represent useful public
  birding sites.
- The nearby recent-observations endpoint returns the most recent observation
  for each species across the requested circle. It does not return a complete
  recent species list for every hotspot in that circle. A hotspot's apparent
  richness in route mode is therefore partly determined by whether it held the
  newest report in an overlapping sample circle.

Area mode starts from the hotspot endpoint, but passes `back=recentDays`, so it
also excludes hotspots that were not visited within the selected window.

### Recent presence is presented too close to encounter likelihood

A report proves that a species was detected, not the probability that the next
visitor will detect it. Report counts and raw species totals are influenced by:

- number of visitors and checklists;
- visit duration, distance, protocol, and group size;
- observer skill and which species observers choose to report;
- weekends, weather, migration pulses, and rarity-driven visits;
- incomplete and provisional checklists.

A rarity seen once yesterday is current but not necessarily likely. A resident
species reported on 70% of complete checklists this week in prior years is
likely even if nobody submitted a checklist yesterday.

### Early pruning can hide the best practical stop

Candidates are preliminarily sorted by recent species, observation records,
targets, lifers, and approximate route distance. Only a bounded subset receives
an actual detour calculation. A lightly reported but excellent hotspot can be
discarded before its route practicality is known.

### An eBird Hotspot is not a quality designation

An eBird Hotspot is a shared public location where observations can be
aggregated. It need not be unusually productive. Hotspot status is valuable for
discoverability and public-location confidence, but should not itself be a
quality score.

## Goals

- Do not omit a known eBird hotspot merely because it lacks a report in the
  user's recent window.
- Search the full requested route corridor with a measurable coverage rule.
- In route mode, fetch per-hotspot evidence before claiming a hotspot's recent
  species count. Area mode already does this and should retain that behavior.
- Rank places using independent dimensions: route practicality, stable place
  value, current evidence, personal value, and data confidence.
- Clearly distinguish “likely this season,” “reported recently,” “specialty,”
  and “rare report.”
- Explain why each recommendation appears and how confident Birdtrip is.
- Remain useful when seasonal frequency data is unavailable.
- Keep API traffic bounded and cacheable.

## Non-goals

- Guarantee that a user will see any species.
- Infer current access, opening hours, road conditions, safety, or habitat
  conditions from eBird observations.
- Treat every eBird Hotspot as a recommended destination.
- Build a scientific abundance model in the browser.
- Download or process the complete eBird Basic Dataset during an interactive
  search.
- Include private personal eBird locations in destination recommendations
  without a separate source establishing public access.

## Product language

Birdtrip must use evidence-specific language rather than blending all bird data
into one promise.

| Label | Meaning | Required evidence |
| --- | --- | --- |
| **Likely this season** | Commonly detected by visitors at this place during this part of the year | Frequency from complete checklists or an approved modeled equivalent, plus adequate sample size |
| **Reported recently** | At least one qualifying report within the selected window | Recent per-location eBird observation |
| **Local specialty** | More characteristic of this place than of its surrounding region | Multi-year place-vs-region frequency comparison |
| **Rare report nearby** | A recent report that eBird classifies as notable | eBird notable-observation output; never presented as likely |
| **Possible** | Historically or seasonally plausible, but evidence is too weak for “likely” | Low-confidence frequency or historical presence |

Without seasonal frequency data, the main result promise is:

> Recommended birding stops along your route, with birds reported recently.

With qualified frequency data, it can become:

> Recommended birding stops along your route, with birds you are likely to
> encounter and birds reported recently.

Never convert “reported once,” “all-time list,” or “notable nearby” into
“likely.” This includes the existing **Likely lifer** label: until qualified
seasonal evidence exists, replace it with **Unseen recent report** or **Not on
your imported list**, depending on context.

## Data sources and constraints

### Available through the current eBird API

- **Hotspots near coordinates:** candidate location ID, coordinates, latest
  observation date, and all-time species count. Omitting the `back` parameter
  avoids filtering the directory to recently visited hotspots.
- **Recent observations at one hotspot:** the most recent qualifying report for
  each species at that location, up to 30 days back.
- **Recent observations of a target species:** useful for rescuing locations
  associated with an explicit user target.
- **Nearby notable observations:** useful as a separate alert, not as a
  probability.
- **Taxonomy:** name and species-code normalization.

These endpoints support comprehensive hotspot discovery and truthful “reported
recently” output. They do not expose the checklist denominator needed to
calculate encounter frequency.

### Seasonal likelihood sources

“Likely this season” requires an explicit product and licensing decision. The
two principal eBird options answer somewhat different questions:

1. **eBird Basic Dataset (EBD):** aggregate complete checklists by hotspot and
   week-of-year. This can produce true per-hotspot reporting frequency, but the
   approved-request download is large and creates a standing ingestion,
   aggregation, refresh, and hosting job.
2. **eBird Status and Trends:** use weekly modeled occurrence or relative
   abundance at the hotspot coordinate. Current products use a 3 km grid and
   cover more than 2,000 species globally. This is geographically broader and
   may be operationally simpler, but it describes the surrounding grid cell,
   not visitor frequency at the hotspot. Its UI wording must therefore say
   “expected in this area” rather than “reported on X% of checklists here.”

A separately licensed provider exposing equivalent place-season occurrence
probabilities is a third option.

Before implementing any option, obtain written confirmation that Birdtrip may
display the derived values in a public web product. The standard Status and
Trends terms require prior written consent for use of data products in websites,
apps, and decision-support tools; commercial use requires separate permission.
The EBD data-access terms also distinguish non-commercial research/education
from commercial use and restrict redistribution.

An EBD-derived production record should contain, at minimum:

```text
location_id
taxon_id
week_or_month
complete_checklist_count
checklists_reporting_taxon
frequency
years_represented
last_refreshed_at
```

Frequency is
`checklists_reporting_taxon / complete_checklist_count`. Store the numerator
and denominator so the UI can communicate confidence rather than presenting a
small-sample percentage as precise.

The recent API remains the source for current reports even after seasonal data
is introduced. Historical frequency and current evidence are complementary.

### Historical live-API bridge

The eBird API exposes dated checklist feeds, historic observations, and
individual checklist details. These endpoints should be investigated only with
eBird's explicit approval for the proposed request pattern. Checklist feeds are
capped, and the checklist-detail documentation explicitly warns against bulk
downloads. A location × week × year background crawler could create excessive
requests, miss capped checklists, and violate the intended API use. It is not a
Phase 3 fallback unless a bounded proof of concept establishes a complete
denominator and eBird approves its production operation.

### Optional destination enrichment

A later integration may add access, parking, hours, habitat, trail, or local
birding-guide information. These attributes must retain provenance and
freshness dates. In their absence, Birdtrip should link to eBird and maps and
state that the user must verify access.

## Proposed search pipeline

### 1. Build an actual corridor

Decode the driving route into a polyline and treat `radiusKm` as a geometric
distance from that complete polyline.

Generate API sample points based on route length and the hotspot-directory
query-radius limit, rather than always using 14 points. The eBird hotspot
directory supports a radius up to 500 km, unlike the nearby-observation
endpoint's 50 km maximum. Birdtrip should initially cap discovery queries at
200 km to avoid unbounded dense-region payloads, let the sample count scale with
route length up to 16 calls, then verify the upstream contract and tune both
operational limits with measurements.

Each query circle may be wider than the user-requested corridor; returned
hotspots are then filtered by their exact minimum distance to the route
polyline. The wider query radius is an implementation detail and must never be
used as or displayed as the hotspot's “off route” distance.

For sample spacing `s` and corridor radius `r`, use a query radius large enough
to cover the midpoint between samples, bounded by Birdtrip's operational maximum.
If that maximum cannot cover the requested geometry, reduce `s`. Apply the
documented request ceiling and tell the user if the route was only partially
scanned; do not silently call it complete coverage.

For a straight route with the corridor offset perpendicular to the segment, the
optimistic maximum spacing is:

```text
s = 2 * sqrt(queryRadiusKm^2 - corridorRadiusKm^2)
```

That is not a safe guarantee for arbitrary curves. Use the conservative bound
`s <= 2 * (queryRadiusKm - corridorRadiusKm)` when planning samples, then verify
coverage against the actual route geometry. With a 200 km query radius and 16
discovery calls, the initial guaranteed route-length limits are approximately
5,250 km at a 25 km corridor and 4,500 km at a 50 km corridor. Routes longer
than the calculated limit are explicitly partial unless the operational call
ceiling is raised.

The route-distance helper must compare a point with every relevant polyline
segment, not only with the nearest sampled route point.

### 2. Discover locations independently of recency

At each route sample, call the hotspot-directory endpoint without `back` and
deduplicate by eBird location ID. Filter the merged results to hotspots whose
true distance to the route is no greater than `radiusKm`.

For area mode, make the same directory call around the area center without
`back` and filter by exact center distance.

Candidate records begin with stable discovery fields:

```js
{
  id,
  locId,
  name,
  lat,
  lng,
  routeDistanceKm,
  latestObservationDate,
  allTimeSpeciesCount,
  discoverySources: ["ebird-hotspot"]
}
```

Merge in:

- locations from the existing nearby-recent circle feed, used as a cheap
  current-activity prior rather than as a complete location inventory; and
- candidates found through explicit target-species lookups.

The circle feed remains approximately one request per activity sample and does
not gate discovery. A directory hotspot receives a neutral activity prior when
it does not appear in the circle feed, not a zero-quality judgment. Do not
include a personal location as a general destination unless another source
establishes that it is public. Preserve the source of every candidate.

### 3. Apply a broad, high-recall shortlist

Routing and fetching per-hotspot evidence for every hotspot on a continental
drive is too expensive. Create a broad shortlist using:

- approximate route distance;
- all-time species count with a logarithmic or capped transform;
- latest visit/report date as a weak signal;
- presence and freshness in the nearby-recent circle feed as a weak current
  activity prior;
- explicit target or unseen-species rescue;
- geographic diversity along the trip.

All-time species count and circle-feed activity are complementary priors. The
first protects an established but currently quiet hotspot; the second protects
a currently active but lower-all-time location. Neither is “birds you will
see,” and neither may dominate the final score.

Avoid allowing one dense metro area to consume the shortlist. Divide the route
into distance bands and preserve a minimum number of strong candidates per band
before filling the remaining global slots. Always preserve candidates found by
an explicit target lookup, subject to a separately communicated safety ceiling.

Area mode uses the same shortlisting principles, substituting distance bands
along a route with geographic cells or radial sectors around the center. Replace
the current 70% hard-capped all-time-richness priority with a `log1p` transform,
the activity prior, geographic diversity, and target/unseen-species rescues. A
hard cap is not used because it collapses ordering among the strongest hotspots
after removing the recent-visit filter.

### 4. Fetch per-hotspot evidence for the broad shortlist

For up to 40 shortlisted hotspots, fetch recent observations using the
per-hotspot endpoint in bounded parallel batches. Area mode already performs
this kind of fetch; Phase 1 extends it to route mode. Do not construct a
hotspot's recent species inventory from the nearby-circle endpoint.

Attach:

- target and unseen-species matches from those per-hotspot observations;
- freshness-weighted recent species evidence;
- failure and truncation flags.

The selected recent window controls which current reports are fetched and
displayed. A fixed decay function controls freshness weighting, so the same
seven-day-old report does not become more valuable merely because the user
changes the cutoff from 14 to 30 days. An observation with an unparseable date
still counts in the raw “species returned by the recent endpoint” display. It
earns zero in every freshness-weighted score and may be displayed with “date
unavailable,” rather than silently receiving today's middling `0.5` weight.

Raise each circle-feed request from 500 to an initial 1,000 results. If a
response length reaches the requested maximum, mark that sample truncated, show
a partial-data warning, and halve positive activity-prior weight originating
from that sample. Absence from a truncated sample remains unknown/neutral. Tune
the result limit and downweighting factor from dense-region fixtures.

### 5. Select the routing cohort and calculate exact route impact

Select an initial cohort of up to `max(maxStops, 15)`, capped at 20, for exact
detour requests. Do not simply take the top recent-species totals. Reserve the
routing cohort as follows, redistributing unused slots among the other groups:

- roughly 60% highest combined stable-prior and current-evidence candidates;
- at least 20% established-hotspot candidates with weak or absent current
  evidence; and
- at least 20% geographic-diversity, explicit-target, or unseen-species rescues.

Request origin -> candidate -> destination routes for that cohort with bounded
concurrency. Discard candidates outside the maximum-added-time budget. Retain
both added minutes and added distance.

If the first round yields fewer than `maxStops` practical candidates and
evidence-enriched shortlist candidates remain, route an adaptive second cohort.
Stop when the requested result count is filled, the shortlist is exhausted, or
the total ceiling of 40 exact-route calls is reached. Apply the same cohort
diversity rules to the second round. The second round costs nothing on the
common path but preserves result yield for strict detour budgets.

When the routing provider fails, mark route impact unknown rather than treating
the candidate as biologically poor. It may be omitted from the ranked list but
can appear under “Could not evaluate.” Fetch nearby notable reports and
seasonal evidence, when available, only for the practical candidates that can
still appear in results.

### 6. Rank recommendations

Use explicit score components rather than one undifferentiated bird count.
Recommended base weights when seasonal data is available:

| Component | Points | Purpose |
| --- | ---: | --- |
| Route practicality | 30 | Added time and distance within the user's budget |
| Seasonal place value | 25 | Expected richness and useful encounter frequencies for the trip date |
| Current evidence | 20 | Fresh per-hotspot reports with fixed time decay |
| Personal value | 20 | Targets and species absent from the imported list |
| Data confidence | 5 | Checklist sample size, years represented, and freshness |

Notable reports do not receive a generic quality bonus. A nearby rarity may be
surfaced prominently, and it may contribute through an explicit target or a
species absent from the imported list, but it should not imply that the
underlying destination is broadly better.

Without seasonal data, use a provisional score:

| Component | Points |
| --- | ---: |
| Route practicality | 40 |
| Current evidence | 35 |
| Stable hotspot prior | 10 |
| Personal value | 15 |

The stable hotspot prior may use capped all-time richness and latest recorded
visit, with copy stating that it is historical context. Do not label the output
as encounter likelihood.

Scores are normalized to 100 using the components enabled for the whole search:

```text
score = 100 * sum(component points earned) / sum(enabled component maxima)
```

When no life list or targets exist, personal value is disabled for every
candidate and the denominator shrinks. When personal data exists, the component
is enabled for every candidate and a candidate with no matches earns zero.
This fixes the current 115-point maximum without a life list versus 133-point
maximum with one.

Seasonal scoring is enabled when the selected source covers at least 70% of the
candidates eligible for the displayed result cohort; calibrate that threshold
before launch. This avoids making EBD-derived frequency unusable whenever a
quiet or new hotspot lacks enough complete checklists.

Structurally uncovered candidates receive the search cohort's median covered
seasonal component as a neutral prior and an explicit **No seasonal data** flag.
They are neither rewarded nor penalized merely for missing coverage. Covered
EBD estimates are shrunk toward that neutral prior according to checklist sample
size so a tiny sample cannot create an extreme score. If coverage is below the
threshold, use the provisional model for every candidate and show available
seasonal facts as enrichment only.

This structural-absence rule is distinct from a transient request failure. A
candidate whose source should be available but fails to load earns no points for
that component and receives lower confidence; the failure is not normalized
away. Status and Trends' broader grid coverage is therefore an explicit product
advantage, not an accidental prerequisite created by the scoring rule.

Saved trips retain `scoringVersion`, enabled components, and source
availability. Trips saved before score versioning retain their stored number
with a **Legacy score** label and are never silently recalculated. Running the
search again creates current-version scores.

### 7. Produce species groups

For each recommended destination, construct non-overlapping presentation
groups:

1. **Your targets:** matching current or seasonal evidence, with evidence type.
2. **Likely this season:** highest-frequency species that clear both a frequency
   threshold and a minimum complete-checklist threshold.
3. **Reported recently:** fresh reports not already shown above, sorted by
   report age.
4. **Local specialties:** place-vs-region frequency highlights, when available.
5. **Rare reports nearby:** distance and report date always shown; never folded
   into the stop's own species list.

Do not show only the most common birds. The preview should balance decision
value with honesty: targets first, then distinctive likely species, then a
compact indication of expected common species.

## Confidence

Confidence is a statement about the evidence, not the destination's quality.

Initial levels:

- **High:** adequate complete-checklist sample across multiple years and a
  recent visit/report.
- **Medium:** adequate historical sample but weak current evidence, or strong
  current evidence with a limited historical sample.
- **Low:** small historical sample, only one contributing observer/year, stale
  location activity, truncated requests, or a failed evidence source.
- **Current reports only:** no qualified seasonal dataset is available.

Exact thresholds should be calibrated against real locations before launch. A
starting proposal is at least 20 complete checklists for the seasonal period and
at least three represented years for high-confidence frequency. The UI should
show the underlying sample, for example “reported on 42% of 86 complete
checklists,” rather than only a badge.

No-results and partial-data states must identify which layer failed:

- no known public hotspots in the corridor;
- hotspots found, but none within the detour budget;
- destinations ranked, but recent eBird data unavailable;
- current reports available, but seasonal likelihood unavailable;
- route coverage limited by the request ceiling.

## UI design

### Result card

Each card answers three questions in order:

1. **Why go here?** “Strong seasonal variety · 18 min added” or, without
   seasonal data, “32 species reported recently · 18 min added.”
2. **What is the evidence?** Separate `Likely`, `Recent`, `Targets`, and
   `Confidence` indicators.
3. **What is the tradeoff?** Added time, added distance, route position, and any
   access-data warning.

Replace the generic feather number with a labeled value in expanded views. A
tooltip can clarify it, but the primary distinction between “likely” and
“recent” should not depend on hover.

### Details drawer

Add a “Why this stop” section containing the score breakdown and evidence date.
Species sections use the groups above. Each species row states its basis:

- “Likely · 48% of 112 complete checklists in early August”
- “Recent · reported 2 days ago”
- “Target · recent report 6 days ago”
- “Rare nearby · 4.2 km away, reported yesterday”

If only recent data exists, say so once at the top:

> Seasonal likelihood is not available for this location. These are recent
> reports, not predictions.

### Search controls

Rename **Recent** to **Recent reports**. Its helper text should explain that it
changes the evidence displayed, not the historical destination catalog. Update
progress and empty-state copy that currently describes route scanning as only
“requesting recent observations”; Phase 1 first discovers known hotspots, then
checks current evidence.

When seasonal data exists, use the planned trip date rather than today's date
to select the seasonal period. If no trip date exists, default to the current
week and state that assumption.

## API and data-model changes

### Server routes

- Change `/api/ebird/hotspots` so `back` is optional. Omit it from the upstream
  request when absent.
- Raise its validated `dist` ceiling from the nearby-observation limit of 50 km
  to the hotspot-directory limit of 500 km. Keep Birdtrip's initial operational
  query radius at or below 200 km and add a contract test for the upstream
  parameter boundary.
- Add a bounded batch endpoint or server-side orchestration for hotspot details
  if per-finalist browser requests create unacceptable latency. Preserve
  per-location cache keys.
- Add `/api/likelihood?locId=...&date=YYYY-MM-DD` only after a licensed seasonal
  dataset exists. Its response includes frequency, numerator, denominator,
  years represented, model/data version, and refresh date.

### Candidate model

Introduce an explicit evidence shape rather than storing every concept directly
on the candidate:

```js
candidate.evidence = {
  recent: {
    status: "complete" | "failed" | "truncated",
    windowDays,
    fetchedAt,
    observations
  },
  seasonal: {
    status: "complete" | "unavailable" | "low-sample" | "failed",
    period,
    sourceVersion,
    species
  },
  notableNearby: {
    status,
    radiusKm,
    observations
  }
};
```

Add `scoringVersion` and component maxima to saved candidates. Serialization
must turn maps and sets into plain arrays as it does today.

## Performance and limits

Initial ceilings are product safeguards to measure and tune, not claims about
eBird quota. A default route search uses:

| Work | Initial ceiling | Concurrency |
| --- | ---: | ---: |
| Hotspot-directory discovery | 16 calls | 4 |
| Nearby-recent activity prior | 14 calls | 4 |
| Per-hotspot recent evidence | 40 locations | 4 |
| Exact detour routes | 20 initially; 40 after adaptive refill | 3 |
| Per-finalist notable evidence | `maxStops`, at most 20 | 4 |
| Explicit target lookups | 10 targets | 2 |

The initial performance target is p95 under 30 seconds for a route up to 1,500
km with the default 10 displayed stops, measured with a warm server process but
without assuming a warm response cache. Searches that exceed discovery coverage
or request ceilings return the covered portion with a conspicuous partial-scan
warning. They do not silently lower recall.

The pipeline may overlap independent work within those ceilings:

- Start hotspot-directory discovery and nearby-recent activity-prior requests
  together for each available sample instead of completing one entire stage
  before beginning the other.
- As soon as a routed candidate is confirmed practical, enqueue its notable
  request while remaining route calls continue.
- Preserve the independent eBird and routing concurrency pools so one provider
  does not block unrelated work.

- Cache hotspot-directory queries by rounded coordinates and query radius.
- Cache recent hotspot observations by location, window, and date bucket.
- Cache seasonal data by location and seasonal period; it changes much more
  slowly than recent observations.
- Limit concurrency for eBird and routing calls independently.
- Use a two-stage shortlist so discovery remains broad but exact route and
  per-hotspot calls remain bounded.
- Surface request truncation; never treat a capped response as a complete list.
- Record enough development telemetry to compare discovered, shortlisted,
  practical, and displayed candidate counts without recording the user's API
  token or life list.
- Measure the number and serialized size of candidates surviving exact corridor
  filtering in every baseline fixture. Set any retained-candidate memory ceiling
  only from those measurements; arbitrary dropping at this stage would violate
  the candidate-recall goal.

## Rollout

### Phase 1: Stop missing known hotspots

- Add a test runner using Node's built-in `node:test` and extract the pure route
  geometry and shortlist helpers into testable functions.
- Establish and record the current recall and latency baseline before changing
  discovery.
- Discover from the hotspot directory without a recent filter.
- Replace 14 fixed samples with coverage-based sampling and exact polyline
  distance filtering.
- Retain the nearby-recent feed as a weak shortlist prior.
- Detect and downweight truncated nearby-recent activity samples.
- Preserve established-but-quiet, geographic-diversity, and target candidates
  during shortlisting.
- Replace area mode's capped all-time-richness shortlist with the shared
  log-transformed, activity-aware, diversity-preserving rules.
- Fetch recent species per hotspot before spending exact route calls.
- Refill the exact-routing cohort adaptively when the first round cannot satisfy
  the requested result count within the detour budget.
- Enforce the initial API, routing, concurrency, and latency budgets.
- Change copy from “likely” to “reported recently” wherever only occurrence
  data supports it, including every current **Likely lifer** label.
- Update progress, empty-state, saved-trip, and report copy for the new pipeline.

This phase uses only the current API and delivers the largest correctness gain.

### Phase 2: Improve recommendation quality

- Introduce fixed freshness decay and the provisional score weights.
- Normalize every score to 100 using search-wide enabled components.
- Add confidence and partial-data states.
- Remove generic notable-species scoring.
- Version saved scores and display an evidence-based “Why this stop.”

### Phase 3: Add defensible likelihood

- Confirm licensing and operational access to historical complete-checklist or
  modeled frequency data.
- Decide between EBD hotspot frequency and Status and Trends grid-cell
  occurrence/abundance, including the different user-facing claims they permit.
- Investigate—but do not assume approval for—a bounded historical live-API
  bridge.
- Build and validate the seasonal aggregation.
- Add “Likely this season,” specialties, sample sizes, and the final score.
- Calibrate thresholds across dense and sparse eBird regions.

### Phase 4: Add destination context

- Integrate sourced access, habitat, parking, hours, and local guidance.
- Add explicit stale/unknown states and user-facing verification links.

## Validation

### Candidate-recall benchmark

Create a reproducible fixture set of routes and areas. Ground truth has two
layers:

1. **Catalog recall:** every eBird directory hotspot geometrically inside the
   fixture corridor must be present in the unpruned discovery output, unless the
   search explicitly reports partial coverage.
2. **Must-consider recall:** per 100 km route band, include the five highest
   all-time-richness directory hotspots plus any destination identified by a
   cited regional bird-finding guide, public land manager, or recognized birding
   organization. Reviewers record why each curated addition qualifies.

The fixture set includes:

- short urban route with dense eBird coverage;
- long cross-country route;
- rural route with sparse reporting;
- migration hotspot outside its peak week;
- internationally well-known hotspot in a lower-coverage region;
- hotspot just inside and just outside the corridor boundary;
- destination with no report in the last 14 days;
- target-species location that would otherwise rank below the shortlist.

Before implementation, run the fixture set against `origin/main` and save its
catalog recall, must-consider recall, request counts, and latency as the
baseline. Phase 1 is successful when every fully covered in-corridor fixture
hotspot enters discovery and every within-budget must-consider location reaches
exact detour evaluation. Ranking quality is evaluated separately from recall.

### Species-claim benchmark

For locations with sufficient seasonal data:

- Verify displayed frequency against the source numerator and denominator.
- Ensure low-sample frequencies never receive “likely” wording.
- Ensure a recent rarity is shown as recent/notable, not likely.
- Ensure a historically common seasonal species can be likely without a report
  in the recent window.
- Ensure nearby notable reports are not attributed to the hotspot itself.
- Ensure changing the recent window does not change the freshness weight of an
  observation already inside both windows.

### Technical verification

- Add `npm test` backed by Node's built-in test runner; the repository currently
  has lint but no test command or test directory.
- Unit-test point-to-polyline distance and coverage sample generation.
- Unit-test deduplication across overlapping hotspot queries.
- Unit-test shortlisting diversity and target preservation.
- Unit-test score normalization, missing components, and scoring versions.
- Test complete, failed, partial, and truncated evidence states.
- Compare API request counts and end-to-end latency on representative routes.
- Run the existing lint and browser verification flows.

## Success metrics

- Catalog recall for every fully covered fixture corridor.
- Must-consider recall for the reproducibly curated benchmark set.
- Percentage of displayed destinations backed by a complete per-hotspot recent
  fetch.
- Percentage of “likely” species claims meeting the configured sample threshold.
- Search completion and partial-data rates.
- Median and 95th-percentile search latency and upstream request count.
- Stop-detail opens, direction clicks, and pinned-stop rate by confidence level.
- User-reported “missing major hotspot” and “misleading species expectation”
  incidents.

## Risks and mitigations

- **More comprehensive discovery increases API and routing work.** Use adaptive
  sampling, caching, geographic quotas, and a broad two-stage shortlist.
- **All-time richness favors old and heavily birded locations.** Apply a
  logarithmic transform and use it only as a weak prior before per-location
  evidence is loaded; do not hard-cap away ordering among strong hotspots.
- **Frequency still contains observer and effort bias.** Use complete checklists,
  minimum samples, multiple years, and clear confidence—not false precision.
- **Historical data may not be available under suitable terms.** Phase 1 and 2
  remain independently useful and avoid likelihood language.
- **Sparse regions will look less certain.** Show uncertainty explicitly rather
  than silently preferring a well-reported but inferior destination.
- **Hotspot coordinates do not describe exact boundaries or access.** Treat them
  as navigation anchors, link to source pages, and require access verification.
- **Very large hotspot-directory radii return large dense-region payloads.** Use
  the API's larger radius to reduce sample gaps, but enforce the lower
  operational cap, response-size measurements, caching, and partial-scan state.

## Decisions to confirm

1. Use the stronger “likely to see” promise only after a qualified seasonal
   frequency source is operational.
2. Prioritize Phase 1 candidate recall before changing the visual score.
3. Treat nearby notables as alerts, not a generic destination-quality score.
4. Use the trip date, when available, to determine the seasonal period.
5. Keep non-hotspot personal locations out of general recommendations unless a
   separate source establishes public access.
6. Require written data-product permission before Phase 3 and choose whether the
   claim is hotspot checklist frequency (EBD) or area-level modeled expectation
   (Status and Trends).
7. Normalize scores to 100 using search-wide enabled components and retain old
   saved scores as labeled legacy values.

## References

- [eBird API 2.0](https://documenter.getpostman.com/view/664302/S1ENwy59)
- [eBird Hotspot FAQs](https://support.ebird.org/en/support/solutions/articles/48001009443-ebird-hotspot-faqs)
- [eBird bar charts and graphs](https://support.ebird.org/en/support/solutions/articles/48001255130-ebird-bar-charts-and-graphs)
- [Explore eBird Hotspots](https://support.ebird.org/en/support/solutions/articles/48001280356-explore-ebird-hotspots)
- [Complete checklists](https://support.ebird.org/en/support/solutions/articles/48000967748-birding-as-your-primary-purpose-and-complete-checklists)
- [Download eBird data](https://support.ebird.org/en/support/solutions/articles/48000838205-download-ebird-data)
- [eBird data privacy and data use](https://support.ebird.org/en/support/solutions/articles/48001078113)
- [Status and Trends products terms](https://science.ebird.org/en/status-and-trends/products-access-terms-of-use)
- [Status and Trends data products](https://science.ebird.org/en/use-ebird-data)
