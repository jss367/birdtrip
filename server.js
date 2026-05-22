const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4177);
const PUBLIC_DIR = path.join(__dirname, "public");
const CACHE_TTL_MS = 10 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 15000;
const MAP_PROVIDERS = new Set(["osm", "google"]);
const DEFAULT_MAP_PROVIDER = MAP_PROVIDERS.has(process.env.MAP_PROVIDER)
  ? process.env.MAP_PROVIDER
  : "osm";
const GOOGLE_MAPS_BROWSER_KEY = process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_SERVER_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
const cache = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function logApiRequest(req, res, url) {
  const started = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - started;
    console.log(`[api] ${req.method} ${url.pathname}${url.search} ${res.statusCode} ${elapsed}ms`);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message, details) {
  sendJson(res, status, { error: message, details });
}

function cached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.time > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  cache.set(key, { time: Date.now(), value });
  return value;
}

function parseCoordPair(value, name) {
  if (!value) throw new Error(`${name} is required`);
  const [lng, lat] = value.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`${name} must be "lng,lat"`);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`${name} is outside valid coordinate bounds`);
  }
  return { lat, lng };
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

async function fetchJson(url, headers = {}) {
  const cacheKey = `${url} ${JSON.stringify(headers)}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "birdtrip/0.1 local personal app",
      ...headers
    }
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message = typeof body === "object" && body && body.message ? body.message : response.statusText;
    const error = new Error(message || "Upstream request failed");
    error.status = response.status;
    error.details = body;
    throw error;
  }

  return setCached(cacheKey, body);
}

async function postJson(url, payload, headers = {}) {
  const cacheKey = `${url} ${JSON.stringify(headers)} ${JSON.stringify(payload)}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "user-agent": "birdtrip/0.1 local personal app",
        ...headers
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Upstream request timed out");
      timeoutError.status = 504;
      timeoutError.details = { timeoutMs: UPSTREAM_TIMEOUT_MS };
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message = typeof body === "object" && body && body.error?.message
      ? body.error.message
      : response.statusText;
    const error = new Error(message || "Upstream request failed");
    error.status = response.status;
    error.details = body;
    throw error;
  }

  return setCached(cacheKey, body);
}

function mapProviderFrom(url) {
  const provider = String(url.searchParams.get("provider") || DEFAULT_MAP_PROVIDER).toLowerCase();
  return MAP_PROVIDERS.has(provider) ? provider : DEFAULT_MAP_PROVIDER;
}

function requireGoogleServerKey() {
  if (!GOOGLE_MAPS_SERVER_KEY) {
    const error = new Error("Google Maps server key is not configured");
    error.status = 400;
    error.details = "Set GOOGLE_MAPS_SERVER_KEY or GOOGLE_MAPS_API_KEY before using Google geocoding or routing.";
    throw error;
  }
  return GOOGLE_MAPS_SERVER_KEY;
}

async function geocodeOsm(q) {
  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("limit", "5");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("q", q);
  const results = await fetchJson(endpoint.toString());
  return results.map((item) => ({
    name: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
    type: item.type,
    importance: item.importance,
    provider: "osm"
  }));
}

async function geocodeGoogle(q) {
  const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  endpoint.searchParams.set("address", q);
  endpoint.searchParams.set("key", requireGoogleServerKey());
  const result = await fetchJson(endpoint.toString());
  if (result.status !== "OK" && result.status !== "ZERO_RESULTS") {
    const error = new Error(result.error_message || result.status || "Google geocoding failed");
    error.status = 502;
    error.details = result;
    throw error;
  }
  return (result.results || []).slice(0, 5).map((item) => ({
    name: item.formatted_address,
    lat: Number(item.geometry?.location?.lat),
    lng: Number(item.geometry?.location?.lng),
    type: Array.isArray(item.types) ? item.types[0] : "",
    importance: item.geometry?.location_type === "ROOFTOP" ? 1 : 0.7,
    placeId: item.place_id,
    provider: "google"
  })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

async function routeOsm(origin, destination, viaPoints = []) {
  const coords = [`${origin.lng},${origin.lat}`];
  viaPoints.forEach((via) => coords.push(`${via.lng},${via.lat}`));
  coords.push(`${destination.lng},${destination.lat}`);

  const endpoint = new URL(`https://router.project-osrm.org/route/v1/driving/${coords.join(";")}`);
  endpoint.searchParams.set("overview", "full");
  endpoint.searchParams.set("geometries", "geojson");
  endpoint.searchParams.set("steps", "false");
  endpoint.searchParams.set("alternatives", "false");
  const result = await fetchJson(endpoint.toString());
  if (result.code !== "Ok" || !result.routes?.length) {
    const error = new Error("No route found");
    error.status = 502;
    error.details = result;
    throw error;
  }
  const route = result.routes[0];
  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry,
    provider: "osm"
  };
}

function googleWaypoint(point) {
  return {
    location: {
      latLng: {
        latitude: point.lat,
        longitude: point.lng
      }
    }
  };
}

function parseGoogleDuration(value) {
  if (typeof value !== "string" || !/^\d+(\.\d+)?s$/.test(value)) return null;
  const seconds = Number(value.replace(/s$/, ""));
  return Number.isFinite(seconds) ? seconds : null;
}

async function routeGoogle(origin, destination, viaPoints = []) {
  const payload = {
    origin: googleWaypoint(origin),
    destination: googleWaypoint(destination),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
    computeAlternativeRoutes: false,
    polylineQuality: "HIGH_QUALITY",
    polylineEncoding: "GEO_JSON_LINESTRING",
    units: "IMPERIAL"
  };
  if (viaPoints.length) {
    payload.intermediates = viaPoints.map((via) => ({ ...googleWaypoint(via), via: true }));
  }

  const result = await postJson(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    payload,
    {
      "x-goog-api-key": requireGoogleServerKey(),
      "x-goog-fieldmask": "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring"
    }
  );
  if (!result.routes?.length) {
    const error = new Error("No route found");
    error.status = 502;
    error.details = result;
    throw error;
  }
  const route = result.routes[0];
  const distanceMeters = Number(route.distanceMeters);
  const durationSeconds = parseGoogleDuration(route.duration);
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    const error = new Error("Google route did not include usable distance/duration");
    error.status = 502;
    error.details = result;
    throw error;
  }
  const coordinates = route.polyline?.geoJsonLinestring?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    const error = new Error("Google route did not include a usable geometry");
    error.status = 502;
    error.details = result;
    throw error;
  }
  return {
    distanceMeters,
    durationSeconds,
    geometry: {
      type: "LineString",
      coordinates
    },
    provider: "google"
  };
}

async function handleApi(req, res, url) {
  try {
    if (url.pathname === "/api/config") {
      return sendJson(res, 200, {
        defaultMapProvider: DEFAULT_MAP_PROVIDER,
        providers: {
          osm: {
            enabled: true
          },
          google: {
            enabled: Boolean(GOOGLE_MAPS_BROWSER_KEY && GOOGLE_MAPS_SERVER_KEY),
            browserKey: GOOGLE_MAPS_BROWSER_KEY || "",
            serverConfigured: Boolean(GOOGLE_MAPS_SERVER_KEY)
          }
        }
      });
    }

    if (url.pathname === "/api/geocode") {
      const q = String(url.searchParams.get("q") || "").trim();
      if (q.length < 2) return sendError(res, 400, "Search text is too short");
      const provider = mapProviderFrom(url);
      const results = provider === "google"
        ? await geocodeGoogle(q)
        : await geocodeOsm(q);
      return sendJson(res, 200, results);
    }

    if (url.pathname === "/api/route" || url.pathname === "/api/route-via" || url.pathname === "/api/route-itinerary") {
      const origin = parseCoordPair(url.searchParams.get("origin"), "origin");
      const destination = parseCoordPair(url.searchParams.get("destination"), "destination");
      let viaPoints = [];
      if (url.pathname === "/api/route-via") {
        viaPoints = [parseCoordPair(url.searchParams.get("via"), "via")];
      }
      if (url.pathname === "/api/route-itinerary") {
        viaPoints = url.searchParams.getAll("via").map((value, index) => parseCoordPair(value, `via ${index + 1}`));
        if (viaPoints.length < 1 || viaPoints.length > 5) {
          return sendError(res, 400, "Itinerary routes require 1 to 5 stops");
        }
      }
      const provider = mapProviderFrom(url);
      const route = provider === "google"
        ? await routeGoogle(origin, destination, viaPoints)
        : await routeOsm(origin, destination, viaPoints);
      return sendJson(res, 200, route);
    }

    if (url.pathname === "/api/ebird/recent" || url.pathname === "/api/ebird/notable") {
      const token = req.headers["x-ebird-api-token"] || process.env.EBIRD_API_KEY;
      if (!token) return sendError(res, 401, "An eBird API token is required");

      const lat = boundedNumber(url.searchParams.get("lat"), NaN, -90, 90);
      const lng = boundedNumber(url.searchParams.get("lng"), NaN, -180, 180);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return sendError(res, 400, "lat and lng are required");
      }

      const dist = boundedNumber(url.searchParams.get("dist"), 25, 1, 50);
      const back = boundedNumber(url.searchParams.get("back"), 14, 1, 30);
      const maxResults = boundedNumber(url.searchParams.get("maxResults"), 500, 1, 10000);
      const isNotable = url.pathname.endsWith("/notable");
      const endpoint = new URL(
        isNotable
          ? "https://api.ebird.org/v2/data/obs/geo/recent/notable"
          : "https://api.ebird.org/v2/data/obs/geo/recent"
      );
      endpoint.searchParams.set("lat", String(lat));
      endpoint.searchParams.set("lng", String(lng));
      endpoint.searchParams.set("dist", String(dist));
      endpoint.searchParams.set("back", String(back));
      endpoint.searchParams.set("maxResults", String(maxResults));
      endpoint.searchParams.set("hotspot", "true");
      if (isNotable) {
        endpoint.searchParams.set("detail", "simple");
      } else {
        endpoint.searchParams.set("includeProvisional", "true");
        endpoint.searchParams.set("sort", "date");
      }

      const data = await fetchJson(endpoint.toString(), { "x-ebirdapitoken": String(token) });
      return sendJson(res, 200, data);
    }

    return sendError(res, 404, "Unknown API endpoint");
  } catch (error) {
    return sendError(res, error.status || 500, error.message || "Request failed", error.details);
  }
}

function serveStatic(req, res, url) {
  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": contentTypes[ext] || "application/octet-stream",
      "cache-control": "no-cache"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/healthz") {
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end("ok");
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    logApiRequest(req, res, url);
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Birdtrip running at http://localhost:${PORT}`);
});
