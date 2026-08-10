# Birdtrip Design

## Goal

Build a local web app that helps a birder decide where to stop while driving from one place to another. The central workflow is:

1. Enter an origin and destination.
2. Set a maximum allowed detour, recent-report window, and route search radius.
3. Discover known public eBird hotspots throughout the route corridor independently of recent reports.
4. Rank stops by current evidence, hotspot history, personal value, and practical route cost.
5. Inspect species reported recently, nearby notable birds, evidence confidence, and route impact before choosing stops.

The first version should be useful for real trip planning without requiring paid map keys. It should also degrade cleanly when the user does not provide an eBird API token.

## Users

- Birders planning a drive who are willing to add limited time for good stops.
- Birders looking for target species or lifers near a route.
- Travelers who need quick decisions from a map plus a ranked list, rather than a broad regional hotspot browser.

## Core Jobs

- Plan birding stops along a route within a specific detour budget.
- Compare candidate stops by recent activity, species count, notable observations, and access to the route.
- Review recent species at each stop.
- Save enough trip context locally to resume planning during a session.
- Export or print a route summary.

## Non-Goals

- Replace a field guide, checklist submission tool, or official observation record.
- Provide guaranteed access, parking, hours, or trail safety information.
- Optimize a multi-stop itinerary with exact traffic forecasts.
- Store user credentials on a remote service.

## Data Sources

### Routing and Geocoding

- OpenStreetMap mode:
  - Geocoding: Nominatim public endpoint through the local server.
  - Routing: OSRM public route endpoint through the local server.
  - Map: Leaflet with OpenStreetMap tiles.
- Google Maps mode:
  - Geocoding: Google Geocoding API through the local server.
  - Routing: Google Routes API through the local server.
  - Map: Google Maps JavaScript API in the browser.

The public endpoints are appropriate for local/personal use and demos. A production deployment should switch to a provider with clear quotas and service guarantees.

### Bird Data

- eBird API endpoints accessed through the local server:
  - Nearby recent observations: `/v2/data/obs/geo/recent` (route/area activity prior only; returns the most recent observation per species across the whole circle)
  - Nearby hotspot directory: `/v2/ref/hotspot/geo` without a recent-visit filter (route and area candidate discovery)
  - Recent observations at a hotspot: `/v2/data/obs/{locId}/recent` (per-location evidence in route and area modes)
  - Nearby recent notable observations: `/v2/data/obs/geo/recent/notable`
  - Recent observations of a single species: `/v2/data/obs/geo/recent/{speciesCode}`
  - eBird taxonomy (`/v2/ref/taxonomy/ebird`), loaded once and cached in memory for species name → code lookup and autocomplete.

The app accepts an API token in the UI and stores it in browser local storage. The server can also read `EBIRD_API_KEY` from the environment.

## Search Modes

- **Route** (default): discover known hotspots along the complete driving corridor, fetch per-hotspot current evidence, then rank practical stops within an added-time detour budget.
- **Area**: rank birding hotspots within a radius of a single location.
- **Species**: answer "show me all the X sightings in this area." Pick a species (autocomplete backed by the eBird taxonomy) and a location, then map every recent sighting of that species within the radius. Sightings are grouped by location into individual map pins (not score-ranked hotspots); each pin and list row shows the report count, highest count seen, and how recent the latest sighting is.

## Product Shape

### Search Panel

Controls:

- Origin
- Destination
- Maximum added minutes
- Route corridor radius in kilometers
- Recent days window
- Max candidate stops
- eBird API token
- Optional target species common-name text area

Primary action:

- Find stops

Secondary actions:

- Use sample route
- Clear results
- Print report

### Map

The map should occupy the main workspace and show:

- The driving route.
- Candidate stop markers.
- Marker style indicating score tier.
- Selected stop details in a popup.

### Ranked Stops

Each stop row should show:

- Rank and name.
- Birding score.
- Added driving time.
- Distance from route approximation.
- Species reported within the selected recent-report window.
- Notable observation count.
- Matched target species count.
- Short recent-species preview.
- Links to open the location in map directions and eBird search context when possible.

### Details Drawer

Selecting a stop shows:

- Stop summary.
- Score explanation.
- Recent species list grouped by common name.
- Notable observations.
- Matched targets.
- Route impact.

### Report

A print-friendly report includes:

- Search parameters.
- Route summary.
- Ranked stops.
- Species and notable highlights.

## Scoring

Candidate score is intentionally transparent and normalized to 100 using the
components enabled for the whole search:

- Route practicality or area proximity: up to 40 raw points.
- Current per-hotspot evidence: up to 35 raw points, with a fixed seven-day
  freshness half-life independent of the selected cutoff.
- Stable hotspot-history prior: up to 10 raw points, using log-transformed
  all-time richness rather than a hard cap.
- Personal value: up to 15 raw points when targets or an imported list exist.

Nearby notable reports are displayed as alerts and do not generically increase
destination quality. Species absent from an imported list are described as
“unseen recent reports,” not “likely lifers.” Scores saved under the older model
remain labeled legacy scores and are not silently recalculated.

The score is a planning heuristic, not an objective quality rating. Stops over the detour budget are excluded.

## Route-Corridor Algorithm

1. Geocode origin and destination.
2. Request a driving route from the selected routing provider.
3. Generate coverage-based directory samples, up to 16, and report when a route
   is too long for complete coverage under the request ceiling.
4. In parallel, request the unfiltered hotspot directory and a bounded nearby-
   recent feed used only as a current-activity prior.
5. Deduplicate hotspots and filter them by minimum distance to the complete
   route polyline, not distance to sampled points.
6. Build a geographically diverse 40-hotspot shortlist using log-transformed
   history, current activity, route proximity, targets, and unseen-species
   rescues.
7. Fetch recent observations at each shortlisted hotspot so every displayed
   species count is per-location evidence. Quiet hotspots remain candidates.
8. Route an initial diverse cohort with concurrency three. If too few candidates
   meet the detour budget, adaptively route a second cohort, up to 40 total.
9. Fetch nearby notable reports for practical finalists, score, and return the
   requested number of stops.

This is deliberately bounded to protect public APIs: the client limits sample count and candidate count, while the server caches repeated requests in memory.

## Architecture

```
route_birding_planner/
  DESIGN.md
  README.md
  package.json
  server.js
  public/
    index.html
    styles.css
    app.js
```

### Server

The server is a small Node HTTP service with no runtime dependencies. It serves static assets and exposes JSON endpoints:

- `GET /api/geocode?q=...`
- `GET /api/route?origin=lng,lat&destination=lng,lat`
- `GET /api/route-via?origin=lng,lat&via=lng,lat&destination=lng,lat`
- `GET /api/ebird/recent?lat=...&lng=...&dist=...&back=...`
- `GET /api/ebird/notable?lat=...&lng=...&dist=...&back=...`

It provides:

- Request validation.
- API-key forwarding for eBird.
- Simple in-memory caching.
- User-agent headers for public map services.
- Consistent error JSON.

### Client

The client is vanilla JavaScript so this tool remains easy to inspect and run. Responsibilities:

- Manage form state.
- Call server endpoints.
- Compute candidate grouping and scoring.
- Render map, result list, details, and report.
- Persist non-sensitive preferences plus the optional local token.

## Error Handling

- Missing eBird token: route still loads; app explains live bird data requires a token.
- Geocoding failure: show a specific field-level message.
- Routing failure: show the endpoint response when available.
- Bird API failure: keep route visible and show a recoverable warning.
- Empty results: suggest widening radius, increasing recent days, or increasing detour budget.

## Privacy

- No server-side persistence.
- eBird token can be stored locally in the browser at the user's choice.
- Uploaded or entered target lists never leave the local app except as query-driving context for local scoring.

## Future Work

- Import eBird life-list CSV/ZIP and rank lifers.
- Use provider-backed matrix routing for faster detour evaluation.
- Add seasonality from historical bar-chart style summaries.
- Add access notes from curated public land or birding-location datasets.
- Support multi-stop itinerary optimization.
- Add offline report export.
