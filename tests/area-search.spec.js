const { test, expect } = require("@playwright/test");
const { runAreaSearch, visibleOrder } = require("./helpers");

test("area search renders ranked stops from fixtures", async ({ page }) => {
  await runAreaSearch(page);
  const names = await visibleOrder(page);
  expect(names).toHaveLength(5);
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
