const http = require("http");
const fs = require("fs");
const path = require("path");
const { createTripStore, SLUG_PATTERN } = require("./lib/trip-store");

const PORT = Number(process.env.PORT || 4177);
const PUBLIC_DIR = path.join(__dirname, "public");
const CACHE_TTL_MS = 10 * 60 * 1000;
const SEASONALITY_TTL_MS = 24 * 60 * 60 * 1000;
const SEASONALITY_CACHE_MAX_ENTRIES = 100;
const SEASONALITY_SAMPLE_DAYS = [5, 15, 25];
const SEASONALITY_MIN_SAMPLED_DAYS = 24;
const SEASONALITY_CHUNK_SIZE = 6;
const SEASONALITY_MAX_CONCURRENT_BUILDS = 2;
const SEASONALITY_MAX_QUEUED_BUILDS = 20;
const UPSTREAM_TIMEOUT_MS = 15000;
const MAP_PROVIDERS = new Set(["osm", "google"]);
const DEFAULT_MAP_PROVIDER = MAP_PROVIDERS.has(process.env.MAP_PROVIDER)
  ? process.env.MAP_PROVIDER
  : "osm";
const GOOGLE_MAPS_BROWSER_KEY = process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_SERVER_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
const TRIP_BODY_LIMIT_BYTES = 150 * 1024;
const TRIP_CREATE_LIMIT = 30;
const TRIP_CREATE_WINDOW_MS = 60 * 60 * 1000;
const SHARED_TRIP_PAGE_PATTERN = /^\/t\/[A-Za-z0-9]{8,64}\/?$/;
let tripStore = process.env.DATABASE_URL
  ? createTripStore({ connectionString: process.env.DATABASE_URL })
  : null;
const tripCreatesByIp = new Map();
const cache = new Map();
const seasonalityCache = new Map();
const seasonalityBuilds = new Map();
const seasonalityBuildQueue = [];
let activeSeasonalityBuilds = 0;

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
    const logUrl = new URL(url);
    if (logUrl.pathname === "/api/reverse-geocode" || logUrl.pathname === "/api/ebird/seasonality") {
      logUrl.searchParams.delete("lat");
      logUrl.searchParams.delete("lng");
    }
    console.log(`[api] ${req.method} ${logUrl.pathname}${logUrl.search} ${res.statusCode} ${elapsed}ms`);
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

function pruneSeasonalityCache(target = seasonalityCache, now = Date.now()) {
  for (const [key, entry] of target) {
    if (now - entry.time > SEASONALITY_TTL_MS) target.delete(key);
  }
  while (target.size > SEASONALITY_CACHE_MAX_ENTRIES) {
    target.delete(target.keys().next().value);
  }
}

function setCachedSeasonality(key, value) {
  pruneSeasonalityCache();
  seasonalityCache.delete(key);
  seasonalityCache.set(key, { time: Date.now(), value });
  pruneSeasonalityCache();
}

function releaseSeasonalityBuildSlot() {
  const next = seasonalityBuildQueue.shift();
  if (next) next(releaseSeasonalityBuildSlot);
  else activeSeasonalityBuilds -= 1;
}

function acquireSeasonalityBuildSlot() {
  if (activeSeasonalityBuilds < SEASONALITY_MAX_CONCURRENT_BUILDS) {
    activeSeasonalityBuilds += 1;
    return Promise.resolve(releaseSeasonalityBuildSlot);
  }
  if (seasonalityBuildQueue.length >= SEASONALITY_MAX_QUEUED_BUILDS) {
    const error = new Error("Too many seasonal data requests are already in progress");
    error.status = 429;
    return Promise.reject(error);
  }
  return new Promise((resolve) => seasonalityBuildQueue.push(resolve));
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      total += chunk.length;
      if (total > maxBytes) {
        failed = true;
        const error = new Error("Request body is too large");
        error.status = 413;
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        const error = new Error("Request body must be valid JSON");
        error.status = 400;
        reject(error);
      }
    });
    req.on("error", (error) => {
      if (failed) return;
      failed = true;
      reject(error);
    });
  });
}

function requestClientIp(req) {
  // The leftmost x-forwarded-for entries are client-controlled, so only the
  // entry appended by the trusted proxy in front of us (the last one) is safe
  // to use — and only when we know such a proxy exists (TRUST_PROXY is set,
  // as in render.yaml). Otherwise use the socket address alone.
  if (/^(1|true|yes)$/i.test(process.env.TRUST_PROXY || "")) {
    const hops = String(req.headers["x-forwarded-for"] || "").split(",");
    const lastHop = hops[hops.length - 1].trim();
    if (lastHop) return lastHop;
  }
  return req.socket.remoteAddress || "unknown";
}

function enforceTripCreateLimit(req) {
  const now = Date.now();
  const ip = requestClientIp(req);
  const recent = (tripCreatesByIp.get(ip) || []).filter(
    (time) => now - time < TRIP_CREATE_WINDOW_MS
  );
  if (recent.length >= TRIP_CREATE_LIMIT) {
    const error = new Error("Too many share links created; try again later");
    error.status = 429;
    throw error;
  }
  recent.push(now);
  tripCreatesByIp.set(ip, recent);
  if (tripCreatesByIp.size > 10000) {
    for (const [key, times] of tripCreatesByIp) {
      if (!times.some((time) => now - time < TRIP_CREATE_WINDOW_MS)) tripCreatesByIp.delete(key);
    }
  }
}

function requireTripStore() {
  if (!tripStore) {
    const error = new Error("Trip sharing is not configured");
    error.status = 503;
    error.details = "Set DATABASE_URL to enable shared trip links.";
    throw error;
  }
  return tripStore;
}

function parseCoordPair(value, name) {
  if (!value) throwClientInputError(`${name} is required`);
  const [lng, lat] = value.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throwClientInputError(`${name} must be "lng,lat"`);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throwClientInputError(`${name} is outside valid coordinate bounds`);
  }
  return { lat, lng };
}

function throwClientInputError(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function boundedNumber(value, fallback, min, max) {
  const raw = typeof value === "string" && value.trim() === "" ? fallback : value ?? fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

async function fetchJson(url, headers = {}, options = {}) {
  const cacheKey = `${url} ${JSON.stringify(headers)}`;
  const shouldCache = options.cache !== false;
  const hit = shouldCache ? cached(cacheKey) : null;
  if (hit) return hit;

  const timeoutMs = Number(options.timeoutMs) || 0;
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  let text;
  try {
    response = await fetch(url, {
      signal: controller?.signal,
      headers: {
        "accept": "application/json",
        "user-agent": "birdtrip/0.1 local personal app",
        ...headers
      }
    });
    text = await response.text();
  } catch (error) {
    if (error.name === "AbortError" && controller?.signal.aborted) {
      const timeoutError = new Error("Upstream request timed out");
      timeoutError.status = 504;
      timeoutError.details = { timeoutMs };
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

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

  return shouldCache ? setCached(cacheKey, body) : body;
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

async function reverseGeocodeOsm(lat, lng) {
  const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("lat", String(lat));
  endpoint.searchParams.set("lon", String(lng));
  const result = await fetchJson(endpoint.toString());
  if (!result || !result.display_name) return null;
  return {
    name: result.display_name,
    lat: Number(result.lat ?? lat),
    lng: Number(result.lon ?? lng),
    type: result.type,
    provider: "osm"
  };
}

async function reverseGeocodeGoogle(lat, lng) {
  const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  endpoint.searchParams.set("latlng", `${lat},${lng}`);
  endpoint.searchParams.set("key", requireGoogleServerKey());
  const result = await fetchJson(endpoint.toString());
  if (result.status !== "OK" && result.status !== "ZERO_RESULTS") {
    const error = new Error(result.error_message || result.status || "Google reverse geocoding failed");
    error.status = 502;
    error.details = result;
    throw error;
  }
  const first = (result.results || [])[0];
  if (!first) return null;
  return {
    name: first.formatted_address,
    lat: Number(first.geometry?.location?.lat ?? lat),
    lng: Number(first.geometry?.location?.lng ?? lng),
    type: Array.isArray(first.types) ? first.types[0] : "",
    placeId: first.place_id,
    provider: "google"
  };
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

let taxonomyCache = null;
let taxonomyPromise = null;

async function loadTaxonomy(token) {
  if (taxonomyCache) return taxonomyCache;
  if (taxonomyPromise) return taxonomyPromise;
  taxonomyPromise = (async () => {
    const endpoint = new URL("https://api.ebird.org/v2/ref/taxonomy/ebird");
    endpoint.searchParams.set("fmt", "json");
    endpoint.searchParams.set("cat", "species");
    endpoint.searchParams.set("locale", "en");
    const headers = token ? { "x-ebirdapitoken": String(token) } : {};
    const data = await fetchJson(endpoint.toString(), headers);
    if (!Array.isArray(data)) {
      const error = new Error("eBird taxonomy response was not a list");
      error.status = 502;
      throw error;
    }
    const list = [];
    const byCode = new Map();
    for (const item of data) {
      const code = item.speciesCode;
      const comName = item.comName;
      if (!code || !comName) continue;
      const sciName = item.sciName || "";
      const entry = {
        code,
        comName,
        sciName,
        comLower: comName.toLowerCase(),
        sciLower: sciName.toLowerCase()
      };
      list.push(entry);
      byCode.set(code, entry);
    }
    taxonomyCache = { list, byCode };
    return taxonomyCache;
  })();
  try {
    return await taxonomyPromise;
  } catch (error) {
    taxonomyPromise = null;
    throw error;
  }
}

function searchTaxonomy(taxonomy, query, limit = 12) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const entry of taxonomy.list) {
    if (entry.comLower.startsWith(q) || entry.sciLower.startsWith(q)) {
      starts.push(entry);
    } else if (entry.comLower.includes(q) || entry.sciLower.includes(q)) {
      contains.push(entry);
    }
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains]
    .slice(0, limit)
    .map((entry) => ({ speciesCode: entry.code, comName: entry.comName, sciName: entry.sciName }));
}

function resolveSpecies(taxonomy, name) {
  const norm = String(name || "").trim().toLowerCase();
  if (!norm) return null;
  for (const entry of taxonomy.list) {
    if (entry.comLower === norm || entry.sciLower === norm) return entry;
  }
  const starts = taxonomy.list.filter(
    (entry) => entry.comLower.startsWith(norm) || entry.sciLower.startsWith(norm)
  );
  return starts.length === 1 ? starts[0] : null;
}

function isCountableSpeciesName(comName) {
  const name = String(comName || "");
  if (!name) return false;
  if (name.includes("/")) return false;
  if (/\bsp\.\)?$/.test(name)) return false;
  if (/\bx\b/i.test(name)) return false;
  if (/\((?:domestic|hybrid)/i.test(name)) return false;
  return true;
}

function hotspotRegionCode(hotspot) {
  if (!hotspot) return "";
  return ["subnational2Code", "subnational1Code", "countryCode"]
    .map((field) => hotspot[field])
    .find((code) => typeof code === "string" && code) || "";
}

function coordinateDistanceKm(a, b) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(b.lng - a.lng);
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function nearestHotspotRegion(hotspots, lat, lng) {
  const selected = { lat: Number(lat), lng: Number(lng) };
  let nearestRegion = "";
  let nearestDistance = Infinity;
  for (const spot of hotspots) {
    const region = hotspotRegionCode(spot);
    const spotLat = Number(spot?.lat);
    const spotLng = Number(spot?.lng);
    if (!region || !Number.isFinite(spotLat) || !Number.isFinite(spotLng)) continue;
    const distance = coordinateDistanceKm(selected, { lat: spotLat, lng: spotLng });
    if (distance >= nearestDistance) continue;
    nearestRegion = region;
    nearestDistance = distance;
  }
  return nearestRegion;
}

async function inferEbirdRegion(lat, lng, token) {
  const endpoint = new URL("https://api.ebird.org/v2/ref/hotspot/geo");
  endpoint.searchParams.set("lat", String(lat));
  endpoint.searchParams.set("lng", String(lng));
  endpoint.searchParams.set("dist", "25");
  endpoint.searchParams.set("fmt", "json");
  const hotspots = await fetchJson(
    endpoint.toString(),
    { "x-ebirdapitoken": String(token) },
    { timeoutMs: UPSTREAM_TIMEOUT_MS, cache: false }
  );
  if (!Array.isArray(hotspots) || !hotspots.length) {
    const error = new Error("No eBird hotspots were found near that location");
    error.status = 404;
    throw error;
  }
  const region = nearestHotspotRegion(hotspots, lat, lng);
  if (!region) {
    const error = new Error("Could not resolve an eBird region for that location");
    error.status = 502;
    throw error;
  }
  return region;
}

async function regionDisplayName(regionCode, token) {
  try {
    const info = await fetchJson(
      `https://api.ebird.org/v2/ref/region/info/${encodeURIComponent(regionCode)}`,
      { "x-ebirdapitoken": String(token) },
      { timeoutMs: UPSTREAM_TIMEOUT_MS }
    );
    return info && typeof info.result === "string" && info.result ? info.result : regionCode;
  } catch {
    return regionCode;
  }
}

async function buildSeasonality(regionCode, token) {
  const year = new Date().getFullYear() - 1;
  const cacheKey = `${regionCode}:${year}`;
  pruneSeasonalityCache();
  const hit = seasonalityCache.get(cacheKey);
  if (hit && Date.now() - hit.time <= SEASONALITY_TTL_MS) return hit.value;

  const pending = seasonalityBuilds.get(cacheKey);
  if (pending) return pending;
  const build = runSeasonalityBuild(regionCode, token, year, cacheKey);
  seasonalityBuilds.set(cacheKey, build);
  try {
    return await build;
  } finally {
    if (seasonalityBuilds.get(cacheKey) === build) seasonalityBuilds.delete(cacheKey);
  }
}

async function runSeasonalityBuild(regionCode, token, year, cacheKey) {
  const release = await acquireSeasonalityBuildSlot();
  try {
    return await buildSeasonalityUncached(regionCode, token, year, cacheKey);
  } finally {
    release();
  }
}

async function buildSeasonalityUncached(regionCode, token, year, cacheKey) {
  const sampleDates = [];
  for (let month = 1; month <= 12; month += 1) {
    for (const day of SEASONALITY_SAMPLE_DAYS) sampleDates.push({ month, day });
  }

  const sampledDays = Array(12).fill(0);
  const species = new Map();
  for (let i = 0; i < sampleDates.length; i += SEASONALITY_CHUNK_SIZE) {
    const chunk = sampleDates.slice(i, i + SEASONALITY_CHUNK_SIZE);
    const settled = await Promise.allSettled(chunk.map(({ month, day }) => {
      const endpoint = new URL(
        `https://api.ebird.org/v2/data/obs/${encodeURIComponent(regionCode)}/historic/${year}/${month}/${day}`
      );
      endpoint.searchParams.set("cat", "species");
      endpoint.searchParams.set("detail", "simple");
      return fetchJson(
        endpoint.toString(),
        { "x-ebirdapitoken": String(token) },
        { timeoutMs: UPSTREAM_TIMEOUT_MS, cache: false }
      );
    }));
    settled.forEach((result, index) => {
      if (result.status !== "fulfilled" || !Array.isArray(result.value)) return;
      const monthIndex = chunk[index].month - 1;
      sampledDays[monthIndex] += 1;
      const seenToday = new Set();
      for (const obs of result.value) {
        const code = obs && obs.speciesCode;
        if (!code || seenToday.has(code) || !isCountableSpeciesName(obs && obs.comName)) continue;
        seenToday.add(code);
        let entry = species.get(code);
        if (!entry) {
          entry = {
            speciesCode: code,
            comName: obs.comName,
            sciName: obs.sciName || "",
            months: Array(12).fill(0)
          };
          species.set(code, entry);
        }
        entry.months[monthIndex] += 1;
      }
    });
  }

  const totalSampled = sampledDays.reduce((sum, value) => sum + value, 0);
  if (totalSampled < SEASONALITY_MIN_SAMPLED_DAYS || sampledDays.some((count) => count < 1)) {
    const error = new Error("eBird historic data was unavailable for too many of the sampled days");
    error.status = 502;
    error.details = { regionCode, year, sampledDays };
    throw error;
  }

  const value = {
    regionCode,
    year,
    requestedSampleDaysPerMonth: SEASONALITY_SAMPLE_DAYS.length,
    sampledDays,
    species: [...species.values()].filter(
      (entry) => entry.months.reduce((sum, count) => sum + count, 0) >= 2
    )
  };
  setCachedSeasonality(cacheKey, value);
  return value;
}

async function handleApi(req, res, url) {
  try {
    if (url.pathname === "/api/config") {
      return sendJson(res, 200, {
        defaultMapProvider: DEFAULT_MAP_PROVIDER,
        ebirdConfigured: Boolean(process.env.EBIRD_API_KEY),
        providers: {
          osm: {
            enabled: true
          },
          google: {
            enabled: Boolean(GOOGLE_MAPS_BROWSER_KEY && GOOGLE_MAPS_SERVER_KEY),
            browserKey: GOOGLE_MAPS_BROWSER_KEY || "",
            serverConfigured: Boolean(GOOGLE_MAPS_SERVER_KEY)
          }
        },
        ebird: {
          serverConfigured: Boolean(process.env.EBIRD_API_KEY)
        },
        tripSharing: {
          enabled: Boolean(tripStore)
        }
      });
    }

    if (url.pathname === "/api/trips") {
      if (req.method !== "POST") return sendError(res, 405, "Use POST to create a shared trip");
      const store = requireTripStore();
      enforceTripCreateLimit(req);
      const data = await readJsonBody(req, TRIP_BODY_LIMIT_BYTES);
      const { slug } = await store.createTrip(data);
      return sendJson(res, 201, { slug, path: `/t/${slug}` });
    }

    const tripMatch = url.pathname.match(/^\/api\/trips\/([A-Za-z0-9]+)$/);
    if (tripMatch) {
      const store = requireTripStore();
      if (!SLUG_PATTERN.test(tripMatch[1])) {
        return sendError(res, 404, "This shared trip was not found or has expired");
      }
      const data = await store.getTrip(tripMatch[1]);
      if (!data) return sendError(res, 404, "This shared trip was not found or has expired");
      return sendJson(res, 200, { slug: tripMatch[1], data });
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

    if (url.pathname === "/api/reverse-geocode") {
      const latRaw = url.searchParams.get("lat");
      const lngRaw = url.searchParams.get("lng");
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (
        latRaw === null ||
        lngRaw === null ||
        latRaw.trim() === "" ||
        lngRaw.trim() === "" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return sendError(res, 400, "lat and lng are required and must be within valid ranges");
      }
      const provider = mapProviderFrom(url);
      const result = provider === "google"
        ? await reverseGeocodeGoogle(lat, lng)
        : await reverseGeocodeOsm(lat, lng);
      return sendJson(res, 200, result || {});
    }

    if (url.pathname === "/api/route" || url.pathname === "/api/route-via" || url.pathname === "/api/route-itinerary") {
      const origin = parseCoordPair(url.searchParams.get("origin"), "origin");
      const destination = parseCoordPair(url.searchParams.get("destination"), "destination");
      let viaPoints = [];
      if (url.pathname === "/api/route-via") {
        viaPoints = [parseCoordPair(url.searchParams.get("via"), "via")];
      }
      if (url.pathname === "/api/route-itinerary") {
        const viaValues = url.searchParams.getAll("via");
        if (viaValues.length < 1 || viaValues.length > 5) {
          return sendError(res, 400, "Itinerary routes require 1 to 5 stops");
        }
        viaPoints = viaValues.map((value, index) => parseCoordPair(value, `via ${index + 1}`));
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

    if (url.pathname === "/api/ebird/hotspots") {
      const token = req.headers["x-ebird-api-token"] || process.env.EBIRD_API_KEY;
      if (!token) return sendError(res, 401, "An eBird API token is required");

      const lat = boundedNumber(url.searchParams.get("lat"), NaN, -90, 90);
      const lng = boundedNumber(url.searchParams.get("lng"), NaN, -180, 180);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return sendError(res, 400, "lat and lng are required");
      }

      const dist = boundedNumber(url.searchParams.get("dist"), 25, 1, 500);
      const backValue = url.searchParams.get("back");
      const back = backValue === null ? null : boundedNumber(backValue, 14, 1, 30);
      const endpoint = new URL("https://api.ebird.org/v2/ref/hotspot/geo");
      endpoint.searchParams.set("lat", String(lat));
      endpoint.searchParams.set("lng", String(lng));
      endpoint.searchParams.set("dist", String(dist));
      if (back !== null) endpoint.searchParams.set("back", String(back));
      endpoint.searchParams.set("fmt", "json");

      const data = await fetchJson(endpoint.toString(), { "x-ebirdapitoken": String(token) });
      return sendJson(res, 200, data);
    }

    if (url.pathname === "/api/ebird/hotspot-recent") {
      const token = req.headers["x-ebird-api-token"] || process.env.EBIRD_API_KEY;
      if (!token) return sendError(res, 401, "An eBird API token is required");

      const locId = String(url.searchParams.get("locId") || "");
      if (!/^L\d+$/.test(locId)) {
        return sendError(res, 400, "locId must be an eBird location code like L123456");
      }

      const back = boundedNumber(url.searchParams.get("back"), 14, 1, 30);
      const endpoint = new URL(`https://api.ebird.org/v2/data/obs/${locId}/recent`);
      endpoint.searchParams.set("back", String(back));
      endpoint.searchParams.set("includeProvisional", "true");

      const data = await fetchJson(endpoint.toString(), { "x-ebirdapitoken": String(token) });
      return sendJson(res, 200, data);
    }

    if (url.pathname === "/api/ebird/seasonality") {
      const token = req.headers["x-ebird-api-token"] || process.env.EBIRD_API_KEY;
      if (!token) return sendError(res, 401, "An eBird API token is required");

      const latValue = url.searchParams.get("lat");
      const lngValue = url.searchParams.get("lng");
      const lat = Number(latValue);
      const lng = Number(lngValue);
      if (
        latValue === null || lngValue === null
        || latValue.trim() === "" || lngValue.trim() === ""
        || !Number.isFinite(lat) || !Number.isFinite(lng)
        || lat < -90 || lat > 90 || lng < -180 || lng > 180
      ) {
        return sendError(res, 400, "lat and lng are required and must be within valid ranges");
      }

      const regionCode = await inferEbirdRegion(lat, lng, token);
      const [seasonality, regionName] = await Promise.all([
        buildSeasonality(regionCode, token),
        regionDisplayName(regionCode, token)
      ]);
      return sendJson(res, 200, { ...seasonality, regionName });
    }

    if (url.pathname === "/api/ebird/taxonomy/search") {
      const token = req.headers["x-ebird-api-token"] || process.env.EBIRD_API_KEY;
      const q = String(url.searchParams.get("q") || "").trim();
      if (q.length < 1) return sendJson(res, 200, []);
      const taxonomy = await loadTaxonomy(token);
      return sendJson(res, 200, searchTaxonomy(taxonomy, q));
    }

    if (url.pathname === "/api/ebird/species") {
      const token = req.headers["x-ebird-api-token"] || process.env.EBIRD_API_KEY;
      if (!token) return sendError(res, 401, "An eBird API token is required");

      const lat = boundedNumber(url.searchParams.get("lat"), NaN, -90, 90);
      const lng = boundedNumber(url.searchParams.get("lng"), NaN, -180, 180);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return sendError(res, 400, "lat and lng are required");
      }

      let speciesCode = String(url.searchParams.get("speciesCode") || "").trim();
      let resolved = null;
      if (speciesCode) {
        const taxonomy = await loadTaxonomy(token).catch(() => null);
        if (taxonomy) resolved = taxonomy.byCode.get(speciesCode) || null;
      } else {
        const name = String(url.searchParams.get("name") || "").trim();
        if (!name) return sendError(res, 400, "A species code or name is required");
        const taxonomy = await loadTaxonomy(token);
        resolved = resolveSpecies(taxonomy, name);
        if (!resolved) {
          return sendError(res, 404, `No eBird species matched "${name}"`, {
            suggestions: searchTaxonomy(taxonomy, name, 6)
          });
        }
        speciesCode = resolved.code;
      }
      if (!/^[a-z0-9]+$/i.test(speciesCode)) {
        return sendError(res, 400, "Invalid species code");
      }

      const dist = boundedNumber(url.searchParams.get("dist"), 25, 1, 50);
      const back = boundedNumber(url.searchParams.get("back"), 14, 1, 30);
      const maxResults = boundedNumber(url.searchParams.get("maxResults"), 1000, 1, 10000);
      const endpoint = new URL(
        `https://api.ebird.org/v2/data/obs/geo/recent/${encodeURIComponent(speciesCode)}`
      );
      endpoint.searchParams.set("lat", String(lat));
      endpoint.searchParams.set("lng", String(lng));
      endpoint.searchParams.set("dist", String(dist));
      endpoint.searchParams.set("back", String(back));
      endpoint.searchParams.set("maxResults", String(maxResults));
      endpoint.searchParams.set("includeProvisional", "true");

      const observations = await fetchJson(endpoint.toString(), { "x-ebirdapitoken": String(token) });
      return sendJson(res, 200, {
        speciesCode,
        species: resolved
          ? { speciesCode: resolved.code, comName: resolved.comName, sciName: resolved.sciName }
          : null,
        observations: Array.isArray(observations) ? observations : []
      });
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
  // Shared trip links are client-side routes: serve the app shell and let
  // app.js fetch the trip for the slug in the path.
  if (SHARED_TRIP_PAGE_PATTERN.test(url.pathname)) {
    url.pathname = "/";
  }
  serveStatic(req, res, url);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Birdtrip running at http://localhost:${PORT}`);
  });
  if (tripStore) {
    // Warm the schema and sweep expired trips at boot; failures leave the
    // rest of the app working and the trip endpoints retrying lazily. The
    // hourly timer keeps retention honest even when no new trips are being
    // created; unref so it never holds the process open.
    const runTripSweep = () => tripStore
      .sweepExpired()
      .then((removed) => {
        if (removed > 0) console.log(`[trips] removed ${removed} expired shared trips`);
      })
      .catch((error) => {
        console.error(`[trips] retention sweep failed: ${error.message}`);
      });
    runTripSweep();
    setInterval(runTripSweep, 60 * 60 * 1000).unref();
  }
}

function setTripStore(store) {
  tripStore = store;
}

module.exports = {
  acquireSeasonalityBuildSlot,
  buildSeasonality,
  fetchJson,
  nearestHotspotRegion,
  pruneSeasonalityCache,
  readJsonBody,
  server,
  setTripStore
};
