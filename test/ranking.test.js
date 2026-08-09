const test = require("node:test");
const assert = require("node:assert/strict");

require("../public/ranking.js");

const ranking = globalThis.BirdtripRanking;

test("coverage sampling scales with route length and reports partial coverage", () => {
  const route = [[0, 0], [45, 0]];
  const result = ranking.sampleRouteForCoverage(route, {
    corridorRadiusKm: 25,
    queryRadiusKm: 200,
    maxSamples: 16
  });

  assert.equal(result.samples.length, 16);
  assert.equal(result.coverageComplete, true);
  assert.ok(result.totalKm > 4990 && result.totalKm < 5010);

  const partial = ranking.sampleRouteForCoverage([[0, 0], [60, 0]], {
    corridorRadiusKm: 50,
    queryRadiusKm: 200,
    maxSamples: 16
  });
  assert.equal(partial.coverageComplete, false);
  assert.ok(partial.requiredSamples > 16);
});

test("distance to route uses the polyline rather than sample points", () => {
  const route = [[0, 0], [10, 0], [10, 10]];
  const horizontal = ranking.distanceToRouteKm({ lng: 5, lat: 1 }, route);
  const vertical = ranking.distanceToRouteKm({ lng: 9, lat: 7 }, route);

  assert.ok(horizontal.distanceKm > 109 && horizontal.distanceKm < 112);
  assert.ok(vertical.distanceKm > 109 && vertical.distanceKm < 112);
  assert.ok(horizontal.progress < vertical.progress);
});

test("freshness has a fixed seven-day half-life and rejects unknown dates", () => {
  const now = new Date(2026, 7, 8);
  assert.equal(ranking.observationFreshnessWeight("2026-08-08", { now }), 1);
  assert.equal(ranking.observationFreshnessWeight("not-a-date", { now }), 0);
  assert.ok(Math.abs(ranking.observationFreshnessWeight("2026-07-31", { now }) - 0.5) < 0.001);
});

test("score normalization removes disabled component maxima", () => {
  const parts = { practicality: 20, current: 17.5, stable: 5, personal: 0 };
  assert.equal(ranking.normalizedScore(parts, {
    practicality: 40,
    current: 35,
    stable: 10
  }), 50);
  assert.equal(ranking.normalizedScore(parts, {
    practicality: 40,
    current: 35,
    stable: 10,
    personal: 15
  }), 43);
});

test("all-time richness prior preserves ordering without a hard cap", () => {
  assert.ok(ranking.richnessPrior(500) > ranking.richnessPrior(400));
  assert.ok(ranking.richnessPrior(400) > ranking.richnessPrior(100));
});
