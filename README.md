# Birdtrip

A local web app for finding birding stops along a driving route within a maximum detour budget.

## Run

```sh
npm start
```

Then open `http://localhost:4177`.

## Bird Data

Live bird data uses the eBird API. Either:

- paste an eBird API token into the app, or
- start the server with `EBIRD_API_KEY=... npm start`.

The app uses public OpenStreetMap/Nominatim and OSRM demo endpoints for geocoding and routing. That is fine for local experimentation, but a production deployment should use a provider with explicit quotas.
