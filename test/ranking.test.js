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

test("coverage sampling preserves an infeasible query radius", () => {
  const result = ranking.sampleRouteForCoverage([[0, 0], [1, 0]], {
    corridorRadiusKm: 25,
    queryRadiusKm: 25,
    maxSamples: 14
  });

  assert.equal(result.queryRadiusKm, 25);
  assert.equal(result.coverageFeasible, false);
  assert.equal(result.coverageComplete, false);
  assert.equal(result.requiredSamples, Infinity);
  assert.equal(result.samples.length, 14);
});

test("distance to route uses the polyline rather than sample points", () => {
  const route = [[0, 0], [10, 0], [10, 10]];
  const horizontal = ranking.distanceToRouteKm({ lng: 5, lat: 1 }, route);
  const vertical = ranking.distanceToRouteKm({ lng: 9, lat: 7 }, route);

  assert.ok(horizontal.distanceKm > 109 && horizontal.distanceKm < 112);
  assert.ok(vertical.distanceKm > 109 && vertical.distanceKm < 112);
  assert.ok(horizontal.progress < vertical.progress);
});

test("a route index reuses geometry without changing distance results", () => {
  const route = [[0, 0], [10, 0], [10, 10]];
  const point = { lng: 9, lat: 7 };
  const direct = ranking.distanceToRouteKm(point, route);
  const indexed = ranking.createRouteIndex(route).distanceTo(point);

  assert.deepEqual(indexed, direct);
});

test("route sampling and distance use the short path across the antimeridian", () => {
  const route = [[179, 0], [-179, 0]];
  const samples = ranking.sampleRouteForCoverage(route, {
    corridorRadiusKm: 25,
    queryRadiusKm: 200,
    maxSamples: 4
  }).samples;
  const midpoint = ranking.distanceToRouteKm({ lng: 180, lat: 0 }, route);

  assert.ok(midpoint.distanceKm < 0.001);
  assert.ok(samples.every((sample) => Math.abs(sample.lng) > 170));
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

test("personal scoring gives either enabled input the full component", () => {
  assert.equal(ranking.personalValueScore({
    weightedTargets: 5,
    targetsEnabled: true
  }), 15);
  assert.equal(ranking.personalValueScore({
    weightedUnseen: 8,
    unseenEnabled: true
  }), 15);
  assert.equal(ranking.personalValueScore({
    weightedTargets: 5,
    weightedUnseen: 8,
    targetsEnabled: true,
    unseenEnabled: true
  }), 15);
});

test("all-time richness prior preserves ordering without a hard cap", () => {
  assert.ok(ranking.richnessPrior(1000) < 1);
  assert.ok(ranking.richnessPrior(1000) > ranking.richnessPrior(500));
  assert.ok(ranking.richnessPrior(500) > ranking.richnessPrior(400));
  assert.ok(ranking.richnessPrior(400) > ranking.richnessPrior(100));
});
