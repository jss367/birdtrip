# Birdtrip

A route-first birding planner for [birdtrip.org](https://birdtrip.org). Birdtrip finds birding stops along a driving route within a maximum detour budget, then ranks them using recent eBird observations, notable sightings, target species, and route impact.

## Run

```sh
npm start
```

Then open `http://localhost:4177`.

## Launch

See [DEPLOY.md](./DEPLOY.md) for production hosting, DNS, Docker, and environment-variable notes.

## Map Services

Birdtrip can run on OpenStreetMap services or Google Maps.

OpenStreetMap is the default and does not need a map key:

```sh
npm start
```

Google Maps mode needs a browser key for the Maps JavaScript API and a server key for Geocoding API and Routes API requests:

```sh
MAP_PROVIDER=google \
GOOGLE_MAPS_BROWSER_KEY=... \
GOOGLE_MAPS_SERVER_KEY=... \
npm start
```

For local experimentation, `GOOGLE_MAPS_API_KEY=...` can be used as a single key for both browser and server requests. Production deployments should use restricted keys.

## Bird Data

Live bird data uses the eBird API. Either:

- paste an eBird API token into the app, or
- start the server with `EBIRD_API_KEY=... npm start`.

You can also import an eBird or iNaturalist CSV/TSV life list in the app. Imported common names, scientific names, and eBird species codes stay in the browser and highlight recent reports of species not on your list.

OpenStreetMap mode uses public Nominatim and OSRM demo endpoints for geocoding and routing. That is fine for local experimentation, but a production deployment should use services with explicit quotas.
