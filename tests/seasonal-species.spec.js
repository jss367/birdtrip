const { test, expect } = require("@playwright/test");

const RAMONA = { name: "Ramona, San Diego County, California, United States", lat: 33.042, lng: -116.868 };
const BURROWING_OWL = { speciesCode: "burowl", comName: "Burrowing Owl", sciName: "Athene cunicularia" };

// Three sampled dates a month; the owl is year-round with a Nov–Feb peak, and
// the warbler gives the seasonal cards something to show.
const SEASONALITY = {
  regionCode: "US-CA-073",
  regionName: "San Diego County",
  year: 2025,
  requestedSampleDaysPerMonth: 3,
  sampledDays: Array(12).fill(3),
  species: [
    { ...BURROWING_OWL, months: [3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3] },
    { speciesCode: "yerwar", comName: "Yellow-rumped Warbler", sciName: "Setophaga coronata", months: [3, 3, 3, 1, 0, 0, 0, 0, 0, 2, 3, 3] }
  ]
};

const RECENT = [
  { locId: "L100", locName: "Ramona Grasslands Preserve", obsDt: "2026-09-20 07:15" },
  { locId: "L101", locName: "Ramona Airport", obsDt: "2026-09-12 17:40" }
];

async function stubSeasonalApis(page, { speciesRequests = [] } = {}) {
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: { error: "Unstubbed" } }));
  await page.route("**/api/config", (route) => route.fulfill({ json: { ebirdConfigured: true } }));
  await page.route("**/api/geocode**", (route) => route.fulfill({ json: [RAMONA] }));
  await page.route("**/api/ebird/seasonality**", (route) => route.fulfill({ json: SEASONALITY }));
  await page.route("**/api/ebird/taxonomy/search**", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") || "";
    route.fulfill({ json: "burrowing owl".startsWith(q.toLowerCase()) ? [BURROWING_OWL] : [] });
  });
  await page.route("**/api/ebird/species?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    speciesRequests.push(Object.fromEntries(params));
    const name = (params.get("name") || "").toLowerCase();
    if (params.get("speciesCode") === "burowl" || name === "burrowing owl") {
      return route.fulfill({ json: { speciesCode: "burowl", species: BURROWING_OWL, observations: RECENT } });
    }
    return route.fulfill({
      status: 404,
      json: { error: `No eBird species matched "${name}"`, suggestions: [BURROWING_OWL] }
    });
  });
}

test("picking a species answers when it's reported and shows recent nearby reports", async ({ page }) => {
  const speciesRequests = [];
  await stubSeasonalApis(page, { speciesRequests });
  await page.goto("/seasonal.html");

  await page.fill("#seasonalLocation", "Ramona");
  await page.fill("#seasonalSpecies", "burrow");
  await page.locator("#seasonalSpeciesSuggestions li", { hasText: "Burrowing Owl" }).click();
  await expect(page.locator("#seasonalSpecies")).toHaveValue("Burrowing Owl");
  await page.click("#seasonalSubmit");

  const card = page.locator(".seasonal-species-answer");
  await expect(card.locator(".seasonal-species-lead")).toHaveText(
    "Burrowing Owl is reported year-round in San Diego County, most often Nov–Feb."
  );
  await expect(card.locator(".seasonal-month-cell.is-peak")).toHaveCount(4);
  await expect(card.locator(".seasonal-recent")).toContainText("Reported at 2 locations within 25 km of Ramona in the last 30 days.");
  await expect(card.locator(".seasonal-recent")).toContainText("Most recently at Ramona Grasslands Preserve on Sep 20. Also at Ramona Airport.");
  // The seasonal specialties still render beneath the answer.
  await expect(page.locator(".seasonal-season")).toHaveCount(4);

  // A picked suggestion is looked up by code, not by name.
  expect(speciesRequests[0]).toMatchObject({ speciesCode: "burowl", dist: "25", back: "30" });

  const url = new URL(page.url());
  expect(url.searchParams.get("q")).toBe("Ramona");
  expect(url.searchParams.get("species")).toBe("Burrowing Owl");
});

test("a shared species link reloads straight into the answer", async ({ page }) => {
  await stubSeasonalApis(page);
  await page.goto("/seasonal.html?q=Ramona&species=Burrowing+Owl");
  await expect(page.locator("#seasonalSpecies")).toHaveValue("Burrowing Owl");
  await expect(page.locator(".seasonal-species-lead")).toContainText("reported year-round in San Diego County");
});

test("a shared link without a species doesn't reuse the remembered one", async ({ page }) => {
  await stubSeasonalApis(page);
  await page.addInitScript(() => {
    localStorage.setItem("birdtripSeasonalView", JSON.stringify({ q: "Ramona", species: "Burrowing Owl" }));
  });
  await page.goto("/seasonal.html?q=Ramona");
  await expect(page.locator(".seasonal-season")).toHaveCount(4);
  await expect(page.locator("#seasonalSpecies")).toHaveValue("");
  await expect(page.locator(".seasonal-species-answer")).toHaveCount(0);
});

test("an unknown species name fails with suggestions", async ({ page }) => {
  await stubSeasonalApis(page);
  await page.goto("/seasonal.html");
  await page.fill("#seasonalLocation", "Ramona");
  await page.fill("#seasonalSpecies", "Burrowing Owel");
  await page.click("#seasonalSubmit");
  await expect(page.locator(".empty-state")).toContainText('No eBird species matched "Burrowing Owel". Try Burrowing Owl.');
  expect(new URL(page.url()).search).toBe("");
});

test("a species the region build dropped says so instead of charting nothing", async ({ page }) => {
  await stubSeasonalApis(page);
  await page.route("**/api/ebird/seasonality**", (route) => route.fulfill({
    json: { ...SEASONALITY, species: SEASONALITY.species.filter((s) => s.speciesCode !== "burowl") }
  }));
  await page.goto("/seasonal.html?q=Ramona&species=Burrowing+Owl");
  const card = page.locator(".seasonal-species-answer");
  await expect(card.locator(".seasonal-species-lead")).toHaveText(
    "Burrowing Owl wasn't reported on enough sampled dates in San Diego County to show a pattern."
  );
  await expect(card.locator(".seasonal-months")).toHaveCount(0);
  await expect(card.locator(".seasonal-recent")).toContainText("Reported at 2 locations");
});
