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
