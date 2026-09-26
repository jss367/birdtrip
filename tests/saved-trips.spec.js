const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");
const { runAreaSearch, runRouteSearch, visibleOrder, setSlider } = require("./helpers");

// Option labels carry a date suffix ("Name - Sep 26"), so select by name.
async function selectSavedTrip(page, name) {
  const value = await page.locator("#savedTripSelect option", { hasText: name }).getAttribute("value");
  await page.locator("#savedTripSelect").selectOption(value);
}

test("restored trips keep stored scores and an inert slider", async ({ page }) => {
  await runAreaSearch(page);
  await setSlider(page, "#balanceSliderResults", 0);
  const orderBefore = await visibleOrder(page);
  await page.fill("#tripName", "Fixture Trip");
  await page.click("#saveTripButton");
  await page.reload();
  await stubApis(page);
  // renderSavedTrips auto-selects the only saved trip after reload.
  await page.click("#loadTripButton");
  await expect(page.locator(".stop-card")).toHaveCount(orderBefore.length);
  expect(await visibleOrder(page)).toEqual(orderBefore);
  await expect(page.locator("#balanceSliderResults")).toHaveValue("0");
  await expect(page.locator("#balanceSliderResults")).toBeDisabled();
  await expect(page.locator("#balanceHintResults")).toContainText("Saved trips keep their original ranking");

  // A life-list import must not re-rank a restored trip: it has no candidate
  // pool, so re-scoring the truncated visible results would reorder it.
  const rows = Array.from({ length: 78 }, (_, i) => `City Park Alpha Species ${i + 1}`).join("\n");
  await page.setInputFiles("#lifeListInput", {
    name: "life-list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`Common Name\n${rows}`)
  });
  expect(await visibleOrder(page)).toEqual(orderBefore);
  await expect(page.locator("#balanceSliderResults")).toBeDisabled();

  // The locked ranking holds, but lifer metadata must track the imported
  // list: City Park Alpha is fully seen while every other stop's recent
  // species are all unseen.
  await expect(page.locator('.stop-card:has-text("City Park Gamma") .chip-lifer')).toHaveText("75 not on your list");
  await expect(page.locator('.stop-card:has-text("City Park Alpha") .chip-lifer')).toHaveCount(0);
  // Clearing the list must drop the metadata again without reordering.
  await page.click("#settingsButton");
  await page.click("#clearLifeListButton");
  await page.keyboard.press("Escape");
  await expect(page.locator(".stop-card .chip-lifer")).toHaveCount(0);
  expect(await visibleOrder(page)).toEqual(orderBefore);
});

test("a selected out-of-rank stop survives save and restore", async ({ page }) => {
  await runRouteSearch(page, { maxStops: 5 });
  await page.locator('.stop-card:has-text("Harbor Park") .stop-main').click();
  await expect(page.locator("#detailsPanel")).toContainText("Harbor Park");
  // Slide left: Harbor Park (L4) drops out of the top 5 while selected, so it
  // is kept only in the candidate pool (no card, unranked marker).
  await setSlider(page, "#balanceSliderResults", 0);
  await expect(page.locator('.stop-card:has-text("Harbor Park")')).toHaveCount(0);
  await page.fill("#tripName", "Out Of Rank Trip");
  await page.click("#saveTripButton");
  await page.reload();
  await stubApis(page);
  await page.click("#loadTripButton");
  await expect(page.locator(".stop-card")).toHaveCount(5);
  await expect(page.locator('.stop-card:has-text("Harbor Park")')).toHaveCount(0);
  // The restored selection must reopen its detail panel and keep the same
  // out-of-rank treatment the live UI gives it: a sixth, unranked marker.
  await expect(page.locator("#detailsPanel")).toContainText("Harbor Park");
  await expect(page.locator(".bird-marker")).toHaveCount(6);
  const selectedMarker = page.locator(".bird-marker.marker-selected");
  await expect(selectedMarker).toHaveCount(1);
  await expect(selectedMarker).toHaveText("•");
});

test("legacy-scored restored stops keep their legacy scale in the comparison table", async ({ page }) => {
  await runAreaSearch(page);
  await page.fill("#tripName", "Legacy Trip");
  await page.click("#saveTripButton");
  // Rewrite the saved trip as a legacy (pre-versioning) save: hydration then
  // assigns scoringVersion 1, whose scale is the 115-point legacy maximum
  // (133 with lifers), not 100.
  await page.evaluate(() => {
    const payload = JSON.parse(localStorage.getItem("birdtripSavedTrips"));
    for (const trip of payload.trips) {
      for (const stop of trip.state.results) {
        delete stop.scoringVersion;
        delete stop.scoredWithLifeList;
        delete stop.birdMax;
      }
    }
    localStorage.setItem("birdtripSavedTrips", JSON.stringify(payload));
  });
  await page.reload();
  await stubApis(page);
  await page.click("#loadTripButton");
  await expect(page.locator(".stop-card")).toHaveCount(5);
  await page.locator(".stop-card").first().locator(".compare-toggle").click();
  const comparison = page.locator("#comparisonContent");
  await expect(comparison).toContainText("of 115");
  await expect(comparison).toContainText("legacy scoring model");
  await expect(comparison).not.toContainText("of 100");
});

test("a new search renames an untouched trip name so Save can't overwrite the previous trip", async ({ page }) => {
  await runRouteSearch(page);
  await expect(page.locator("#tripName")).toHaveValue(/ to /);
  await page.click("#saveTripButton");

  await page.click('[data-mode="area"]');
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(5, { timeout: 15000 });
  await expect(page.locator("#tripName")).not.toHaveValue(/ to /);
  await page.click("#saveTripButton");
  await expect(page.locator("#savedTripSelect option")).toHaveCount(2);

  // A name the user typed for this search is theirs to keep.
  await page.fill("#tripName", "Weekend Loop");
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(5, { timeout: 15000 });
  await expect(page.locator("#tripName")).toHaveValue("Weekend Loop");
});

test("loading a saved trip points the address bar at that trip", async ({ page }) => {
  await runAreaSearch(page);
  await page.click("#saveTripButton");

  await page.click('[data-mode="route"]');
  await page.fill("#destination", "Test East, Barcelona");
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(5, { timeout: 15000 });
  expect(new URL(page.url()).searchParams.get("mode")).toBe("route");

  await page.click("#loadTripButton");
  await expect(page.locator("#savedTripsStatus")).toContainText("Loaded");
  const params = new URL(page.url()).searchParams;
  expect(params.get("mode")).toBe("area");
  expect(params.has("destination")).toBe(false);
  expect(params.get("run")).toBe("1");
});

test("a typed trip name survives species-name resolution", async ({ page }) => {
  await stubApis(page);
  await page.route((url) => url.pathname === "/api/ebird/species", (route) => route.fulfill({
    json: { species: { comName: "American Robin", sciName: "Turdus migratorius", speciesCode: "amerob" }, observations: [] }
  }));
  await page.goto("/");
  await page.click("#settingsButton");
  await page.fill("#apiToken", "TEST_TOKEN");
  await page.keyboard.press("Escape");
  await page.click('[data-mode="species"]');
  await page.fill("#origin", "Test Center, Barcelona");
  await page.fill("#speciesQuery", "Turdus migratorius");
  await page.fill("#tripName", "Weekend Loop");
  await page.click('button[type="submit"]');
  await expect(page.locator("#speciesQuery")).toHaveValue("American Robin");
  await expect(page.locator("#tripName")).toHaveValue("Weekend Loop");

  // An auto-filled name still follows the resolved species.
  await page.fill("#tripName", "");
  await page.fill("#speciesQuery", "Turdus migratorius");
  await page.click('button[type="submit"]');
  await expect(page.locator("#speciesQuery")).toHaveValue("American Robin");
  await expect(page.locator("#tripName")).toHaveValue(/^American Robin near /);
});

test("selecting another saved trip doesn't let a re-search overwrite it", async ({ page }) => {
  await runAreaSearch(page);
  await page.fill("#tripName", "Area Trip");
  await page.click("#saveTripButton");

  await page.click('[data-mode="route"]');
  await page.fill("#destination", "Test East, Barcelona");
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(5, { timeout: 15000 });
  await page.fill("#tripName", "Route Trip");
  await page.click("#saveTripButton");

  // Load the route trip, then merely select the area trip: its name fills the
  // field, but re-running the route must not keep it.
  await selectSavedTrip(page, "Route Trip");
  await page.click("#loadTripButton");
  await expect(page.locator("#savedTripsStatus")).toContainText("Loaded Route Trip");
  await selectSavedTrip(page, "Area Trip");
  await expect(page.locator("#tripName")).toHaveValue("Area Trip");
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(5, { timeout: 15000 });
  await expect(page.locator("#tripName")).toHaveValue(/ to /);
  await page.click("#saveTripButton");
  await expect(page.locator("#savedTripSelect option")).toHaveCount(3);
  const areaTrip = await page.evaluate(() => JSON.parse(localStorage.getItem("birdtripSavedTrips"))
    .trips.find((trip) => trip.name === "Area Trip"));
  expect(areaTrip.state.params.mode).toBe("area");
});

test("loading a saved trip from a bare / writes its share URL; a settings-only trip clears it", async ({ page }) => {
  await stubApis(page);
  await page.goto("/");
  await page.fill("#tripName", "Settings Only");
  await page.click("#saveTripButton");

  await runAreaSearch(page);
  await page.fill("#tripName", "Area Trip");
  await page.click("#saveTripButton");

  await page.goto("/");
  await selectSavedTrip(page, "Area Trip");
  await page.click("#loadTripButton");
  await expect(page.locator("#savedTripsStatus")).toContainText("Loaded Area Trip");
  const params = new URL(page.url()).searchParams;
  expect(params.get("mode")).toBe("area");
  expect(params.get("run")).toBe("1");

  await selectSavedTrip(page, "Settings Only");
  await page.click("#loadTripButton");
  await expect(page.locator("#savedTripsStatus")).toContainText("Loaded Settings Only");
  expect(new URL(page.url()).search).toBe("");
});
