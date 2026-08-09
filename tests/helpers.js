const { expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");

async function runAreaSearch(page, { maxStops = 5, beforeSubmit } = {}) {
  await stubApis(page);
  await page.goto("/");
  await page.click("#settingsButton");
  await page.fill("#apiToken", "TEST_TOKEN");
  await page.keyboard.press("Escape");
  await page.click('[data-mode="area"]');
  await page.fill("#origin", "Test Center, Barcelona");
  await page.fill("#maxStops", String(maxStops));
  if (beforeSubmit) await beforeSubmit();
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(maxStops, { timeout: 15000 });
}

function visibleOrder(page) {
  return page.locator(".stop-card:not(.is-out-of-rank) .stop-name").allTextContents();
}

// range.fill() doesn't reliably fire "input" for range controls across
// Playwright versions; set the value and dispatch explicitly.
async function setSlider(page, selector, value) {
  await page.locator(selector).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

module.exports = { runAreaSearch, visibleOrder, setSlider };
