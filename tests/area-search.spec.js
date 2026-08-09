const { test, expect } = require("@playwright/test");
const { runAreaSearch, visibleOrder } = require("./helpers");

test("area search renders ranked stops from fixtures", async ({ page }) => {
  await runAreaSearch(page);
  const names = await visibleOrder(page);
  expect(names).toHaveLength(5);
});

test("default ordering matches the balanced baseline", async ({ page }) => {
  await runAreaSearch(page);
  expect(await visibleOrder(page)).toEqual([
    "City Park Alpha",
    "City Park Gamma",
    "Harbor Park",
    "City Park Beta",
    "Wetland Reserve North"
  ]);
});

test("scores display on a 0-100 scale", async ({ page }) => {
  await runAreaSearch(page);
  const title = await page.locator(".score-pill").first().getAttribute("title");
  expect(title).toMatch(/Overall \d+ of 100/);
  expect(title).toMatch(/Birding \d+\/100/);
  expect(title).toMatch(/Convenience \d+\/100/);
  expect(title).toMatch(/Preference: Recommended/);
});

test("single-target search earns full target points", async ({ page }) => {
  await runAreaSearch(page, {
    beforeSubmit: async () => {
      await page.locator("#targetRows input").first().fill("Far Rich Reserve Species 1");
      await page.keyboard.press("Enter");
    }
  });
  const tooltips = await page.locator(".score-pill").evaluateAll((els) => els.map((e) => e.title));
  expect(tooltips.some((t) => /Targets 15(\.0)?\/15/.test(t))).toBe(true);
});
