# Birdtrip Design

## Goal

Build a local web app that helps a birder decide where to stop while driving from one place to another. The central workflow is:

1. Enter an origin and destination.
2. Set a maximum allowed detour, recent-observation window, and route search radius.
3. Find birding locations near the route.
4. Rank stops by birding value and practical route cost.
5. Inspect recent species, notable birds, and route impact before choosing stops.

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
  - Nearby recent observations: `/v2/data/obs/geo/recent`
  - Nearby recent notable observations: `/v2/data/obs/geo/recent/notable`
  - Recent observations of a single species: `/v2/data/obs/geo/recent/{speciesCode}`
  - eBird taxonomy (`/v2/ref/taxonomy/ebird`), loaded once and cached in memory for species name → code lookup and autocomplete.

The app accepts an API token in the UI and stores it in browser local storage. The server can also read `EBIRD_API_KEY` from the environment.

## Search Modes

- **Route** (default): rank birding stops along a driving corridor between origin and destination, filtered by an added-time detour budget.
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
- Recent species count.
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

Candidate score is intentionally transparent:

- Recent species count: up to 45 points.
- Checklist activity proxy, represented by observation records: up to 15 points.
- Notable observations: up to 20 points.
- Target matches: up to 15 points.
- Route practicality: up to 20 points, reduced as added minutes approach the user limit.

The score is a planning heuristic, not an objective quality rating. Stops over the detour budget are excluded.

## Route-Corridor Algorithm

1. Geocode origin and destination.
2. Request a driving route from the selected routing provider.
3. Sample points along the route at roughly even intervals.
4. For each sampled point, request nearby eBird observations within the corridor radius.
5. Group observations into candidate locations by eBird location ID when available, otherwise by rounded coordinates.
6. For each candidate:
   - Estimate route distance from sampled route point.
   - Request a route from the selected provider for origin -> candidate -> destination.
   - Compute added minutes against the direct route.
   - Fetch notable observations near the candidate.
   - Score and rank.
7. Return the top candidates by score after detour filtering.

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
