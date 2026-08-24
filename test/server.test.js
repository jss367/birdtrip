const test = require("node:test");
const assert = require("node:assert/strict");

const { nearestHotspotRegion } = require("../server.js");

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
