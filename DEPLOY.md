# Deploy Birdtrip

Birdtrip is a small Node HTTP app. It serves the static UI from `public/` and exposes API proxy routes from `server.js`.

## Required Runtime

- Node 18 or newer
- `npm start`
- Port from `PORT`, defaulting to `4177`
- Health check path: `/healthz`

## Environment

OpenStreetMap mode works without map credentials.

```sh
PORT=4177
EBIRD_API_KEY=optional_server_side_token
```

Google Maps mode is optional and needs both browser and server keys:

```sh
MAP_PROVIDER=google
GOOGLE_MAPS_BROWSER_KEY=...
GOOGLE_MAPS_SERVER_KEY=...
```

If `EBIRD_API_KEY` is unset, visitors can paste their own eBird token in the app. For a public launch, a server-side token makes the first run smoother, but monitor eBird API usage and quotas.

Shared trip links (`/t/<slug>`) are optional and need a Postgres database:

```sh
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
```

Any managed Postgres works; Neon's free tier is a good fit since Render's free plan has no persistent disk. The app creates its own `trips` table on first use. If `DATABASE_URL` is unset, the share button falls back to long query-parameter links and everything else works unchanged. Shared trips that go unopened for 90 days are deleted automatically (swept opportunistically on writes — no cron needed).

### Caching and rate limiting

The server uses a bounded in-memory cache for successful upstream responses and coalesces concurrent identical requests. Defaults can be tuned with:

```sh
# General and service-specific cache lifetimes, in milliseconds.
CACHE_TTL_MS=600000
EBIRD_CACHE_TTL_MS=600000
GEOCODING_CACHE_TTL_MS=86400000
ROUTING_CACHE_TTL_MS=600000
CACHE_MAX_ENTRIES=1000
CACHE_MAX_BYTES=33554432
CACHE_MAX_ENTRY_BYTES=2097152

# Per-client API request limit. Set API_RATE_LIMIT_MAX=0 to disable it.
API_RATE_LIMIT_MAX=300
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX_CLIENTS=10000
```

The cache is local to one server process and is emptied on restart. Multi-instance deployments should use a shared cache and distributed rate limiter if limits must apply across every instance.

Set `TRUST_PROXY=true` only when the app runs behind a trusted reverse proxy that replaces or safely appends `X-Forwarded-For`. `TRUST_PROXY_HOPS` selects the number of trusted entries from the right side of that header; it defaults to `1`, while a Render deployment behind one additional content delivery network proxy should use `2`. This lets the API and trip-creation limiters identify the originating client instead of combining unrelated visitors into a proxy-wide bucket; leave `TRUST_PROXY` unset for direct connections so spoofed headers are ignored. The included Render blueprint enables one trusted proxy hop.

## Render Blueprint

This repo includes `render.yaml`, which defines a Render web service named `birdtrip` on the free plan with:

- `npm install` as the build command.
- `npm start` as the start command.
- `/healthz` as the health check path.
- `birdtrip.org` as the custom domain.
- `EBIRD_API_KEY` and `DATABASE_URL` as manual secret values.

In Render, create a new Blueprint from this repository and provide `EBIRD_API_KEY` and `DATABASE_URL` when prompted (leave `DATABASE_URL` empty to run without shared trip links). After Render creates the service, open the service's Custom Domains page to copy the exact DNS records for your registrar.

## DNS For birdtrip.org

The domain does not need any app code changes. Point DNS at the host you choose:

- Apex `birdtrip.org`: use the host's A/AAAA records, ALIAS, or ANAME record.
- `www.birdtrip.org`: use a CNAME to the host-provided target.
- Add a redirect so one hostname is canonical. The app metadata uses `https://birdtrip.org/`.

After DNS is set, confirm:

```sh
dig +short birdtrip.org
dig +short www.birdtrip.org
# Use http:// instead until TLS is configured.
curl -I https://birdtrip.org/healthz
```

## Docker

```sh
docker build -t birdtrip .
docker run --rm -p 4177:4177 --env-file .env birdtrip
```

Then open `http://localhost:4177`.

## Production Notes

- The default OpenStreetMap setup uses public Nominatim, OSRM, and tile endpoints. That is fine for demos and personal use, but a public site should move to providers with explicit usage terms and quotas.
- In-memory caching and per-instance rate limiting reduce repeated traffic, but they do not change upstream service terms or coordinate limits across multiple app instances.
- Do not expose unrestricted Google keys. Restrict the browser key by hostname and the server key by API and deployment environment.
- The only server-side storage is opt-in shared trips: anonymous search-input snapshots keyed by unguessable slugs, expiring after 90 days without an open. Optional eBird token persistence is browser-local only.
