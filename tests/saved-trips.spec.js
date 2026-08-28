const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");
const { runAreaSearch, visibleOrder, setSlider } = require("./helpers");

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
