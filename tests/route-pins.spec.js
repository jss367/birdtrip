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
