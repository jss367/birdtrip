const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require("../public/seasonal.js");
require("../public/migration-timing.js");

const seasonal = globalThis.BirdtripSeasonal;
const timing = globalThis.BirdtripMigrationTiming;

const FULL_SAMPLING = Array(12).fill(3);
const SEASONS = seasonal.seasonsForLatitude(38);

function monthsFromRates(rates) {
  return rates.map((rate) => Math.round(rate * 3));
}

test("migration UI is honest about its data source", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/migration.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../public/migration-app.js"), "utf8");
  assert.match(html, /sampled-date occurrence/i);
  assert.match(`${html}\n${app}`, /not checklist frequency/i);
  assert.match(`${html}\n${app}`, /not live radar/i);
  assert.doesNotMatch(`${html}\n${app}`, /reporting rate/i);
});

test("groups are matched by family words in the common name", () => {
  assert.equal(timing.classifyGroup("Yellow-rumped Warbler"), "warblers");
  assert.equal(timing.classifyGroup("Common Yellowthroat"), "warblers");
  assert.equal(timing.classifyGroup("Ovenbird"), "warblers");
  assert.equal(timing.classifyGroup("Yellow-breasted Chat"), "warblers");
  assert.equal(timing.classifyGroup("American Redstart"), "warblers");
  assert.equal(timing.classifyGroup("Slate-throated Redstart"), "warblers");
  // "Chat" and "redstart" alone also name Old World flycatchers, which are
  // not wood-warblers and must stay out of the group.
  assert.equal(timing.classifyGroup("Sooty Chat"), null);
  assert.equal(timing.classifyGroup("Familiar Chat"), null);
  assert.equal(timing.classifyGroup("Common Redstart"), null);
  assert.equal(timing.classifyGroup("Black Redstart"), null);
  assert.equal(timing.classifyGroup("Blue-winged Teal"), "waterfowl");
  assert.equal(timing.classifyGroup("Black-bellied Whistling-Duck"), "waterfowl");
  assert.equal(timing.classifyGroup("Common Shelduck"), "waterfowl");
  assert.equal(timing.classifyGroup("Semipalmated Sandpiper"), "shorebirds");
  assert.equal(timing.classifyGroup("Red Knot"), "shorebirds");
  assert.equal(timing.classifyGroup("Northern Lapwing"), "shorebirds");
  assert.equal(timing.classifyGroup("Sharp-shinned Hawk"), "raptors");
  // Compound names lack a word boundary before "hawk"/"falcon", so the
  // pattern lists them explicitly.
  assert.equal(timing.classifyGroup("Eurasian Sparrowhawk"), "raptors");
  assert.equal(timing.classifyGroup("Northern Goshawk"), "raptors");
  assert.equal(timing.classifyGroup("Gyrfalcon"), "raptors");
  assert.equal(timing.classifyGroup("Ruby-throated Hummingbird"), "hummingbirds");
  // "Nighthawk" is one word, so the raptor pattern must not match inside it.
  assert.equal(timing.classifyGroup("Common Nighthawk"), null);
  assert.equal(timing.classifyGroup("American Robin"), null);
});

test("status classification covers the main occurrence shapes", () => {
  const passage = [0, 0, 0, 0.4, 0.9, 0, 0, 0, 0.6, 0.4, 0, 0];
  assert.equal(timing.classifyStatus(passage, SEASONS), "passage");

  // A migrant reported in only one spring month is still passage.
  const oneMonth = [0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0];
  assert.equal(timing.classifyStatus(oneMonth, SEASONS), "passage");

  const summerBreeder = [0, 0, 0.2, 0.8, 1, 1, 1, 0.8, 0.6, 0.2, 0, 0];
  assert.equal(timing.classifyStatus(summerBreeder, SEASONS), "summer");

  const winterVisitor = [1, 1, 1, 0.8, 0.2, 0, 0, 0, 0, 0.6, 1, 1];
  assert.equal(timing.classifyStatus(winterVisitor, SEASONS), "winter");

  const resident = [0.9, 1, 0.9, 1, 1, 0.9, 1, 1, 0.9, 1, 1, 0.9];
  assert.equal(timing.classifyStatus(resident, SEASONS), "resident");

  const scarce = [0, 0.1, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0];
  assert.equal(timing.classifyStatus(scarce, SEASONS), "scarce");

  // Real sampling is ~3 dates per month, so rates are never below 1/3;
  // scarcity there is judged on how few sampled days the bird was seen.
  const twoDays = [0, 0, 0, 1 / 3, 0, 0, 0, 0, 1 / 3, 0, 0, 0];
  assert.equal(timing.classifyStatus(twoDays, SEASONS, 2), "scarce");
  assert.equal(timing.classifyStatus(twoDays, SEASONS, 4), "passage");

  // A bird seen only in one summer month has no spring or fall evidence,
  // so it must not be labeled as passing through.
  const julyOnly = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  assert.equal(timing.classifyStatus(julyOnly, SEASONS, 3), "irregular");
});

test("movement for seasonal residents peaks at arrival and departure", () => {
  const presence = [0, 0, 0.2, 0.8, 1, 1, 1, 0.8, 0.6, 0.2, 0, 0];
  const norm = timing.normalizedPresence(presence);
  const movement = timing.movementByMonth(norm, "summer");
  const springPeak = movement.indexOf(Math.max(...movement.slice(0, 6)));
  const fallPeak = 6 + movement.slice(6).indexOf(Math.max(...movement.slice(6)));
  assert.equal(springPeak, 3); // April arrival
  assert.equal(fallPeak, 8); // September departure
  assert.equal(movement[5], 0); // settled in June, no movement
});

test("movement for passage migrants is simply their presence", () => {
  const norm = [0, 0, 0, 0.5, 1, 0, 0, 0, 0.7, 0.4, 0, 0];
  assert.deepEqual(timing.movementByMonth(norm, "passage"), norm);
  assert.deepEqual(timing.movementByMonth(norm, "resident"), Array(12).fill(0));
  // Irregular visitors carry no migration evidence, so their presence must
  // not be counted as movement.
  assert.deepEqual(timing.movementByMonth(norm, "irregular"), Array(12).fill(0));
});

test("presence runs group contiguous months and survive a December wrap", () => {
  const bimodal = [0, 0, 0, 0.6, 1, 0, 0, 0, 0.8, 0.6, 0, 0];
  const runs = timing.presenceRuns(timing.normalizedPresence(bimodal));
  assert.deepEqual(runs, [[3, 4], [8, 9]]);
  assert.equal(timing.runsLabel(runs), "Apr–May and Sep–Oct");

  const winter = [1, 1, 0.6, 0, 0, 0, 0, 0, 0, 0.6, 1, 1];
  const winterRuns = timing.presenceRuns(timing.normalizedPresence(winter));
  assert.equal(winterRuns.length, 1);
  assert.deepEqual(winterRuns[0], [9, 10, 11, 0, 1, 2]);
  assert.equal(timing.runLabel(winterRuns[0]), "Oct–Mar");
});

test("buildMigrationTiming filters by group and excludes residents from movement", () => {
  const species = [
    {
      speciesCode: "magwar",
      comName: "Magnolia Warbler",
      sciName: "Setophaga magnolia",
      months: monthsFromRates([0, 0, 0, 0.4, 0.9, 0, 0, 0, 0.6, 0.4, 0, 0])
    },
    {
      speciesCode: "norpar",
      comName: "Northern Parula",
      sciName: "Setophaga americana",
      months: monthsFromRates([0, 0, 0.2, 0.8, 1, 1, 1, 0.8, 0.6, 0.2, 0, 0])
    },
    {
      speciesCode: "amerob",
      comName: "American Robin",
      sciName: "Turdus migratorius",
      months: monthsFromRates([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    },
    {
      speciesCode: "cerwar",
      comName: "Cerulean Warbler",
      sciName: "Setophaga cerulea",
      // Seen on only two sampled days all year: too scarce to judge.
      months: [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0]
    },
    {
      speciesCode: "prowar",
      comName: "Prothonotary Warbler",
      sciName: "Protonotaria citrea",
      // Seen on all three sampled July dates and never again: irregular,
      // and with no migration evidence it must not inflate July movement.
      months: [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0]
    }
  ];

  const warblers = timing.buildMigrationTiming(species, FULL_SAMPLING, { latitude: 38, group: "warblers" });
  assert.equal(warblers.groupTotal, 4);
  assert.equal(warblers.migrantCount, 2); // irregular prothonotary is not a migrant
  assert.equal(warblers.buckets.passage.length, 1);
  assert.equal(warblers.buckets.passage[0].speciesCode, "magwar");
  assert.equal(warblers.buckets.summer.length, 1);
  assert.equal(warblers.buckets.irregular.length, 1); // still shown in its own bucket
  assert.equal(warblers.buckets.irregular[0].speciesCode, "prowar");
  assert.equal(warblers.scarceCount, 1); // cerulean's two reports are not enough
  assert.equal(warblers.residentCount, 0); // robin is not a warbler

  const all = timing.buildMigrationTiming(species, FULL_SAMPLING, { latitude: 38, group: "all" });
  assert.equal(all.groupTotal, 5);
  assert.equal(all.migrantCount, 2);
  assert.equal(all.scarceCount, 1);
  assert.equal(all.residentCount, 1); // robin counted but contributes no movement

  const mayIndex = 4;
  assert.ok(all.monthly[mayIndex] > 0);
  // The July-only irregular warbler adds no movement anywhere: the aggregate
  // chart is identical with or without it.
  const withoutIrregular = timing.buildMigrationTiming(
    species.filter((s) => s.speciesCode !== "prowar"),
    FULL_SAMPLING,
    { latitude: 38, group: "all" }
  );
  assert.deepEqual(all.monthly, withoutIrregular.monthly);
  assert.deepEqual(all.movingCount, withoutIrregular.movingCount);
  assert.equal(all.migrantCount, withoutIrregular.migrantCount);
  assert.ok(all.peaks.spring && all.peaks.spring.months.includes(mayIndex));
  assert.ok(all.peaks.fall && all.peaks.fall.peak >= 8);

  // An invalid group falls back to "all" rather than throwing.
  const fallback = timing.buildMigrationTiming(species, FULL_SAMPLING, { latitude: 38, group: "nope" });
  assert.equal(fallback.groupKey, "all");
});
