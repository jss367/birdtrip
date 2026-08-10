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
