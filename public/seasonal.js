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

  root.BirdtripSeasonal = Object.freeze({
    MONTH_LABELS,
    SEASONS,
    seasonsForLatitude,
    presenceRates,
    seasonAverages,
    seasonShares,
    seasonalSpecialties,
    specialtyScore
  });
}(globalThis));
