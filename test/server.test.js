const test = require("node:test");
const assert = require("node:assert/strict");

const { fetchJson, nearestHotspotRegion, pruneSeasonalityCache } = require("../server.js");

test("seasonality uses the nearest hotspot region instead of the modal region", () => {
  const hotspots = [
    { lat: 32.001, lng: -117, subnational2Code: "US-CA-073" },
    { lat: 32.08, lng: -117, subnational2Code: "US-CA-065" },
    { lat: 32.09, lng: -117, subnational2Code: "US-CA-065" },
    { lat: 32.1, lng: -117, subnational2Code: "US-CA-065" }
  ];

  assert.equal(nearestHotspotRegion(hotspots, 32, -117), "US-CA-073");
});

test("nearest hotspot falls back to its most specific available region", () => {
  const hotspots = [
    { lat: "invalid", lng: -117, subnational2Code: "US-CA-999" },
    { lat: 32.01, lng: -117, subnational1Code: "US-CA", countryCode: "US" },
    { lat: 32.02, lng: -117, countryCode: "US" }
  ];

  assert.equal(nearestHotspotRegion(hotspots, 32, -117), "US-CA");
});

test("seasonality cache pruning expires old entries and enforces a size bound", () => {
  const now = Date.UTC(2026, 7, 24);
  const day = 24 * 60 * 60 * 1000;
  const cache = new Map([
    ["expired", { time: now - day - 1, value: {} }],
    ["fresh", { time: now, value: {} }]
  ]);
  for (let index = 0; index < 105; index += 1) {
    cache.set(`region-${index}`, { time: now, value: {} });
  }

  pruneSeasonalityCache(cache, now);

  assert.equal(cache.has("expired"), false);
  assert.equal(cache.has("fresh"), false);
  assert.equal(cache.size, 100);
  assert.equal(cache.has("region-104"), true);
});

test("cache-disabled upstream requests do not retain raw responses", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      text: async () => JSON.stringify([{ speciesCode: "test" }])
    };
  };

  try {
    const url = "https://example.test/historic/2025/1/5";
    await fetchJson(url, {}, { cache: false });
    await fetchJson(url, {}, { cache: false });
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
