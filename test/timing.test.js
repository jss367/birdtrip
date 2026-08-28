const test = require("node:test");
const assert = require("node:assert/strict");

require("../public/timing.js");

const timing = globalThis.BirdtripTiming;

const HOUR_MS = 3600000;

function assertWithinMinutes(actualMs, expectedMs, toleranceMinutes, label) {
  const deltaMinutes = Math.abs(actualMs - expectedMs) / 60000;
  assert.ok(
    deltaMinutes <= toleranceMinutes,
    `${label}: expected within ${toleranceMinutes} min of ${new Date(expectedMs).toISOString()}, got ${new Date(actualMs).toISOString()}`
  );
}

test("sun times match known values for Greenwich at the equinox", () => {
  const noon = Date.UTC(2026, 2, 20, 12);
  const sun = timing.sunTimes(noon, 51.4772, 0);

  assert.equal(sun.polar, null);
  assertWithinMinutes(sun.sunriseMs, Date.UTC(2026, 2, 20, 6, 1), 15, "Greenwich equinox sunrise");
  assertWithinMinutes(sun.sunsetMs, Date.UTC(2026, 2, 20, 18, 10), 15, "Greenwich equinox sunset");
});

test("sun times match known values for Phoenix at the summer solstice", () => {
  const localNoon = Date.UTC(2026, 5, 21, 19);
  const sun = timing.sunTimes(localNoon, 33.4484, -112.074);

  assert.equal(sun.polar, null);
  assertWithinMinutes(sun.sunriseMs, Date.UTC(2026, 5, 21, 12, 18), 15, "Phoenix solstice sunrise");
  assertWithinMinutes(sun.sunsetMs, Date.UTC(2026, 5, 22, 2, 42), 15, "Phoenix solstice sunset");
});

test("sun times report polar night and midnight sun at high latitude", () => {
  const winter = timing.sunTimes(Date.UTC(2026, 11, 21, 12), 78.22, 15.65);
  const summer = timing.sunTimes(Date.UTC(2026, 5, 21, 12), 78.22, 15.65);

  assert.equal(winter.polar, "night");
  assert.equal(winter.sunriseMs, null);
  assert.equal(summer.polar, "day");
  assert.equal(summer.sunsetMs, null);
});

test("approximate UTC offset tracks longitude in whole hours", () => {
  assert.equal(timing.approximateUtcOffsetMinutes(0), 0);
  assert.equal(timing.approximateUtcOffsetMinutes(-112.074), -7 * 60); // Phoenix
  assert.equal(timing.approximateUtcOffsetMinutes(151.21), 10 * 60); // Sydney
  assert.equal(timing.approximateUtcOffsetMinutes(-7), 0); // rounds to nearest hour
  assert.equal(timing.approximateUtcOffsetMinutes(undefined), null);
  assert.equal(timing.approximateUtcOffsetMinutes(NaN), null);
});

test("habitat inference maps hotspot names to time-of-day windows", () => {
  assert.equal(timing.inferStopTiming("Sweetwater Wetlands").window, "dawn");
  assert.equal(timing.inferStopTiming("Tres Rios Marsh").habitat, "marsh");
  assert.equal(timing.inferStopTiming("Glendale Recharge Ponds").window, "daylight");
  assert.equal(timing.inferStopTiming("Ramsey Canyon Preserve").window, "dawn");
  assert.equal(timing.inferStopTiming("Hitchcock Nature Center Hawk Watch").window, "midday");
  assert.equal(timing.inferStopTiming("Owl Woods").window, "dusk");
  assert.equal(timing.inferStopTiming("Encanto Park").window, "morning");
  assert.equal(timing.inferStopTiming("").habitat, "general");
});

test("arrival estimates increase with route progress and include half the detour", () => {
  const base = {
    departureMs: Date.UTC(2026, 5, 1, 13),
    routeDurationSeconds: 4 * 3600
  };
  const early = timing.estimateArrivalMs({ ...base, routeProgress: 0.25, addedMinutes: 0 });
  const late = timing.estimateArrivalMs({ ...base, routeProgress: 0.75, addedMinutes: 0 });
  const withDetour = timing.estimateArrivalMs({ ...base, routeProgress: 0.25, addedMinutes: 40 });

  assert.equal(early, base.departureMs + HOUR_MS);
  assert.equal(late, base.departureMs + 3 * HOUR_MS);
  assert.equal(withDetour - early, 20 * 60000);
  assert.equal(timing.estimateArrivalMs({ ...base, routeProgress: Number.NaN }), null);
});

test("arrival assessment flags a midday marsh and rewards a dawn marsh", () => {
  const sunriseMs = Date.UTC(2026, 5, 1, 12);
  const sunsetMs = sunriseMs + 14 * HOUR_MS;
  const midday = timing.assessArrival({
    arrivalMs: sunriseMs + 8 * HOUR_MS,
    sunriseMs,
    sunsetMs,
    window: "dawn"
  });
  const dawn = timing.assessArrival({
    arrivalMs: sunriseMs + HOUR_MS,
    sunriseMs,
    sunsetMs,
    window: "dawn"
  });

  assert.equal(midday.quality, "poor");
  assert.equal(dawn.quality, "prime");
});

test("arrival assessment handles darkness, dusk specialists, and raptor middays", () => {
  const sunriseMs = Date.UTC(2026, 5, 1, 12);
  const sunsetMs = sunriseMs + 14 * HOUR_MS;

  const afterDark = timing.assessArrival({
    arrivalMs: sunsetMs + 2 * HOUR_MS,
    sunriseMs,
    sunsetMs,
    window: "morning"
  });
  assert.equal(afterDark.quality, "dark");

  const owlAtDusk = timing.assessArrival({
    arrivalMs: sunsetMs + HOUR_MS,
    sunriseMs,
    sunsetMs,
    window: "dusk"
  });
  assert.equal(owlAtDusk.quality, "prime");

  const hawkWatchMidday = timing.assessArrival({
    arrivalMs: sunriseMs + 6 * HOUR_MS,
    sunriseMs,
    sunsetMs,
    window: "midday"
  });
  assert.equal(hawkWatchMidday.quality, "prime");

  const openWaterAfternoon = timing.assessArrival({
    arrivalMs: sunriseMs + 8 * HOUR_MS,
    sunriseMs,
    sunsetMs,
    window: "daylight"
  });
  assert.equal(openWaterAfternoon.quality, "good");

  const polarNight = timing.assessArrival({
    arrivalMs: sunriseMs,
    polar: "night",
    window: "morning"
  });
  assert.equal(polarNight.quality, "dark");
});
