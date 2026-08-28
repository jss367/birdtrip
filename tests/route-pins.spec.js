const { test, expect } = require("@playwright/test");
const { runRouteSearch, setSlider } = require("./helpers");

test("pinned stop outside the top results stays visible in its own section", async ({ page }) => {
  await runRouteSearch(page, { maxStops: 5 });
  // Pin Harbor Park (#3 at default), then slide left: the convMult-0 top 5 is
  // L8, L6, L1, L3, L2 — Harbor Park (L4) drops to #6 and must go out-of-rank.
  await page.locator('.stop-card:has-text("Harbor Park") .stop-pin').click();
  await setSlider(page, "#balanceSliderResults", 0);
  const ranked = page.locator(".results-list .stop-card:not(.is-out-of-rank)");
  await expect(ranked).toHaveCount(5);
  const outOfRank = page.locator(".stop-card.is-out-of-rank");
  await expect(outOfRank).toHaveCount(1);
  await expect(outOfRank.locator(".stop-name")).toHaveText("Harbor Park");
  await expect(page.locator(".out-of-rank-heading")).toContainText("Pinned — outside current top results");
  // The out-of-rank card stays fully interactive: Compare must resolve the
  // candidate through the pool, not the visible results.
  await outOfRank.locator(".compare-toggle").click();
  await expect(page.locator("#comparisonContent")).toContainText("Harbor Park");
});

test("multiple out-of-rank pins keep unique species-preview ids", async ({ page }) => {
  await runRouteSearch(page, { maxStops: 5 });
  // A one-species life list gives every stop a "not on your list" preview
  // chip without reshuffling ranks: all stops have >=10 unseen species, so
  // the personal bonus caps out equally everywhere.
  await page.setInputFiles("#lifeListInput", {
    name: "life-list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Common Name\nNonexistent Bird\n")
  });
  await expect(page.locator(".stop-card .chip-lifer").first()).toBeVisible();
  // Pin Harbor Park and Near Pond, then slide left: the convMult-0 top 5 is
  // L8, L6, L1, L3, L2, so both pins drop into the out-of-rank section.
  await page.locator('.stop-card:has-text("Harbor Park") .stop-pin').click();
  await page.locator('.stop-card:has-text("Near Pond") .stop-pin').click();
  await setSlider(page, "#balanceSliderResults", 0);
  const outOfRank = page.locator(".stop-card.is-out-of-rank");
  await expect(outOfRank).toHaveCount(2);
  // Each out-of-rank card must carry its own tooltip id so aria-describedby
  // never resolves to another stop's species list.
  await expect(outOfRank.locator('[id$="-lifer-preview"]')).toHaveCount(2);
  const ids = await page.locator('.results-list [id$="-preview"]').evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test("selected unpinned stop that drops out of rank keeps its map marker", async ({ page }) => {
  await runRouteSearch(page, { maxStops: 5 });
  await page.locator('.stop-card:has-text("Harbor Park") .stop-main').click();
  await expect(page.locator("#detailsPanel")).toContainText("Harbor Park");
  await expect(page.locator(".bird-marker")).toHaveCount(5);
  // Slide left: Harbor Park (L4) drops to #6. Its card leaves the list while
  // the detail panel stays open, so its marker must survive the rebuild —
  // labelled as unranked, not with a phantom rank number.
  await setSlider(page, "#balanceSliderResults", 0);
  await expect(page.locator('.stop-card:has-text("Harbor Park")')).toHaveCount(0);
  await expect(page.locator("#detailsPanel")).toContainText("Harbor Park");
  await expect(page.locator(".bird-marker")).toHaveCount(6);
  const selectedMarker = page.locator(".bird-marker.marker-selected");
  await expect(selectedMarker).toHaveCount(1);
  await expect(selectedMarker).toHaveText("•");
  // The open details panel overlays the map, so bypass hit-testing.
  await selectedMarker.dispatchEvent("click");
  await expect(page.locator(".leaflet-popup")).toContainText("Harbor Park");
});

test("shared URL keeps a pin that is out-of-rank at the shared balance", async ({ page }) => {
  await runRouteSearch(page, { maxStops: 5 });
  await page.locator('.stop-card:has-text("Harbor Park") .stop-pin').click();
  await setSlider(page, "#balanceSliderResults", 0);
  // The share URL now records balance=0 plus the pin; at that balance Harbor
  // Park sits outside the top 5, so the recipient's pin must resolve against
  // the candidate pool and land in the out-of-rank section, not vanish.
  const shared = await page.evaluate(() => window.buildShareUrl({ autoRun: true }));
  await page.goto(shared);
  const outOfRank = page.locator(".stop-card.is-out-of-rank");
  await expect(outOfRank).toHaveCount(1, { timeout: 15000 });
  await expect(outOfRank.locator(".stop-name")).toHaveText("Harbor Park");
  await expect(page.locator("#balanceSliderResults")).toHaveValue("0");
});
