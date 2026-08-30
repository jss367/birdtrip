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
  // Utilities at convMult 5: L4 218.45, L1 217.32, L3 212.25, L2 207.17, L5 203.65.
  expect(await visibleOrder(page)).toEqual([
    "Harbor Park", "City Park Alpha", "City Park Gamma", "City Park Beta", "Near Pond"
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
  const stored = await page.evaluate(() => window.buildShareTripData());
  expect(shared).toContain("balance=0");
  expect(stored.balance).toBe(0);
  await setSlider(page, "#balanceSliderResults", 2);
  const sharedDefault = await page.evaluate(() => window.buildShareUrl());
  const storedDefault = await page.evaluate(() => window.buildShareTripData());
  expect(sharedDefault).not.toContain("balance=");
  expect(storedDefault).not.toHaveProperty("balance");
});

test("slider URL update keeps the submitted search after unsubmitted edits", async ({ page }) => {
  await runAreaSearch(page);
  // A completed search stamps the URL with the submitted inputs plus run=1.
  expect(page.url()).toContain("origin=Test+Center%2C+Barcelona");
  expect(page.url()).toContain("run=1");
  // Edit the origin WITHOUT re-submitting, then move the slider: the URL must
  // patch only the balance param, not rebuild from the live form fields —
  // otherwise the share/reload URL would auto-run a search the displayed
  // results don't reflect.
  await page.fill("#origin", "Edited Elsewhere");
  await setSlider(page, "#balanceSliderResults", 0);
  const url = page.url();
  expect(url).toContain("balance=0");
  expect(url).toContain("origin=Test+Center%2C+Barcelona");
  expect(url).toContain("run=1");
  expect(url).not.toContain("Edited");
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
  // Near Pond (20 species, siteQuality ~26) must never classify as a top
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
  // All 78 "City Park Alpha Species N" marked seen: L1 earns 0 personal points
  // while every other candidate has >=8 unseen species -> capped +15 each.
  // Default-balance utilities: L3 83.25, L4 83.05, L2 81.37, L1 70.12,
  // L5 65.05 - the fully-birded park drops from #1 to #4.
  const rows = Array.from({ length: 78 }, (_, i) => `City Park Alpha Species ${i + 1}`).join("\n");
  await page.setInputFiles("#lifeListInput", {
    name: "life-list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`Common Name\n${rows}`)
  });
  await expect(page.locator(".stop-card")).toHaveCount(5);
  expect(await visibleOrder(page)).toEqual([
    "City Park Gamma", "Harbor Park", "City Park Beta", "City Park Alpha", "Near Pond"
  ]);
});

test("out-of-range shared balance falls back to the default", async ({ page }) => {
  await stubApis(page);
  await page.goto("/?bt=1&mode=area&origin=Test+Center%2C+Barcelona&maxStops=5&balance=99");
  await expect(page.locator("#balanceSlider")).toHaveValue("2");
  await expect(page.locator("#balanceHint")).toContainText("Recommended");
});

test("fractional shared balance falls back to the default", async ({ page }) => {
  await stubApis(page);
  // 0.6 must not round to "Leaning birding" - only in-range integers are valid.
  await page.goto("/?bt=1&mode=area&origin=Test+Center%2C+Barcelona&maxStops=5&balance=0.6");
  await expect(page.locator("#balanceSlider")).toHaveValue("2");
  await expect(page.locator("#balanceHint")).toContainText("Recommended");
});

test("an open detail panel refreshes when the balance changes", async ({ page }) => {
  await runAreaSearch(page);
  await page.locator('.stop-card:has-text("City Park Alpha") .stop-main').click();
  const subtitle = page.locator(".detail-subtitle");
  await expect(subtitle).toBeVisible();
  const before = (await subtitle.textContent()).match(/^\d+/)[0];
  await setSlider(page, "#balanceSliderResults", 0);
  const pillScore = await page
    .locator('.stop-card:has-text("City Park Alpha") .score-pill b')
    .textContent();
  expect(pillScore).not.toBe(before);
  await expect(subtitle).toContainText(`${pillScore} score`);
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
