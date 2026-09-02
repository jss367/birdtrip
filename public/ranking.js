(function exposeBirdtripRanking(root) {
  "use strict";

  const EARTH_RADIUS_KM = 6371;

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  function normalizeLongitude(degrees) {
    return ((degrees + 180) % 360 + 360) % 360 - 180;
  }

  function longitudeDelta(from, to) {
    return normalizeLongitude(to - from);
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  function haversineKm(a, b) {
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
  }

  function routeSegments(coordinates) {
    const segments = [];
    let cumulativeKm = 0;
    for (let index = 1; index < coordinates.length; index += 1) {
      const start = { lng: coordinates[index - 1][0], lat: coordinates[index - 1][1] };
      const end = { lng: coordinates[index][0], lat: coordinates[index][1] };
      const distanceKm = haversineKm(start, end);
      segments.push({ start, end, distanceKm, startKm: cumulativeKm });
      cumulativeKm += distanceKm;
    }
    return { segments, totalKm: cumulativeKm };
  }

  function interpolateSegment(segment, distanceKm) {
    const ratio = segment.distanceKm
      ? clamp(distanceKm / segment.distanceKm, 0, 1)
      : 0;
    return {
      lng: normalizeLongitude(segment.start.lng + longitudeDelta(segment.start.lng, segment.end.lng) * ratio),
      lat: segment.start.lat + (segment.end.lat - segment.start.lat) * ratio
    };
  }

  function sampleRouteForCoverage(coordinates, options = {}) {
    const corridorRadiusKm = clamp(Number(options.corridorRadiusKm), 1, 50);
    const queryRadiusKm = clamp(Number(options.queryRadiusKm ?? 200), 1, 500);
    const coverageFeasible = queryRadiusKm > corridorRadiusKm;
    const maxSamples = Math.max(2, Math.floor(Number(options.maxSamples) || 16));
    const { segments, totalKm } = routeSegments(Array.isArray(coordinates) ? coordinates : []);
    if (!segments.length) {
      return {
        samples: [],
        totalKm: 0,
        requiredSamples: 0,
        coverageComplete: true,
        coverageFeasible,
        queryRadiusKm
      };
    }

    const maxSpacingKm = coverageFeasible ? 2 * (queryRadiusKm - corridorRadiusKm) : 0;
    const requiredSamples = coverageFeasible
      ? Math.max(2, Math.ceil(totalKm / maxSpacingKm) + 1)
      : Infinity;
    const sampleCount = coverageFeasible ? Math.min(maxSamples, requiredSamples) : maxSamples;
    const samples = [];
    let segmentIndex = 0;

    for (let index = 0; index < sampleCount; index += 1) {
      const targetKm = sampleCount === 1 ? 0 : totalKm * index / (sampleCount - 1);
      while (
        segmentIndex < segments.length - 1
        && segments[segmentIndex].startKm + segments[segmentIndex].distanceKm < targetKm
      ) {
        segmentIndex += 1;
      }
      const segment = segments[segmentIndex];
      const point = interpolateSegment(segment, targetKm - segment.startKm);
      samples.push({ ...point, index, progress: totalKm ? targetKm / totalKm : 0 });
    }

    return {
      samples,
      totalKm,
      requiredSamples,
      coverageComplete: coverageFeasible && requiredSamples <= maxSamples,
      coverageFeasible,
      queryRadiusKm,
      maxSpacingKm
    };
  }

  function nearestPointOnSegmentKm(point, segment) {
    const meanLat = toRadians((point.lat + segment.start.lat + segment.end.lat) / 3);
    const lngKm = 111.32 * Math.max(0.01, Math.cos(meanLat));
    const latKm = 110.574;
    const bx = longitudeDelta(segment.start.lng, segment.end.lng) * lngKm;
    const by = (segment.end.lat - segment.start.lat) * latKm;
    const px = longitudeDelta(segment.start.lng, point.lng) * lngKm;
    const py = (point.lat - segment.start.lat) * latKm;
    const lengthSquared = bx * bx + by * by;
    const ratio = lengthSquared ? clamp((px * bx + py * by) / lengthSquared, 0, 1) : 0;
    const dx = px - bx * ratio;
    const dy = py - by * ratio;
    return { distanceKm: Math.hypot(dx, dy), ratio };
  }

  function distanceToRouteIndex(point, segments, totalKm) {
    if (!segments.length) return { distanceKm: Infinity, progress: 0 };
    let nearest = { distanceKm: Infinity, progressKm: 0 };
    for (const segment of segments) {
      const result = nearestPointOnSegmentKm(point, segment);
      if (result.distanceKm < nearest.distanceKm) {
        nearest = {
          distanceKm: result.distanceKm,
          progressKm: segment.startKm + segment.distanceKm * result.ratio
        };
      }
    }
    return {
      distanceKm: nearest.distanceKm,
      progress: totalKm ? nearest.progressKm / totalKm : 0
    };
  }

  function createRouteIndex(coordinates) {
    const { segments, totalKm } = routeSegments(Array.isArray(coordinates) ? coordinates : []);
    return Object.freeze({
      totalKm,
      distanceTo(point) {
        return distanceToRouteIndex(point, segments, totalKm);
      }
    });
  }

  function distanceToRouteKm(point, coordinates) {
    return createRouteIndex(coordinates).distanceTo(point);
  }

  function filterHotspotsByCorridor(hotspots, routeIndex, corridorRadiusKm) {
    const radiusKm = Math.max(0, Number(corridorRadiusKm) || 0);
    if (!routeIndex || typeof routeIndex.distanceTo !== "function") return [];
    return Array.from(hotspots || [])
      .filter((hotspot) => (
        hotspot?.locId
        && Number.isFinite(hotspot.lat)
        && Number.isFinite(hotspot.lng)
      ))
      .map((hotspot) => {
        const routeMatch = routeIndex.distanceTo(hotspot);
        return {
          ...hotspot,
          routeDistanceKm: routeMatch.distanceKm,
          routeProgress: routeMatch.progress
        };
      })
      .filter((hotspot) => hotspot.routeDistanceKm <= radiusKm);
  }

  function backfillRouteMetrics(candidates, coordinates) {
    const list = Array.isArray(candidates) ? candidates : [];
    const points = Array.isArray(coordinates) ? coordinates : [];
    if (!points.length) return list;
    const missing = list.filter((candidate) => (
      candidate
      && typeof candidate === "object"
      && Number.isFinite(candidate.lat)
      && Number.isFinite(candidate.lng)
      && (!Number.isFinite(candidate.routeProgress) || !Number.isFinite(candidate.routeDistanceKm))
    ));
    if (!missing.length) return list;
    const routeIndex = createRouteIndex(points);
    for (const candidate of missing) {
      const routeMatch = routeIndex.distanceTo(candidate);
      if (!Number.isFinite(candidate.routeProgress)) candidate.routeProgress = routeMatch.progress;
      if (!Number.isFinite(candidate.routeDistanceKm)) candidate.routeDistanceKm = routeMatch.distanceKm;
    }
    return list;
  }

  // Bounds the route-mode re-ranking pool while retaining rescued candidates.
  // Every pool member gets a notable lookup so members stay comparable when
  // the balance changes, so the pool is truncated — but candidates that were
  // deliberately rescued must survive the cut or the rescue work is wasted:
  // explicit target rescues are all kept (they are bounded upstream), and
  // target-match / unseen-species extras are kept up to maxStops per kind.
  //
  // deriveVisibleResults shows the top maxStops of the pool at the current
  // balance level, so the pool must contain the top maxStops under EVERY
  // selectable level (the slider is a finite set of presets, one utility
  // function per level in options.balanceUtilities). The pool is exactly
  // that: for each level, take its top maxStops under that level's
  // ordering; the pool is the deduplicated union, plus rescue retention.
  // This is definitionally sufficient — each level's visible set is in the
  // pool verbatim — and there is no fixed cap: the union's worst case is
  // #levels * maxStops, and overlap between levels usually keeps it far
  // smaller. (Earlier schemes truncated the union under a fixed cap, which
  // could displace a level's own top-maxStops candidates; a capped
  // round-robin still gave each level only ~cap/#levels guaranteed slots.)
  // Each level's ordering breaks utility ties by candidate ID — the same
  // tie-break the visible ranking (compareByRankUtility) uses — so pool
  // selection and visible ranking cannot disagree on which tie member is
  // shown. Without balanceUtilities there is a single all-ties ordering,
  // so the pool is the ID-ordered top maxStops plus rescues.
  function selectNotableCandidates(candidates, options = {}) {
    const maxStops = Math.max(1, Math.floor(Number(options.maxStops) || 0) || 1);
    const list = Array.from(candidates || []);
    const utilities = Array.isArray(options.balanceUtilities) && options.balanceUtilities.length
      ? options.balanceUtilities
      : [() => 0];
    const top = [];
    const ids = new Set();
    for (const utility of utilities) {
      // One ordering per selectable level, using the SAME comparator the
      // visible ranking applies (compareByRankUtility): utility descending,
      // then candidate ID. Breaking ties by caller order instead would
      // diverge from the visible ranking exactly at ties — the caller's
      // order is the ACTIVE level's — so the pool could retain the wrong
      // tie member and drop the one deriveVisibleResults would show.
      const visible = list
        .map((candidate) => ({ candidate, utility: Number(utility(candidate)) || 0 }))
        .sort((a, b) => (b.utility - a.utility)
          || String(a.candidate.id).localeCompare(String(b.candidate.id)))
        .slice(0, maxStops);
      for (const entry of visible) {
        if (ids.has(entry.candidate.id)) continue;
        ids.add(entry.candidate.id);
        top.push(entry.candidate);
      }
    }
    const keep = (matches, limit) => {
      let added = 0;
      for (const candidate of list) {
        if (added >= limit) break;
        if (ids.has(candidate.id) || !matches(candidate)) continue;
        ids.add(candidate.id);
        top.push(candidate);
        added += 1;
      }
    };
    keep((candidate) => candidate.explicitTargetRescue, Infinity);
    keep((candidate) => (candidate.targetMatches?.length ?? 0) > 0, maxStops);
    keep((candidate) => (candidate.liferSpecies?.length ?? 0) > 0, maxStops);
    return top;
  }

  function detourImpact(viaRoute, baseRoute) {
    return {
      addedMinutes: Math.max(
        0,
        (Number(viaRoute?.durationSeconds) - Number(baseRoute?.durationSeconds)) / 60
      ),
      addedMiles: Math.max(
        0,
        (Number(viaRoute?.distanceMeters) - Number(baseRoute?.distanceMeters)) / 1609.344
      )
    };
  }

  function parseObservationDay(value) {
    const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  function observationFreshnessWeight(value, options = {}) {
    const observedDay = parseObservationDay(value);
    if (observedDay === null) return 0;
    const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const ageDays = Math.max(0, Math.floor((today - observedDay) / 86400000));
    if (ageDays <= 1) return 1;
    const halfLifeDays = Math.max(1, Number(options.halfLifeDays) || 7);
    return 2 ** (-(ageDays - 1) / halfLifeDays);
  }

  function normalizedScore(parts, enabledMaxima) {
    let earned = 0;
    let possible = 0;
    for (const [key, maximum] of Object.entries(enabledMaxima || {})) {
      if (!Number.isFinite(maximum) || maximum <= 0) continue;
      possible += maximum;
      earned += clamp(Number(parts?.[key]) || 0, 0, maximum);
    }
    return possible ? Math.round(100 * earned / possible) : 0;
  }

  function personalValueScore(options = {}) {
    // Normalize target credit to the number of targets actually requested
    // (capped at 5) so a single-target search can earn full target value.
    const targetSlots = clamp(Number(options.targetSlots) || 5, 1, 5);
    const targetValue = clamp(Number(options.weightedTargets) || 0, 0, targetSlots) / targetSlots;
    const unseenValue = clamp(Number(options.weightedUnseen) || 0, 0, 8) / 8;
    const targetsEnabled = Boolean(options.targetsEnabled);
    const unseenEnabled = Boolean(options.unseenEnabled);
    if (targetsEnabled && unseenEnabled) return targetValue * 8 + unseenValue * 7;
    if (targetsEnabled) return targetValue * 15;
    if (unseenEnabled) return unseenValue * 15;
    return 0;
  }

  function richnessPrior(numSpeciesAllTime) {
    const richness = Math.max(0, Number(numSpeciesAllTime) || 0);
    return richness ? Math.log1p(richness) / Math.log1p(richness + 500) : 0;
  }

  function currentActivityScore(weightedSpecies, weightedActivity) {
    return clamp(Number(weightedSpecies) || 0, 0, 90) / 90 * 28
      + clamp(Number(weightedActivity) || 0, 0, 250) / 250 * 7;
  }

  function practicalityScore(options = {}) {
    if (options.mode === "area") {
      const radiusKm = Math.max(Number(options.radiusKm) || 0, 1);
      return Math.max(0, 40 * (1 - (Number(options.routeDistanceKm) || 0) / radiusKm));
    }
    const maxDetour = Number(options.maxDetour) || 0;
    if (maxDetour === 0) return 40;
    return Math.max(0, 40 * (1 - (Number(options.addedMinutes) || 0) / Math.max(maxDetour, 1)));
  }

  function calculateCandidateScore(options = {}) {
    const targetsEnabled = Boolean(options.targetsEnabled);
    const unseenEnabled = Boolean(options.unseenEnabled);
    const enabledMaxima = {
      practicality: 40,
      current: 35,
      stable: 10,
      ...(targetsEnabled || unseenEnabled ? { personal: 15 } : {})
    };
    const scoreParts = {
      current: currentActivityScore(options.weightedSpecies, options.weightedActivity),
      stable: richnessPrior(options.allTimeSpeciesCount) * 10,
      personal: personalValueScore({
        weightedTargets: options.weightedTargets,
        weightedUnseen: options.weightedUnseen,
        targetSlots: options.targetSlots,
        targetsEnabled,
        unseenEnabled
      }),
      practicality: practicalityScore(options)
    };
    return {
      scoreParts,
      enabledScoreParts: Object.keys(enabledMaxima),
      score: normalizedScore(scoreParts, enabledMaxima)
    };
  }

  root.BirdtripRanking = Object.freeze({
    backfillRouteMetrics,
    calculateCandidateScore,
    clamp,
    createRouteIndex,
    currentActivityScore,
    detourImpact,
    distanceToRouteKm,
    filterHotspotsByCorridor,
    haversineKm,
    normalizedScore,
    observationFreshnessWeight,
    parseObservationDay,
    personalValueScore,
    practicalityScore,
    richnessPrior,
    sampleRouteForCoverage,
    selectNotableCandidates
  });
}(globalThis));
