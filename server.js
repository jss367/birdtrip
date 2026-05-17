const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4177);
const PUBLIC_DIR = path.join(__dirname, "public");
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

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
      "user-agent": "route-birding-planner/0.1 local personal app",
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

async function handleApi(req, res, url) {
  try {
    if (url.pathname === "/api/geocode") {
      const q = String(url.searchParams.get("q") || "").trim();
      if (q.length < 2) return sendError(res, 400, "Search text is too short");
      const endpoint = new URL("https://nominatim.openstreetmap.org/search");
      endpoint.searchParams.set("format", "jsonv2");
      endpoint.searchParams.set("limit", "5");
      endpoint.searchParams.set("addressdetails", "1");
      endpoint.searchParams.set("q", q);
      const results = await fetchJson(endpoint.toString());
      return sendJson(res, 200, results.map((item) => ({
        name: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
        type: item.type,
        importance: item.importance
      })));
    }

    if (url.pathname === "/api/route" || url.pathname === "/api/route-via") {
      const origin = parseCoordPair(url.searchParams.get("origin"), "origin");
      const destination = parseCoordPair(url.searchParams.get("destination"), "destination");
      const coords = [`${origin.lng},${origin.lat}`];
      if (url.pathname === "/api/route-via") {
        const via = parseCoordPair(url.searchParams.get("via"), "via");
        coords.push(`${via.lng},${via.lat}`);
      }
      coords.push(`${destination.lng},${destination.lat}`);

      const endpoint = new URL(`https://router.project-osrm.org/route/v1/driving/${coords.join(";")}`);
      endpoint.searchParams.set("overview", "full");
      endpoint.searchParams.set("geometries", "geojson");
      endpoint.searchParams.set("steps", "false");
      endpoint.searchParams.set("alternatives", "false");
      const result = await fetchJson(endpoint.toString());
      if (result.code !== "Ok" || !result.routes?.length) {
        return sendError(res, 502, "No route found", result);
      }
      const route = result.routes[0];
      return sendJson(res, 200, {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        geometry: route.geometry
      });
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
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Route Birding Planner running at http://localhost:${PORT}`);
});
