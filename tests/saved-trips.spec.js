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
