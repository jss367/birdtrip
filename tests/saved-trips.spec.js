const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");
const { runAreaSearch, runRouteSearch, visibleOrder, setSlider } = require("./helpers");

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
