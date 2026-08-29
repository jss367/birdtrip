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

test("stop clock offsets shift by each stop's solar zone on cross-timezone routes", () => {
  // New York -> Los Angeles viewed from New York in summer: the origin is
  // displayed with the exact browser offset (EDT, UTC-4). LA sits three
  // rounded solar hours west, so its clocks shift to UTC-7 (PDT).
  assert.deepEqual(
    timing.stopClockOffsetMinutes({ originDisplayOffsetMinutes: -4 * 60, originLng: -74.006, stopLng: -118.243 }),
    { offsetMinutes: -7 * 60, shifted: true }
  );
  // A stop in the origin's solar zone (Washington, DC) keeps the exact
  // browser offset, DST included.
  assert.deepEqual(
    timing.stopClockOffsetMinutes({ originDisplayOffsetMinutes: -4 * 60, originLng: -74.006, stopLng: -77.037 }),
    { offsetMinutes: -4 * 60, shifted: false }
  );
  // Approximate mode (viewer's clock doesn't match the route): the origin is
  // displayed at its solar offset and each stop lands on its own solar zone.
  assert.deepEqual(
    timing.stopClockOffsetMinutes({ originDisplayOffsetMinutes: -5 * 60, originLng: -74.006, stopLng: -118.243 }),
    { offsetMinutes: -8 * 60, shifted: true }
  );
  // Missing longitudes fall back to the origin display offset, unshifted.
  assert.deepEqual(
    timing.stopClockOffsetMinutes({ originDisplayOffsetMinutes: -4 * 60, originLng: undefined, stopLng: -118.243 }),
    { offsetMinutes: -4 * 60, shifted: false }
  );
  assert.deepEqual(
    timing.stopClockOffsetMinutes({ originDisplayOffsetMinutes: -4 * 60, originLng: -74.006, stopLng: NaN }),
    { offsetMinutes: -4 * 60, shifted: false }
  );
  assert.deepEqual(
    timing.stopClockOffsetMinutes({ originDisplayOffsetMinutes: NaN, originLng: -74.006, stopLng: -118.243 }),
    { offsetMinutes: null, shifted: false }
  );
});

test("calendar days apart count displayed midnights between departure and arrival", () => {
  // Depart 10 PM UTC-5; 2.5 hours of driving lands at 12:30 AM the next
  // displayed day.
  const departure = Date.UTC(2026, 7, 28, 3, 0); // 10:00 PM Aug 27, UTC-5
  assert.equal(
    timing.calendarDaysApart({ fromMs: departure, toMs: departure + 2.5 * HOUR_MS, offsetMinutes: -5 * 60 }),
    1
  );
  // An hour after departure is still 11 PM on the departure day.
  assert.equal(
    timing.calendarDaysApart({ fromMs: departure, toMs: departure + 1 * HOUR_MS, offsetMinutes: -5 * 60 }),
    0
  );
  // The day boundary follows the display offset: at UTC-6 the same arrival
  // instant is 11:30 PM, still on the departure day.
  assert.equal(
    timing.calendarDaysApart({ fromMs: departure, toMs: departure + 2.5 * HOUR_MS, offsetMinutes: -6 * 60 }),
    0
  );
  // A cross-country route can land several displayed days later.
  assert.equal(
    timing.calendarDaysApart({ fromMs: departure, toMs: departure + 49 * HOUR_MS, offsetMinutes: -5 * 60 }),
    2
  );
  // Non-finite inputs are rejected rather than guessed at.
  assert.equal(timing.calendarDaysApart({ fromMs: NaN, toMs: departure, offsetMinutes: 0 }), null);
  assert.equal(timing.calendarDaysApart({ fromMs: departure, toMs: departure, offsetMinutes: undefined }), null);
  assert.equal(timing.calendarDaysApart({}), null);
});

test("calendar days apart read each instant on its own displayed clock", () => {
  // Eastbound overnight: depart Los Angeles (UTC-8) at 10 PM, arrive New
  // York (UTC-5) 8 hours later at 9 AM the next displayed day. On the stop's
  // clock alone the departure already reads 1 AM "tomorrow", which would hide
  // the overnight; the origin's clock keeps it on the departure day.
  const laDeparture = Date.UTC(2026, 7, 28, 6, 0); // 10:00 PM Aug 27, UTC-8
  assert.equal(
    timing.calendarDaysApart({
      fromMs: laDeparture,
      toMs: laDeparture + 8 * HOUR_MS,
      fromOffsetMinutes: -8 * 60,
      toOffsetMinutes: -5 * 60
    }),
    1
  );
  // Westbound with same-day clocks: depart New York (UTC-5) at 8 AM, arrive
  // Los Angeles (UTC-8) 12 hours later at 5 PM the same displayed day — no
  // marker even though the elapsed time nearly spans the origin's evening.
  const nyDeparture = Date.UTC(2026, 7, 28, 13, 0); // 8:00 AM Aug 28, UTC-5
  assert.equal(
    timing.calendarDaysApart({
      fromMs: nyDeparture,
      toMs: nyDeparture + 12 * HOUR_MS,
      fromOffsetMinutes: -5 * 60,
      toOffsetMinutes: -8 * 60
    }),
    0
  );
  // Westbound just after midnight: depart at 12:15 AM UTC-5, drive 30
  // minutes to a stop displayed at UTC-6 — the arrival reads 11:45 PM on the
  // PREVIOUS displayed date, so the difference is -1, not 0.
  const postMidnightDeparture = Date.UTC(2026, 7, 28, 5, 15); // 12:15 AM Aug 28, UTC-5
  assert.equal(
    timing.calendarDaysApart({
      fromMs: postMidnightDeparture,
      toMs: postMidnightDeparture + 0.5 * HOUR_MS,
      fromOffsetMinutes: -5 * 60,
      toOffsetMinutes: -6 * 60
    }),
    -1
  );
  // A lone `offsetMinutes` still applies to both instants.
  assert.equal(
    timing.calendarDaysApart({
      fromMs: laDeparture,
      toMs: laDeparture + 8 * HOUR_MS,
      offsetMinutes: -5 * 60
    }),
    0
  );
  // Per-side offsets must both be finite.
  assert.equal(
    timing.calendarDaysApart({ fromMs: laDeparture, toMs: laDeparture, fromOffsetMinutes: -8 * 60 }),
    null
  );
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

test("habitat keywords only match whole words, not place-name substrings", () => {
  assert.equal(timing.inferStopTiming("Marshall Park").habitat, "general");
  assert.equal(timing.inferStopTiming("Swampscott Town Hall").habitat, "general");
  assert.equal(timing.inferStopTiming("Napier Overlook").habitat, "general");
  assert.equal(timing.inferStopTiming("Riverside Trailer Park").habitat, "general");
  assert.equal(timing.inferStopTiming("Blakely Island").habitat, "general");
  // Genuine habitat forms still match.
  assert.equal(timing.inferStopTiming("Great Marshes Overlook").habitat, "marsh");
  assert.equal(timing.inferStopTiming("Marshlands Conservancy").habitat, "marsh");
  assert.equal(timing.inferStopTiming("Cypress Swamp Boardwalk").habitat, "marsh");
  assert.equal(timing.inferStopTiming("Lakeview Overlook").habitat, "open water");
  assert.equal(timing.inferStopTiming("Municipal Pier").habitat, "open water");
  assert.equal(timing.inferStopTiming("Canal Trailhead").habitat, "woodland");
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

test("dusk-window dawn bonus only applies near sunrise, not deep night", () => {
  const sunriseMs = Date.UTC(2026, 5, 1, 12);
  const sunsetMs = sunriseMs + 14 * HOUR_MS;

  const owlPreDawn = timing.assessArrival({
    arrivalMs: sunriseMs - HOUR_MS,
    sunriseMs,
    sunsetMs,
    window: "dusk"
  });
  assert.equal(owlPreDawn.quality, "prime");

  const owlDeepNight = timing.assessArrival({
    arrivalMs: sunriseMs - 4 * HOUR_MS,
    sunriseMs,
    sunsetMs,
    window: "dusk"
  });
  assert.equal(owlDeepNight.quality, "good");
  assert.match(owlDeepNight.note, /night hours/i);
});

test("polar daylight is poor for dusk specialists but good otherwise", () => {
  const arrivalMs = Date.UTC(2026, 5, 21, 12);

  const owlMidnightSun = timing.assessArrival({
    arrivalMs,
    polar: "day",
    window: "dusk"
  });
  assert.equal(owlMidnightSun.quality, "poor");
  assert.match(owlMidnightSun.note, /no dusk or night/i);

  const marshMidnightSun = timing.assessArrival({
    arrivalMs,
    polar: "day",
    window: "dawn"
  });
  assert.equal(marshMidnightSun.quality, "good");
});
