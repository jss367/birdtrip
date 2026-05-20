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
- Do not expose unrestricted Google keys. Restrict the browser key by hostname and the server key by API and deployment environment.
- The app does not store user data on the server. Optional token persistence is browser-local only.
