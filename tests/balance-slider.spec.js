const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");
const { runAreaSearch, visibleOrder, setSlider } = require("./helpers");

test("prioritize-birding admits Far Rich Reserve at #1", async ({ page }) => {
  await runAreaSearch(page);
  await setSlider(page, "#balanceSliderResults", 0);
  const names = await visibleOrder(page);
  expect(names[0]).toBe("Far Rich Reserve");
  expect(names).toContain("Wetland Reserve North");
});

test("less-driving keeps only nearby stops", async ({ page }) => {
  await runAreaSearch(page);
  await setSlider(page, "#balanceSliderResults", 4);
  // Utilities at convMult 5: L1 135.68, L4 133.20, L3 132.00, L2 128.32, L5 107.20.
  expect(await visibleOrder(page)).toEqual([
    "City Park Alpha", "Harbor Park", "City Park Gamma", "City Park Beta", "Near Pond"
  ]);
});

test("both controls stay synchronized", async ({ page }) => {
  await runAreaSearch(page);
  await setSlider(page, "#balanceSlider", 0);
  await expect(page.locator("#balanceSliderResults")).toHaveValue("0");
  await setSlider(page, "#balanceSliderResults", 3);
  await expect(page.locator("#balanceSlider")).toHaveValue("3");
});

test("share URL includes non-default balance and omits the default", async ({ page }) => {
  await runAreaSearch(page);
  await setSlider(page, "#balanceSliderResults", 0);
  // buildShareUrl is a top-level classic-script function, so it's on window.
  const shared = await page.evaluate(() => window.buildShareUrl());
  expect(shared).toContain("balance=0");
  await setSlider(page, "#balanceSliderResults", 2);
  const sharedDefault = await page.evaluate(() => window.buildShareUrl());
  expect(sharedDefault).not.toContain("balance=");
});

test("moving right reduces the average distance of top results", async ({ page }) => {
  await runAreaSearch(page);
  const averageDistance = async () => {
    const texts = await page.locator(".stop-card .metric-detour").allTextContents();
    const values = texts.map((t) => parseFloat(t));
    return values.reduce((a, b) => a + b, 0) / values.length;
  };
  await setSlider(page, "#balanceSliderResults", 0);
  const left = await averageDistance();
  await setSlider(page, "#balanceSliderResults", 4);
  const right = await averageDistance();
  expect(right).toBeLessThan(left);
});

test("hotspot classification is stable across slider positions", async ({ page }) => {
  await runAreaSearch(page);
  // Near Pond (20 species, siteQuality 14) must never classify as a top
  // hotspot, no matter how much the balance favors convenience.
  for (const position of [0, 2, 4]) {
    await setSlider(page, "#balanceSliderResults", position);
    const nearPond = page.locator('.stop-card:has-text("Near Pond")');
    if (await nearPond.count()) {
      await expect(nearPond.locator(".chip-hotspot")).toHaveCount(0);
    }
  }
});

test("life-list ranking matches the lifer-weighted baseline", async ({ page }) => {
  await runAreaSearch(page);
  // All 78 "City Park Alpha Species N" marked seen: L1 gains 0 lifer points
  // while every other candidate has >=8 unseen species -> capped +18 each.
  // Default-balance utilities: L3 78.00, L4 76.00, L2 75.92, L6 74.04,
  // L8 73.50, then L1 62.08 (#6 - the fully-birded park drops out).
  const rows = Array.from({ length: 78 }, (_, i) => `City Park Alpha Species ${i + 1}`).join("\n");
  await page.setInputFiles("#lifeListInput", {
    name: "life-list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`Common Name\n${rows}`)
  });
  await expect(page.locator(".stop-card")).toHaveCount(5);
  expect(await visibleOrder(page)).toEqual([
    "City Park Gamma", "Harbor Park", "City Park Beta", "Wetland Reserve North", "Far Rich Reserve"
  ]);
});

test("shared URL restores the balance position", async ({ page }) => {
  await stubApis(page);
  await page.goto("/?bt=1&mode=area&origin=Test+Center%2C+Barcelona&maxStops=5&balance=0&run=1");
  await page.click("#settingsButton");
  await page.fill("#apiToken", "TEST_TOKEN");
  await page.keyboard.press("Escape");
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card .stop-name").first()).toHaveText("Far Rich Reserve", { timeout: 15000 });
  await expect(page.locator("#balanceSlider")).toHaveValue("0");
});
