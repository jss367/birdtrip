const { test, expect } = require("@playwright/test");

const RAMONA = { name: "Ramona, San Diego County, California, United States", lat: 33.042, lng: -116.868 };
const BURROWING_OWL = { speciesCode: "burowl", comName: "Burrowing Owl", sciName: "Athene cunicularia" };

// Three winter birds and a spring/summer oriole, plus a year-round owl that
// never makes a seasonal card.
const SEASONALITY = {
  regionCode: "US-CA-073",
  regionName: "San Diego County",
  year: 2025,
  requestedSampleDaysPerMonth: 3,
  sampledDays: Array(12).fill(3),
  species: [
    { ...BURROWING_OWL, months: [3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3] },
    { speciesCode: "yerwar", comName: "Yellow-rumped Warbler", sciName: "Setophaga coronata", months: [3, 3, 3, 1, 0, 0, 0, 0, 0, 2, 3, 3] },
    { speciesCode: "rcki", comName: "Ruby-crowned Kinglet", sciName: "Corthylio calendula", months: [3, 2, 3, 1, 0, 0, 0, 0, 0, 1, 3, 3] },
    { speciesCode: "whcspa", comName: "White-crowned Sparrow", sciName: "Zonotrichia leucophrys", months: [3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 2, 2] },
    { speciesCode: "hooori", comName: "Hooded Oriole", sciName: "Icterus cucullatus", months: [0, 0, 1, 3, 3, 3, 3, 3, 1, 0, 0, 0] }
  ]
};

// The planner's cached preferences: normalized aliases (common, scientific,
// or code) plus display names. Seen: the warbler, kinglet, and owl.
const PLANNER_PREFS = {
  lifeList: {
    source: "ebird",
    fileName: "life-list.csv",
    importedAt: "2026-09-01T00:00:00.000Z",
    species: ["yellow-rumped warbler", "setophaga coronata", "corthylio calendula", "burowl"],
    displayNames: ["Burrowing Owl", "Ruby-crowned Kinglet", "Yellow-rumped Warbler"]
  }
};

async function stubSeasonalApis(page) {
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: { error: "Unstubbed" } }));
  await page.route("**/api/config", (route) => route.fulfill({ json: { ebirdConfigured: true } }));
  await page.route("**/api/geocode**", (route) => route.fulfill({ json: [RAMONA] }));
  await page.route("**/api/ebird/seasonality**", (route) => route.fulfill({ json: SEASONALITY }));
  await page.route("**/api/ebird/species?**", (route) => route.fulfill({
    json: { speciesCode: "burowl", species: BURROWING_OWL, observations: [] }
  }));
}

async function seedLifeList(page) {
  await page.addInitScript((prefs) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("routeBirdingPrefs", JSON.stringify(prefs));
      sessionStorage.setItem("seeded", "1");
    }
  }, PLANNER_PREFS);
}

function seasonCard(page, label) {
  return page.locator(".seasonal-season", { has: page.locator("h3", { hasText: label }) });
}

test("the planner's life list marks unseen seasonal birds and can filter to them", async ({ page }) => {
  await stubSeasonalApis(page);
  await seedLifeList(page);
  await page.goto("/seasonal.html?q=Ramona");

  const winter = seasonCard(page, "Winter");
  await expect(winter.locator(".seasonal-species")).toHaveCount(3);
  // Matched by common name and by scientific name, so only the sparrow is unseen.
  await expect(winter.locator(".chip-lifer")).toHaveCount(1);
  await expect(winter.locator(".seasonal-species", { hasText: "White-crowned Sparrow" }).locator(".chip-lifer"))
    .toHaveText("Not on your life list");
  // The oriole peaks in spring and summer but counts once.
  await expect(page.locator(".seasonal-life-list-note")).toHaveText("2 of these 4 seasonal birds aren't on your life list.");

  const toggle = page.locator("#unseenOnlyToggle");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(winter.locator(".seasonal-species")).toHaveCount(1);
  await expect(winter.locator("h4")).toHaveText("White-crowned Sparrow");
  await expect(page.locator(".chip-lifer")).toHaveCount(0);
  await expect(seasonCard(page, "Fall").locator(".seasonal-none")).toHaveText("You've seen every strong fall specialty here.");
  await expect(page.locator(".seasonal-overview h3")).toContainText("look for White-crowned Sparrow");
  // The life list is personal, so the filter never rides along in a share link.
  expect(new URL(page.url()).search).toBe("?q=Ramona");

  await page.reload();
  await expect(page.locator("#unseenOnly")).toBeChecked();
  await expect(winter.locator(".seasonal-species")).toHaveCount(1);
});

test("without a life list the page points to the planner import", async ({ page }) => {
  await stubSeasonalApis(page);
  await page.goto("/seasonal.html?q=Ramona");
  await expect(seasonCard(page, "Winter").locator(".seasonal-species")).toHaveCount(3);
  await expect(page.locator("#unseenOnlyToggle")).toBeHidden();
  await expect(page.locator(".chip-lifer")).toHaveCount(0);
  await expect(page.locator(".seasonal-life-list-note")).toContainText("Import your life list in the Trip Planner");
  await expect(page.locator(".seasonal-life-list-note a")).toHaveAttribute("href", "./");
});

test("a species lookup says whether it's on the life list", async ({ page }) => {
  await stubSeasonalApis(page);
  await seedLifeList(page);
  await page.goto("/seasonal.html?q=Ramona&species=Burrowing+Owl");
  await expect(page.locator(".seasonal-species-answer .chip-seen")).toHaveText("On your life list");
});

test("importing a life list in another tab updates the open page", async ({ page, context }) => {
  await stubSeasonalApis(page);
  await page.goto("/seasonal.html?q=Ramona");
  await expect(seasonCard(page, "Winter").locator(".seasonal-species")).toHaveCount(3);
  await expect(page.locator("#unseenOnlyToggle")).toBeHidden();

  const planner = await context.newPage();
  await planner.route("**/*", (route) => route.fulfill({ body: "" }));
  await planner.goto(new URL("/blank", page.url()).toString());
  await planner.evaluate((prefs) => localStorage.setItem("routeBirdingPrefs", JSON.stringify(prefs)), PLANNER_PREFS);

  await expect(page.locator("#unseenOnlyToggle")).toBeVisible();
  await expect(seasonCard(page, "Winter").locator(".chip-lifer")).toHaveCount(1);
});
