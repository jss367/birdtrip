const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require("../public/seasonal.js");

const seasonal = globalThis.BirdtripSeasonal;

const FULL_SAMPLING = Array(12).fill(3);

test("seasonal UI describes sampled-date occurrence rather than checklist frequency", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/seasonal.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../public/seasonal-app.js"), "utf8");
  assert.match(html, /sampled-date occurrence/i);
  assert.match(`${html}\n${app}`, /not (?:complete-)?checklist frequency/i);
  assert.doesNotMatch(`${html}\n${app}`, /reporting rate/i);
});

function monthsFromRates(rates) {
  return rates.map((rate) => Math.round(rate * 3));
}

test("presence rates divide by sampled days and skip unsampled months", () => {
  const sampledDays = [3, 3, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3];
  const counts = [3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 6];
  const rates = seasonal.presenceRates(counts, sampledDays);

  assert.equal(rates[0], 1);
  assert.ok(Math.abs(rates[1] - 2 / 3) < 1e-9);
  assert.equal(rates[2], 0);
  assert.equal(rates[11], 1);
});

test("season shares are uniform for a year-round bird and zero without data", () => {
  const uniform = seasonal.seasonShares(seasonal.seasonAverages(Array(12).fill(0.9)));
  uniform.forEach((share) => assert.ok(Math.abs(share - 0.25) < 1e-9));

  const empty = seasonal.seasonShares(seasonal.seasonAverages(Array(12).fill(0)));
  empty.forEach((share) => assert.equal(share, 0));
});

test("specialty score rewards concentration above the uniform baseline", () => {
  assert.equal(seasonal.specialtyScore(0.9, 0.25), 0);
  assert.equal(seasonal.specialtyScore(0.9, 1), 0.9);
  assert.ok(seasonal.specialtyScore(0.9, 0.6) > seasonal.specialtyScore(0.9, 0.4));
  assert.ok(seasonal.specialtyScore(0.9, 0.6) > seasonal.specialtyScore(0.5, 0.6));
});

test("a winter-only bird is a winter specialty and nothing else", () => {
  const winterHawk = {
    speciesCode: "ferhaw",
    comName: "Ferruginous Hawk",
    sciName: "Buteo regalis",
    months: monthsFromRates([1, 1, 0.33, 0, 0, 0, 0, 0, 0, 0, 0.33, 1])
  };
  const result = seasonal.seasonalSpecialties([winterHawk], FULL_SAMPLING);

  assert.equal(result.winter.length, 1);
  assert.equal(result.winter[0].speciesCode, "ferhaw");
  assert.ok(result.winter[0].seasonRate > 0.9);
  assert.ok(result.winter[0].offSeasonRate < 0.1);
  assert.equal(result.spring.length, 0);
  assert.equal(result.summer.length, 0);
  assert.equal(result.fall.length, 0);
});

test("Southern Hemisphere seasons use the opposite three-month groups", () => {
  const southernSeasons = seasonal.seasonsForLatitude(-33.9);
  assert.deepEqual(southernSeasons.map((season) => season.months), [
    [5, 6, 7],
    [8, 9, 10],
    [11, 0, 1],
    [2, 3, 4]
  ]);

  const australWinterBird = {
    speciesCode: "auswin",
    comName: "Austral Winter Bird",
    months: monthsFromRates([0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0])
  };
  const result = seasonal.seasonalSpecialties(
    [australWinterBird],
    FULL_SAMPLING,
    { seasons: southernSeasons }
  );

  assert.equal(result.winter[0].speciesCode, "auswin");
  assert.equal(result.summer.length, 0);
});

test("year-round and too-rare birds are excluded", () => {
  const yearRound = {
    speciesCode: "houfin",
    comName: "House Finch",
    months: Array(12).fill(3)
  };
  const rarity = {
    speciesCode: "rarity",
    comName: "Vagrant Warbler",
    months: monthsFromRates([0, 0, 0, 0.33, 0, 0, 0, 0, 0, 0, 0, 0])
  };
  const result = seasonal.seasonalSpecialties([yearRound, rarity], FULL_SAMPLING);

  for (const season of seasonal.SEASONS) {
    assert.equal(result[season.key].length, 0);
  }
});

test("season lists rank by score and respect the limit", () => {
  const strong = {
    speciesCode: "strong",
    comName: "Strong Specialty",
    months: monthsFromRates([0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0])
  };
  const weaker = {
    speciesCode: "weaker",
    comName: "Weaker Specialty",
    months: monthsFromRates([0.33, 0.33, 0.67, 0.67, 0.67, 0.33, 0.33, 0, 0, 0, 0, 0.33])
  };
  const result = seasonal.seasonalSpecialties([weaker, strong], FULL_SAMPLING);

  assert.deepEqual(
    result.spring.map((item) => item.speciesCode),
    ["strong", "weaker"]
  );

  const limited = seasonal.seasonalSpecialties([weaker, strong], FULL_SAMPLING, { limit: 1 });
  assert.deepEqual(limited.spring.map((item) => item.speciesCode), ["strong"]);
});

test("month ranges join runs across the year boundary", () => {
  assert.equal(seasonal.formatMonthRanges([]), "");
  assert.equal(seasonal.formatMonthRanges([4]), "May");
  assert.equal(seasonal.formatMonthRanges([10, 11, 0, 1]), "Nov–Feb");
  assert.equal(seasonal.formatMonthRanges([3, 4, 8]), "Apr–May and Sep");
  assert.equal(seasonal.formatMonthRanges([0, 3, 4, 8]), "Jan, Apr–May and Sep");
  assert.equal(seasonal.formatMonthRanges([5, 10, 11, 0]), "Jun and Nov–Jan");
  assert.equal(seasonal.formatMonthRanges([...Array(12).keys()]), "Jan–Dec");
});

test("species timing: a year-round resident with a winter peak", () => {
  const entry = {
    speciesCode: "burowl",
    comName: "Burrowing Owl",
    months: monthsFromRates([1, 1, 0.67, 0.67, 0.67, 0.67, 0.67, 0.67, 0.67, 0.67, 1, 1])
  };
  const timing = seasonal.speciesTiming(entry, FULL_SAMPLING);
  assert.equal(timing.status, "yearRound");
  assert.deepEqual(timing.peakMonths, [0, 1, 10, 11]);
  assert.equal(timing.reportedDays, 28);
  assert.equal(timing.totalSampled, 36);
  assert.equal(
    seasonal.speciesTimingSentence(timing, "Burrowing Owl", "San Diego County"),
    "Burrowing Owl is reported year-round in San Diego County, most often Nov–Feb."
  );
});

test("species timing: a flat year-round bird gets no peak callout", () => {
  const timing = seasonal.speciesTiming({ months: Array(12).fill(3) }, FULL_SAMPLING);
  assert.equal(timing.status, "yearRound");
  assert.equal(
    seasonal.speciesTimingSentence(timing, "Common Raven", "Here"),
    "Common Raven is reported year-round in Here."
  );
});

test("species timing: a winter visitor reports its window and peak", () => {
  const entry = { months: monthsFromRates([1, 0.67, 0.33, 0, 0, 0, 0, 0, 0, 0.33, 0.67, 1]) };
  const timing = seasonal.speciesTiming(entry, FULL_SAMPLING);
  assert.equal(timing.status, "seasonal");
  assert.deepEqual(timing.windowMonths, [0, 1, 10, 11]);
  assert.deepEqual(timing.peakMonths, [0, 11]);
  assert.equal(
    seasonal.speciesTimingSentence(timing, "Ferruginous Hawk", "San Diego County"),
    "Ferruginous Hawk is reported in San Diego County mainly Nov–Feb, peaking Dec–Jan."
  );
});

test("species timing: a sharp window without a narrower peak says so once", () => {
  const entry = { months: monthsFromRates([0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]) };
  const timing = seasonal.speciesTiming(entry, FULL_SAMPLING);
  assert.equal(
    seasonal.speciesTimingSentence(timing, "Migrant", "X"),
    "Migrant is reported in X mainly Apr–May."
  );
});

test("species timing: thinly reported birds are sparse, not seasonal", () => {
  const entry = { months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1] };
  const timing = seasonal.speciesTiming(entry, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 6]);
  assert.equal(timing.status, "sparse");
  assert.equal(
    seasonal.speciesTimingSentence(timing, "Vagrant", "X"),
    "Vagrant is reported only occasionally in X: on 2 of 42 sampled dates, in Nov–Dec."
  );
});

test("species timing: a species missing from the region build is absent", () => {
  const timing = seasonal.speciesTiming(undefined, FULL_SAMPLING);
  assert.equal(timing.status, "absent");
  assert.equal(timing.presence.length, 12);
  assert.equal(
    seasonal.speciesTimingSentence(timing, "Snowy Owl", "San Diego County"),
    "Snowy Owl wasn't reported on enough sampled dates in San Diego County to show a pattern."
  );
});

test("recent sightings summary counts places and finds the latest report", () => {
  const summary = seasonal.recentSightingsSummary([
    { locId: "L1", locName: "Ramona Grasslands", obsDt: "2026-09-20 07:15" },
    { locId: "L2", locName: "Ramona Airport", obsDt: "2026-09-02" },
    { locId: "L1", locName: "Ramona Grasslands", obsDt: "2026-09-10 08:00" },
    { locId: "L3", locName: "Dos Picos", obsDt: "2026-09-25 17:30" },
    { locName: "No id, no date" },
    null
  ]);
  assert.equal(summary.locationCount, 3);
  assert.deepEqual(summary.latest, { locName: "Dos Picos", date: "2026-09-25 17:30" });
  assert.deepEqual(summary.topLocations.map((loc) => loc.locName), ["Ramona Grasslands", "Dos Picos", "Ramona Airport"]);
  assert.equal(summary.topLocations[0].reports, 2);

  const empty = seasonal.recentSightingsSummary(null);
  assert.equal(empty.locationCount, 0);
  assert.equal(empty.latest, null);
});
