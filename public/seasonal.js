(function exposeBirdtripSeasonal(root) {
  "use strict";

  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const SEASONS = Object.freeze([
    Object.freeze({ key: "winter", label: "Winter", hint: "Dec–Feb", months: Object.freeze([11, 0, 1]) }),
    Object.freeze({ key: "spring", label: "Spring", hint: "Mar–May", months: Object.freeze([2, 3, 4]) }),
    Object.freeze({ key: "summer", label: "Summer", hint: "Jun–Aug", months: Object.freeze([5, 6, 7]) }),
    Object.freeze({ key: "fall", label: "Fall", hint: "Sep–Nov", months: Object.freeze([8, 9, 10]) })
  ]);

  const SOUTHERN_SEASONS = Object.freeze([
    Object.freeze({ key: "winter", label: "Winter", hint: "Jun–Aug", months: Object.freeze([5, 6, 7]) }),
    Object.freeze({ key: "spring", label: "Spring", hint: "Sep–Nov", months: Object.freeze([8, 9, 10]) }),
    Object.freeze({ key: "summer", label: "Summer", hint: "Dec–Feb", months: Object.freeze([11, 0, 1]) }),
    Object.freeze({ key: "fall", label: "Fall", hint: "Mar–May", months: Object.freeze([2, 3, 4]) })
  ]);

  function seasonsForLatitude(latitude) {
    return Number(latitude) < 0 ? SOUTHERN_SEASONS : SEASONS;
  }

  function mean(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function presenceRates(monthCounts, sampledDays) {
    return MONTH_LABELS.map((label, index) => {
      const sampled = Number(sampledDays?.[index]) || 0;
      if (sampled <= 0) return 0;
      const count = Number(monthCounts?.[index]) || 0;
      return Math.max(0, Math.min(1, count / sampled));
    });
  }

  function seasonAverages(presence, seasons = SEASONS) {
    return seasons.map((season) => mean(season.months.map((month) => presence[month] || 0)));
  }

  function seasonShares(seasonRates) {
    const total = seasonRates.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return seasonRates.map(() => 0);
    return seasonRates.map((value) => value / total);
  }

  // A bird present all year has a share of 0.25 in every season; the score only
  // rewards presence concentrated beyond that uniform baseline.
  function specialtyScore(seasonRate, share) {
    if (!(seasonRate > 0) || !(share > 0.25)) return 0;
    return seasonRate * ((share - 0.25) / 0.75);
  }

  function seasonalSpecialties(speciesList, sampledDays, options = {}) {
    const minSeasonRate = options.minSeasonRate ?? 0.4;
    const minShare = options.minShare ?? 0.35;
    const limit = options.limit ?? 8;
    const seasons = options.seasons || SEASONS;

    const result = {};
    for (const season of seasons) result[season.key] = [];

    for (const species of Array.isArray(speciesList) ? speciesList : []) {
      const presence = presenceRates(species.months, sampledDays);
      const seasonRates = seasonAverages(presence, seasons);
      const shares = seasonShares(seasonRates);
      seasons.forEach((season, index) => {
        if (seasonRates[index] < minSeasonRate || shares[index] < minShare) return;
        const offMonths = MONTH_LABELS
          .map((label, month) => month)
          .filter((month) => !season.months.includes(month));
        result[season.key].push({
          speciesCode: species.speciesCode,
          comName: species.comName,
          sciName: species.sciName || "",
          presence,
          seasonKey: season.key,
          seasonRate: seasonRates[index],
          offSeasonRate: mean(offMonths.map((month) => presence[month])),
          share: shares[index],
          score: specialtyScore(seasonRates[index], shares[index])
        });
      });
    }

    for (const season of seasons) {
      result[season.key].sort((a, b) => b.score - a.score || a.comName.localeCompare(b.comName));
      result[season.key] = result[season.key].slice(0, limit);
    }
    return result;
  }

  // Below this peak monthly rate a species is too thinly reported for its
  // months to read as a pattern rather than scattered sightings.
  const SPARSE_PEAK_RATE = 0.2;
  // Months at or above this fraction of the peak rate count as "in season".
  const WINDOW_FRACTION = 0.5;
  // Months at or above this fraction of the peak rate count as the peak.
  const PEAK_FRACTION = 0.8;

  // Groups month indexes into runs, joining across December→January, and
  // formats them in calendar order like "Nov–Feb" or "Apr–May and Sep".
  function formatMonthRanges(months) {
    const set = new Set(months);
    if (!set.size) return "";
    if (set.size === 12) return "Jan–Dec";
    let start = 0;
    while (set.has(start)) start += 1;
    const runs = [];
    let run = null;
    for (let step = 1; step <= 12; step += 1) {
      const month = (start + step) % 12;
      if (set.has(month)) {
        if (run) run.end = month;
        else run = { start: month, end: month };
      } else if (run) {
        runs.push(run);
        run = null;
      }
    }
    runs.sort((a, b) => a.start - b.start);
    const parts = runs.map((r) => (r.start === r.end
      ? MONTH_LABELS[r.start]
      : `${MONTH_LABELS[r.start]}–${MONTH_LABELS[r.end]}`));
    if (parts.length <= 2) return parts.join(" and ");
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  }

  // Classifies one species' sampled-date occurrence into a plain answer to
  // "when is it here?". A missing entry means the region build dropped it for
  // appearing on too few sampled dates.
  function speciesTiming(entry, sampledDays) {
    const totalSampled = (sampledDays || []).reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (!entry) {
      return { status: "absent", presence: Array(12).fill(0), reportedDays: 0, totalSampled, windowMonths: [], peakMonths: [] };
    }
    const presence = presenceRates(entry.months, sampledDays);
    const reportedDays = (entry.months || []).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const peakRate = Math.max(...presence);
    const reportedMonths = presence.map((rate, month) => (rate > 0 ? month : -1)).filter((month) => month >= 0);
    const windowMonths = presence
      .map((rate, month) => (peakRate > 0 && rate >= peakRate * WINDOW_FRACTION ? month : -1))
      .filter((month) => month >= 0);
    const peakMonths = presence
      .map((rate, month) => (peakRate > 0 && rate >= peakRate * PEAK_FRACTION ? month : -1))
      .filter((month) => month >= 0);

    let status = "seasonal";
    if (peakRate < SPARSE_PEAK_RATE) status = "sparse";
    else if (windowMonths.length === 12) status = "yearRound";

    return { status, presence, peakRate, reportedDays, totalSampled, reportedMonths, windowMonths, peakMonths };
  }

  function speciesTimingSentence(timing, comName, regionName) {
    const name = comName || "This species";
    const where = regionName ? ` in ${regionName}` : "";
    const peak = formatMonthRanges(timing.peakMonths);
    const inSeason = formatMonthRanges(timing.windowMonths);
    switch (timing.status) {
      case "absent":
        return `${name} wasn't reported on enough sampled dates${where} to show a pattern.`;
      case "sparse":
        return `${name} is reported only occasionally${where}: on ${timing.reportedDays} of ${timing.totalSampled} sampled dates, in ${formatMonthRanges(timing.reportedMonths)}.`;
      case "yearRound":
        // A peak spanning most of the year isn't worth calling out.
        return timing.peakMonths.length >= 9
          ? `${name} is reported year-round${where}.`
          : `${name} is reported year-round${where}, most often ${peak}.`;
      default:
        return inSeason === peak
          ? `${name} is reported${where} mainly ${inSeason}.`
          : `${name} is reported${where} mainly ${inSeason}, peaking ${peak}.`;
    }
  }

  // Condenses a geo/recent species response into the handful of facts shown
  // under the seasonal answer: how many places, the latest report, top spots.
  function recentSightingsSummary(observations, limit = 3) {
    const byLocation = new Map();
    let latest = null;
    for (const obs of Array.isArray(observations) ? observations : []) {
      if (!obs || !obs.obsDt) continue;
      const key = obs.locId || obs.locName;
      if (!key) continue;
      const place = byLocation.get(key) || { locId: obs.locId || "", locName: obs.locName || "", reports: 0, lastDate: "" };
      place.reports += 1;
      if (obs.obsDt > place.lastDate) place.lastDate = obs.obsDt;
      byLocation.set(key, place);
      if (!latest || obs.obsDt > latest.obsDt) latest = obs;
    }
    const locations = [...byLocation.values()].sort(
      (a, b) => b.reports - a.reports || b.lastDate.localeCompare(a.lastDate) || a.locName.localeCompare(b.locName)
    );
    return {
      locationCount: locations.length,
      latest: latest ? { locName: latest.locName || "", date: latest.obsDt } : null,
      topLocations: locations.slice(0, limit)
    };
  }

  root.BirdtripSeasonal = Object.freeze({
    MONTH_LABELS,
    SEASONS,
    seasonsForLatitude,
    presenceRates,
    seasonAverages,
    seasonShares,
    seasonalSpecialties,
    specialtyScore,
    formatMonthRanges,
    speciesTiming,
    speciesTimingSentence,
    recentSightingsSummary
  });
}(globalThis));
