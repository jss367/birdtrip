// Hand-designed fixture: exact scores fall out of scoreCandidates' formulas.
// All observations are same-day (freshness weight 1), one observation per
// species (activity = 0.06n), no targets by default. birdPoints = 0.56n + 2.5nb.
//
// Geometry constraint: area-mode notables are attributed by distance (10 km),
// not locId, so only the three far reserves carry notables and they sit
// pairwise >10 km apart (east / west / north). City parks are >17 km from any
// notable. Do not move hotspots or add notables without rechecking pairwise
// distances — see docs/superpowers/plans/2026-08-10-birding-convenience-slider.md.
const CENTER = { lat: 41.4, lng: 2.1 };
const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LNG = 111.32 * Math.cos((41.4 * Math.PI) / 180);

function kmOffset(eastKm, northKm) {
  return { lat: CENTER.lat + northKm / KM_PER_DEG_LAT, lng: CENTER.lng + eastKm / KM_PER_DEG_LNG };
}

function haversineKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 09:00`;
}

const HOTSPOTS = [
  { locId: "L1", name: "City Park Alpha", east: 2, north: 0, species: 78, notables: 0 },
  { locId: "L2", name: "City Park Beta", east: 0, north: -3, species: 72, notables: 0 },
  { locId: "L3", name: "City Park Gamma", east: -2.5, north: 0, species: 75, notables: 0 },
  { locId: "L4", name: "Harbor Park", east: 0, north: 1.5, species: 70, notables: 0 },
  { locId: "L5", name: "Near Pond", east: 1, north: 0, species: 20, notables: 0 },
  { locId: "L6", name: "Wetland Reserve North", east: 20, north: 0, species: 84, notables: 2 },
  { locId: "L7", name: "Wetland Reserve South", east: -21, north: 0, species: 64, notables: 1 },
  { locId: "L8", name: "Far Rich Reserve", east: 0, north: 24.5, species: 85, notables: 3 }
];

function positionOf(h) {
  return kmOffset(h.east, h.north);
}

function hotspotList() {
  return HOTSPOTS.map((h) => ({
    ...positionOf(h),
    locId: h.locId,
    locName: h.name,
    numSpeciesAllTime: h.species
  }));
}

function recentFor(locId) {
  const h = HOTSPOTS.find((x) => x.locId === locId);
  if (!h) return [];
  const pos = positionOf(h);
  return Array.from({ length: h.species }, (_, i) => ({
    comName: `${h.name} Species ${i + 1}`,
    sciName: `Fixturus ${h.locId.toLowerCase()}${i + 1}`,
    locId: h.locId,
    locName: h.name,
    obsDt: today(),
    howMany: 1,
    lat: pos.lat,
    lng: pos.lng
  }));
}

function allNotables() {
  return HOTSPOTS.flatMap((h) => {
    const pos = positionOf(h);
    return Array.from({ length: h.notables }, (_, i) => ({
      comName: `${h.name} Notable ${i + 1}`,
      sciName: `Rarus ${h.locId.toLowerCase()}${i + 1}`,
      locId: h.locId,
      locName: h.name,
      obsDt: today(),
      howMany: 1,
      lat: pos.lat,
      lng: pos.lng
    }));
  });
}

const GEOCODE = [{ lat: CENTER.lat, lng: CENTER.lng, name: "Test Center, Barcelona" }];
const ROUTE_END = { ...kmOffset(5, 0), name: "Test East, Barcelona" };
const BASE_ROUTE = {
  geometry: { coordinates: [[CENTER.lng, CENTER.lat], [ROUTE_END.lng, ROUTE_END.lat]] },
  distanceMeters: 5000,
  durationSeconds: 600
};

async function stubApis(page) {
  // Playwright matches routes in reverse registration order: the catch-all
  // must be registered first so the specific stubs below take precedence.
  await page.route("**/api/ebird/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/geocode**", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") || "";
    route.fulfill({ json: q.includes("East") ? [ROUTE_END] : GEOCODE });
  });
  await page.route((url) => url.pathname === "/api/route", (route) => route.fulfill({ json: BASE_ROUTE }));
  await page.route((url) => url.pathname === "/api/route-via", (route) => {
    // Detour proportional to area distance: addedMinutes = 60 * d/25, so route
    // practicality 20*(1 - m/60) reproduces the area conv-points column and
    // the fixture table's orderings carry over unchanged.
    const params = new URL(route.request().url()).searchParams;
    const [lng, lat] = String(params.get("via") || "0,0").split(",").map(Number);
    const d = haversineKm(CENTER, { lat, lng });
    route.fulfill({
      json: {
        geometry: BASE_ROUTE.geometry,
        distanceMeters: BASE_ROUTE.distanceMeters + Math.round(d * 1000),
        durationSeconds: BASE_ROUTE.durationSeconds + 3600 * (d / 25)
      }
    });
  });
  await page.route("**/api/ebird/recent**", (route) => {
    // Unfiltered is safe: the obsKey dedupe collapses duplicates across samples.
    route.fulfill({ json: HOTSPOTS.flatMap((h) => recentFor(h.locId)) });
  });
  await page.route("**/api/ebird/hotspots**", (route) => route.fulfill({ json: hotspotList() }));
  await page.route("**/api/ebird/hotspot-recent**", (route) => {
    const url = new URL(route.request().url());
    route.fulfill({ json: recentFor(url.searchParams.get("locId")) });
  });
  await page.route("**/api/ebird/notable**", (route) => {
    // Honor lat/lng/dist exactly as the real eBird API would: route mode
    // assigns the raw response per candidate with no client-side distance
    // filter, so an unfiltered stub would give every candidate all notables.
    const url = new URL(route.request().url());
    const at = { lat: Number(url.searchParams.get("lat")), lng: Number(url.searchParams.get("lng")) };
    const dist = Number(url.searchParams.get("dist")) || 10;
    route.fulfill({ json: allNotables().filter((obs) => haversineKm(at, obs) <= dist) });
  });
}

module.exports = { stubApis, HOTSPOTS, CENTER };
