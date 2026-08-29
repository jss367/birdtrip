(function exposeBirdtripTiming(root) {
  "use strict";

  const DAY_MS = 86400000;
  const HOUR_MS = 3600000;
  const J2000_NOON_MS = Date.UTC(2000, 0, 1, 12);
  const OBLIQUITY_DEGREES = 23.4397;
  const SUN_ALTITUDE_AT_HORIZON = -0.833;

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  function toDegrees(radians) {
    return radians * 180 / Math.PI;
  }

  function positiveModulo(value, modulus) {
    return ((value % modulus) + modulus) % modulus;
  }

  // Sunrise-equation solar calculation (NOAA-style, accurate to a couple of
  // minutes) for the local solar day containing `atMs` at east-positive `lng`.
  function sunTimes(atMs, lat, lng) {
    if (!Number.isFinite(atMs) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const daysSinceEpoch = (atMs - J2000_NOON_MS) / DAY_MS;
    const dayNumber = Math.round(daysSinceEpoch + lng / 360);
    const meanSolarNoon = dayNumber + 0.0009 - lng / 360;
    const meanAnomalyDegrees = positiveModulo(357.5291 + 0.98560028 * meanSolarNoon, 360);
    const meanAnomaly = toRadians(meanAnomalyDegrees);
    const equationOfCenter = 1.9148 * Math.sin(meanAnomaly)
      + 0.02 * Math.sin(2 * meanAnomaly)
      + 0.0003 * Math.sin(3 * meanAnomaly);
    const eclipticLongitude = toRadians(positiveModulo(meanAnomalyDegrees + equationOfCenter + 180 + 102.9372, 360));
    const transitDays = meanSolarNoon
      + 0.0053 * Math.sin(meanAnomaly)
      - 0.0069 * Math.sin(2 * eclipticLongitude);
    const sinDeclination = Math.sin(eclipticLongitude) * Math.sin(toRadians(OBLIQUITY_DEGREES));
    const declination = Math.asin(sinDeclination);
    const latitude = toRadians(lat);
    const cosHourAngle = (Math.sin(toRadians(SUN_ALTITUDE_AT_HORIZON)) - Math.sin(latitude) * sinDeclination)
      / (Math.cos(latitude) * Math.cos(declination));
    const solarNoonMs = J2000_NOON_MS + transitDays * DAY_MS;
    if (cosHourAngle > 1) return { sunriseMs: null, sunsetMs: null, solarNoonMs, polar: "night" };
    if (cosHourAngle < -1) return { sunriseMs: null, sunsetMs: null, solarNoonMs, polar: "day" };
    const hourAngleDays = toDegrees(Math.acos(cosHourAngle)) / 360;
    return {
      sunriseMs: solarNoonMs - hourAngleDays * DAY_MS,
      sunsetMs: solarNoonMs + hourAngleDays * DAY_MS,
      solarNoonMs,
      polar: null
    };
  }

  // Nautical-style UTC offset estimate for a longitude, in minutes east of
  // UTC, rounded to the nearest hour. Civil timezones mostly track this within
  // an hour (daylight saving and politically wide zones are the exceptions),
  // which is enough to decide whether a viewer's clock plausibly matches the
  // route's, and to anchor clock displays when it clearly does not.
  function approximateUtcOffsetMinutes(lng) {
    if (!Number.isFinite(lng)) return null;
    return Math.round(lng / 15) * 60 || 0; // "|| 0" normalizes -0
  }

  // Resolve the UTC offset (in minutes) to use when displaying a stop's clock
  // times, given the offset already used for the route origin's clocks. Stops
  // whose rounded solar zone matches the origin's keep the origin display
  // offset unchanged (`shifted: false` — in the common case that offset is the
  // browser timezone, exact and DST-correct). Stops a rounded hour or more
  // away shift the origin display offset by the solar difference, which keeps
  // DST consistent when both zones observe the same daylight-saving rules but
  // is still an approximation (`shifted: true`).
  function stopClockOffsetMinutes({ originDisplayOffsetMinutes, originLng, stopLng }) {
    const originSolarOffset = approximateUtcOffsetMinutes(originLng);
    const stopSolarOffset = approximateUtcOffsetMinutes(stopLng);
    if (!Number.isFinite(originDisplayOffsetMinutes)
      || originSolarOffset === null
      || stopSolarOffset === null
      || stopSolarOffset === originSolarOffset) {
      return { offsetMinutes: Number.isFinite(originDisplayOffsetMinutes) ? originDisplayOffsetMinutes : null, shifted: false };
    }
    return { offsetMinutes: originDisplayOffsetMinutes + (stopSolarOffset - originSolarOffset), shifted: true };
  }

  // Whole calendar days between two instants as read off the clocks they are
  // displayed on: 0 when both fall on the same displayed date, 1 when `toMs`
  // lands on the next displayed date, and so on. Each instant can carry its
  // own display offset (`fromOffsetMinutes`/`toOffsetMinutes`, east of UTC),
  // because a route that crosses time zones shows the departure on the
  // origin's clock and the arrival on the stop's; a single `offsetMinutes`
  // covers both when the clocks agree. Used to flag arrivals that a long
  // route pushes past midnight, which would otherwise render as the same
  // clock time on the wrong day.
  function calendarDaysApart(options = {}) {
    const fromMs = Number(options.fromMs);
    const toMs = Number(options.toMs);
    const fromOffsetMinutes = Number(options.fromOffsetMinutes ?? options.offsetMinutes);
    const toOffsetMinutes = Number(options.toOffsetMinutes ?? options.offsetMinutes);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)
      || !Number.isFinite(fromOffsetMinutes) || !Number.isFinite(toOffsetMinutes)) return null;
    const dayIndex = (ms, offsetMinutes) => Math.floor((ms + offsetMinutes * 60000) / DAY_MS);
    return dayIndex(toMs, toOffsetMinutes) - dayIndex(fromMs, fromOffsetMinutes);
  }

  // Ordered by specificity: an "Owl Woods" is an owling spot before it is
  // woodland, and a "Marsh Lake" is a marsh before it is open water.
  const HABITAT_RULES = [
    {
      habitat: "nocturnal",
      window: "dusk",
      bestLabel: "best at dusk or night",
      pattern: /\bowls?\b|nightjar|poor-?will|whip-?poor-?will|nighthawk/i
    },
    {
      habitat: "raptor watch",
      window: "midday",
      bestLabel: "best mid-morning to afternoon",
      pattern: /hawk ?watch|raptor|eagle ?watch/i
    },
    {
      habitat: "marsh",
      window: "dawn",
      bestLabel: "best at dawn",
      pattern: /marsh|wetlands?\b|swamp|slough|bog\b|fen\b|cienega|ciénega|estuar|riparian|oxbow|bosque|billabong/i
    },
    {
      habitat: "open water",
      window: "daylight",
      bestLabel: "good through the day",
      pattern: /lake|reservoir|ponds?\b|lagoon|\bbay\b|harbou?r|beach|jetty|pier\b|mudflat|tidal|salt ?flat|sewage|water treatment|\bwtp\b|\bstp\b|impoundment|inlet|seawatch|shorebird/i
    },
    {
      habitat: "woodland",
      window: "dawn",
      bestLabel: "best in early morning",
      pattern: /forest|woods?\b|woodland|grove|canyon|arboretum|botanic|gardens?\b|cemetery|campus|greenway|nature (center|centre)|sanctuary|preserve|refuge|trail/i
    }
  ];

  function inferStopTiming(name) {
    const text = String(name || "");
    for (const rule of HABITAT_RULES) {
      if (rule.pattern.test(text)) {
        return { habitat: rule.habitat, window: rule.window, bestLabel: rule.bestLabel };
      }
    }
    return { habitat: "general", window: "morning", bestLabel: "best in the morning" };
  }

  // Arrival is departure plus driving to this point along the direct route,
  // plus half the round-trip detour (the outbound leg of the side trip).
  function estimateArrivalMs(options = {}) {
    const departureMs = Number(options.departureMs);
    const durationSeconds = Number(options.routeDurationSeconds);
    if (!Number.isFinite(departureMs) || !Number.isFinite(durationSeconds)) return null;
    const progress = Number(options.routeProgress);
    if (!Number.isFinite(progress)) return null;
    const boundedProgress = Math.max(0, Math.min(1, progress));
    const detourMinutes = Number.isFinite(Number(options.addedMinutes)) ? Number(options.addedMinutes) : 0;
    return departureMs + boundedProgress * durationSeconds * 1000 + (detourMinutes / 2) * 60000;
  }

  function assessArrival(options = {}) {
    const arrivalMs = Number(options.arrivalMs);
    if (!Number.isFinite(arrivalMs)) return null;
    const timeWindow = options.window || "morning";
    if (options.polar === "night") {
      return timeWindow === "dusk"
        ? { quality: "good", note: "continuous polar darkness suits nocturnal birds" }
        : { quality: "dark", note: "continuous polar darkness at this latitude right now" };
    }
    if (options.polar === "day") {
      return timeWindow === "dusk"
        ? { quality: "poor", note: "continuous polar daylight leaves no dusk or night window" }
        : { quality: "good", note: "continuous daylight at this latitude right now" };
    }
    const sunriseMs = Number(options.sunriseMs);
    const sunsetMs = Number(options.sunsetMs);
    if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs)) return null;
    const hoursAfterSunrise = (arrivalMs - sunriseMs) / HOUR_MS;
    const hoursBeforeSunset = (sunsetMs - arrivalMs) / HOUR_MS;

    if (timeWindow === "dusk") {
      const nearSunset = Math.abs(arrivalMs - sunsetMs) / HOUR_MS <= 1.5;
      const nearDawn = hoursAfterSunrise >= -1.5 && hoursAfterSunrise <= 0.5;
      if (nearSunset || nearDawn) return { quality: "prime", note: "prime window for nocturnal birds" };
      if (hoursAfterSunrise < 0 || hoursBeforeSunset < 0) {
        return { quality: "good", note: "night hours can work for nocturnal birds" };
      }
      return { quality: "poor", note: "daytime is quiet for nocturnal birds" };
    }

    if (hoursAfterSunrise < -0.75) return { quality: "dark", note: "arrives before first light" };
    if (hoursBeforeSunset < -0.75) return { quality: "dark", note: "arrives after dark" };

    if (timeWindow === "midday") {
      if (hoursAfterSunrise >= 3 && hoursBeforeSunset >= 2.5) {
        return { quality: "prime", note: "midday thermals are ideal here" };
      }
      return { quality: "fair", note: "soaring birds wait for thermals to build mid-morning" };
    }
    if (timeWindow === "daylight") {
      if (hoursAfterSunrise <= 4) return { quality: "prime", note: "morning light and activity are ideal" };
      return { quality: "good", note: "open-water birds stay active through the day" };
    }
    if (timeWindow === "dawn") {
      if (hoursAfterSunrise <= 3) return { quality: "prime", note: "within the dawn activity window" };
      if (hoursAfterSunrise <= 4.5) return { quality: "good", note: "still within the active morning" };
      if (hoursBeforeSunset <= 2) return { quality: "fair", note: "evening activity picks up, though dawn is better" };
      return { quality: "poor", note: "midday lull" };
    }
    if (hoursAfterSunrise <= 4) return { quality: "prime", note: "within the prime morning window" };
    if (hoursAfterSunrise <= 5.5) return { quality: "good", note: "late morning is still productive" };
    if (hoursBeforeSunset <= 2.5) return { quality: "fair", note: "evening activity picks up before sunset" };
    return { quality: "poor", note: "midday lull" };
  }

  root.BirdtripTiming = Object.freeze({
    approximateUtcOffsetMinutes,
    assessArrival,
    calendarDaysApart,
    estimateArrivalMs,
    inferStopTiming,
    stopClockOffsetMinutes,
    sunTimes
  });
}(globalThis));
