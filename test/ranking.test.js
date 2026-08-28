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

test("corridor filtering includes the boundary and annotates route position", () => {
  const routeIndex = {
    distanceTo(hotspot) {
      return { distanceKm: hotspot.lat, progress: hotspot.lng / 10 };
    }
  };
  const hotspots = [
    { locId: "inside", lat: 4.9, lng: 2 },
    { locId: "boundary", lat: 5, lng: 5 },
    { locId: "outside", lat: 5.1, lng: 8 },
    { locId: "invalid", lat: "4", lng: 3 },
    { lat: 1, lng: 1 }
  ];

  const filtered = ranking.filterHotspotsByCorridor(hotspots, routeIndex, 5);

  assert.deepEqual(filtered.map((hotspot) => hotspot.locId), ["inside", "boundary"]);
  assert.deepEqual(
    filtered.map(({ routeDistanceKm, routeProgress }) => ({ routeDistanceKm, routeProgress })),
    [
      { routeDistanceKm: 4.9, routeProgress: 0.2 },
      { routeDistanceKm: 5, routeProgress: 0.5 }
    ]
  );
});

test("backfilling route metrics reconstructs missing progress from geometry", () => {
  const route = [[0, 0], [10, 0], [10, 10]];
  const legacy = { lat: 1, lng: 5, routeDistanceKm: 111 };
  const bare = { lat: 7, lng: 9 };
  const modern = { lat: 3, lng: 3, routeDistanceKm: 42, routeProgress: 0.25 };
  const unlocated = { routeDistanceKm: 1 };

  const result = ranking.backfillRouteMetrics([legacy, bare, modern, unlocated], route);

  assert.equal(result.length, 4);
  const expectedLegacy = ranking.distanceToRouteKm(legacy, route);
  assert.equal(legacy.routeProgress, expectedLegacy.progress);
  assert.equal(legacy.routeDistanceKm, 111);
  const expectedBare = ranking.distanceToRouteKm(bare, route);
  assert.equal(bare.routeProgress, expectedBare.progress);
  assert.equal(bare.routeDistanceKm, expectedBare.distanceKm);
  assert.deepEqual(modern, { lat: 3, lng: 3, routeDistanceKm: 42, routeProgress: 0.25 });
  assert.deepEqual(unlocated, { routeDistanceKm: 1 });
});

test("backfilling route metrics leaves candidates untouched without geometry", () => {
  const legacy = { lat: 1, lng: 5, routeDistanceKm: 111 };

  ranking.backfillRouteMetrics([legacy], null);

  assert.deepEqual(legacy, { lat: 1, lng: 5, routeDistanceKm: 111 });
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

test("detour impact converts route deltas and never reports a negative detour", () => {
  const detour = ranking.detourImpact(
    { durationSeconds: 5400, distanceMeters: 11609.344 },
    { durationSeconds: 3600, distanceMeters: 10000 }
  );
  assert.equal(detour.addedMinutes, 30);
  assert.ok(Math.abs(detour.addedMiles - 1) < Number.EPSILON * 4);
  assert.deepEqual(
    ranking.detourImpact(
      { durationSeconds: 3000, distanceMeters: 9000 },
      { durationSeconds: 3600, distanceMeters: 10000 }
    ),
    { addedMinutes: 0, addedMiles: 0 }
  );
});

test("candidate scoring protects practicality and optional personalization behavior", () => {
  const base = {
    mode: "route",
    weightedSpecies: 45,
    weightedActivity: 125,
    allTimeSpeciesCount: 250,
    addedMinutes: 30,
    maxDetour: 60
  };
  const general = ranking.calculateCandidateScore(base);
  const personalized = ranking.calculateCandidateScore({
    ...base,
    weightedTargets: 5,
    targetsEnabled: true
  });
  const atBudget = ranking.calculateCandidateScore({
    ...base,
    addedMinutes: 60
  });

  assert.equal(general.scoreParts.current, 17.5);
  assert.equal(general.scoreParts.practicality, 20);
  assert.deepEqual(general.enabledScoreParts, ["practicality", "current", "stable"]);
  assert.deepEqual(personalized.enabledScoreParts, ["practicality", "current", "stable", "personal"]);
  assert.equal(personalized.scoreParts.personal, 15);
  assert.ok(personalized.score > general.score);
  assert.equal(atBudget.scoreParts.practicality, 0);
  assert.ok(atBudget.score < general.score);
});

test("area practicality falls to zero at the corridor boundary", () => {
  assert.equal(ranking.practicalityScore({
    mode: "area",
    routeDistanceKm: 5,
    radiusKm: 10
  }), 20);
  assert.equal(ranking.practicalityScore({
    mode: "area",
    routeDistanceKm: 10,
    radiusKm: 10
  }), 0);
});

test("all-time richness prior preserves ordering without a hard cap", () => {
  assert.ok(ranking.richnessPrior(1000) < 1);
  assert.ok(ranking.richnessPrior(1000) > ranking.richnessPrior(500));
  assert.ok(ranking.richnessPrior(500) > ranking.richnessPrior(400));
  assert.ok(ranking.richnessPrior(400) > ranking.richnessPrior(100));
});
