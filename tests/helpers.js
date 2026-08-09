const { expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");

async function runAreaSearch(page, { maxStops = 5 } = {}) {
  await stubApis(page);
  await page.goto("/");
  await page.click("#settingsButton");
  await page.fill("#apiToken", "TEST_TOKEN");
  await page.keyboard.press("Escape");
  await page.click('[data-mode="area"]');
  await page.fill("#origin", "Test Center, Barcelona");
  await page.fill("#maxStops", String(maxStops));
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(maxStops, { timeout: 15000 });
}

function visibleOrder(page) {
  return page.locator(".stop-card .stop-name").allTextContents();
}

module.exports = { runAreaSearch, visibleOrder };
