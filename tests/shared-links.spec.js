const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");

test("a shared link without targets clears the recipient's saved targets", async ({ page }) => {
  await stubApis(page);
  await page.addInitScript(() => {
    localStorage.setItem("routeBirdingPrefs", JSON.stringify({ targets: "Gilded Flicker" }));
  });
  await page.goto("/?bt=1&mode=area&origin=Test+Center%2C+Barcelona&maxStops=5");
  await expect(page.locator("#origin")).toHaveValue("Test Center, Barcelona");
  await expect(page.locator("#targets")).toHaveValue("");
});

test("the app still starts when the browser blocks localStorage", async ({ page }) => {
  await stubApis(page);
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { get: blocked, configurable: true });
  });
  await page.goto("/");
  await page.click("#settingsButton");
  await page.fill("#apiToken", "TEST_TOKEN");
  await page.keyboard.press("Escape");
  await page.click('[data-mode="area"]');
  await page.fill("#origin", "Test Center, Barcelona");
  await page.fill("#maxStops", "5");
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(5, { timeout: 15000 });
});
