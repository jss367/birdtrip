(function exposeBirdtripRanking(root) {
  "use strict";

  const EARTH_RADIUS_KM = 6371;

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
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
      lng: segment.start.lng + (segment.end.lng - segment.start.lng) * ratio,
      lat: segment.start.lat + (segment.end.lat - segment.start.lat) * ratio
    };
  }

  function sampleRouteForCoverage(coordinates, options = {}) {
    const corridorRadiusKm = clamp(Number(options.corridorRadiusKm), 1, 50);
    const queryRadiusKm = clamp(Number(options.queryRadiusKm ?? 200), corridorRadiusKm + 1, 500);
    const maxSamples = Math.max(2, Math.floor(Number(options.maxSamples) || 16));
    const { segments, totalKm } = routeSegments(Array.isArray(coordinates) ? coordinates : []);
    if (!segments.length) {
      return { samples: [], totalKm: 0, requiredSamples: 0, coverageComplete: true, queryRadiusKm };
    }

    const maxSpacingKm = Math.max(1, 2 * (queryRadiusKm - corridorRadiusKm));
    const requiredSamples = Math.max(2, Math.ceil(totalKm / maxSpacingKm) + 1);
    const sampleCount = Math.min(maxSamples, requiredSamples);
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
      coverageComplete: requiredSamples <= maxSamples,
      queryRadiusKm,
      maxSpacingKm
    };
  }

  function nearestPointOnSegmentKm(point, segment) {
    const meanLat = toRadians((point.lat + segment.start.lat + segment.end.lat) / 3);
    const lngKm = 111.32 * Math.max(0.01, Math.cos(meanLat));
    const latKm = 110.574;
    const bx = (segment.end.lng - segment.start.lng) * lngKm;
    const by = (segment.end.lat - segment.start.lat) * latKm;
    const px = (point.lng - segment.start.lng) * lngKm;
    const py = (point.lat - segment.start.lat) * latKm;
    const lengthSquared = bx * bx + by * by;
    const ratio = lengthSquared ? clamp((px * bx + py * by) / lengthSquared, 0, 1) : 0;
    const dx = px - bx * ratio;
    const dy = py - by * ratio;
    return { distanceKm: Math.hypot(dx, dy), ratio };
  }

  function distanceToRouteKm(point, coordinates) {
    const { segments, totalKm } = routeSegments(Array.isArray(coordinates) ? coordinates : []);
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

  function richnessPrior(numSpeciesAllTime) {
    const richness = Math.max(0, Number(numSpeciesAllTime) || 0);
    return Math.log1p(richness) / Math.log1p(500);
  }

  root.BirdtripRanking = Object.freeze({
    clamp,
    distanceToRouteKm,
    haversineKm,
    normalizedScore,
    observationFreshnessWeight,
    parseObservationDay,
    richnessPrior,
    sampleRouteForCoverage
  });
}(globalThis));
