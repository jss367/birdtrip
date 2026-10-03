const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");
const { runRouteSearch } = require("./helpers");

test("a failed search clears the previous route's summary, miles, and order toggle", async ({ page }) => {
  await runRouteSearch(page);
  await expect(page.locator("#routeDistance")).not.toHaveText("-");
  await page.route("**/api/geocode**", (route) => route.fulfill({ status: 500, json: { error: "Geocoder down" } }));
  await page.fill("#destination", "Somewhere Else");
  await page.click('button[type="submit"]');
  await expect(page.locator("#progressTitle")).toHaveText("Search failed");
  await expect(page.locator("#routeDistance")).toHaveText("-");
  await expect(page.locator("#resultContext")).toHaveText("No results for this search.");
  await expect(page.locator("#orderToggle")).toBeHidden();
});

test("a location that arrives after a search started does not replace the origin", async ({ page }) => {
  await page.addInitScript(() => {
    // Hold the geolocation answer until the test releases it.
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition(resolve) {
          window.releaseLocation = () => resolve({ coords: { latitude: 41.5, longitude: 2.2 } });
        }
      }
    });
  });
  await stubApis(page);
  await page.route("**/api/reverse-geocode**", (route) => route.fulfill({ json: { name: "Late Location" } }));
  await page.goto("/");
  await page.click("#settingsButton");
  await page.fill("#apiToken", "TEST_TOKEN");
  await page.keyboard.press("Escape");
  await page.click('[data-mode="area"]');
  const button = page.locator("#useCurrentLocationButton");
  const label = page.locator("#useCurrentLocationLabel");
  const idleLabel = await label.textContent();
  await page.click("#useCurrentLocationButton");
  await expect(label).toContainText("Locating");

  await page.fill("#origin", "Test Center, Barcelona");
  await page.fill("#maxStops", "5");
  await page.click('button[type="submit"]');
  await expect(page.locator(".stop-card")).toHaveCount(5, { timeout: 15000 });
  await page.evaluate(() => window.releaseLocation());
  await page.waitForTimeout(200);
  await expect(page.locator("#origin")).toHaveValue("Test Center, Barcelona");
  await expect(label).toHaveText(idleLabel);
  await expect(button).toBeEnabled();
});

test("Enter after typing past a highlighted suggestion keeps the typed text", async ({ page }) => {
  await stubApis(page);
  await page.goto("/");
  await page.fill("#origin", "");
  await page.locator("#origin").pressSequentially("Test Cen");
  await expect(page.locator("#originSuggestions li[role=option]")).toHaveCount(1);
  await page.locator("#origin").press("ArrowDown");
  await expect(page.locator("#originSuggestions li.is-active")).toHaveCount(1);
  // Typing invalidates the highlight before the next fetch returns.
  await page.locator("#origin").press("x");
  await page.evaluate(() => {
    // Enter on the input; don't let the form submit start a search.
    document.querySelector("form").addEventListener("submit", (event) => event.preventDefault(), { capture: true });
  });
  await page.locator("#origin").press("Enter");
  await expect(page.locator("#origin")).toHaveValue("Test Cenx");
});

test("returning to an already-fetched query replaces a stuck Searching placeholder", async ({ page }) => {
  await stubApis(page);
  let holdNext = false;
  await page.route("**/api/geocode**", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") || "";
    // Never answer the longer query, so its "Searching…" would stick.
    if (holdNext && q === "Test Cent") return;
    route.fallback();
  });
  await page.goto("/");
  await page.fill("#origin", "");
  await page.locator("#origin").pressSequentially("Test Cen");
  await expect(page.locator("#originSuggestions li[role=option]")).toHaveCount(1);
  holdNext = true;
  await page.locator("#origin").press("t");
  await expect(page.locator("#originSuggestions li.is-loading")).toHaveCount(1);
  await page.locator("#origin").press("Backspace");
  await expect(page.locator("#originSuggestions li.is-loading")).toHaveCount(0);
  await expect(page.locator("#originSuggestions li[role=option]")).toHaveCount(1);
});

test("ArrowUp with nothing highlighted selects the last suggestion", async ({ page }) => {
  await stubApis(page);
  await page.route("**/api/geocode**", (route) => route.fulfill({
    json: ["Alpha", "Bravo", "Charlie"].map((name, i) => ({ name: `Test ${name}`, lat: 41.4 + i / 100, lng: 2.1 }))
  }));
  await page.goto("/");
  await page.fill("#origin", "");
  await page.locator("#origin").pressSequentially("Test");
  await expect(page.locator("#originSuggestions li[role=option]")).toHaveCount(3);
  await page.locator("#origin").press("ArrowUp");
  await expect(page.locator("#originSuggestions li.is-active")).toHaveText("Test Charlie");
});


test("editing then undoing the origin still invalidates delayed geolocation", async ({ page }) => {
  await stubApis(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { value: {
      getCurrentPosition(resolve) {
        window.releaseLocation = () => resolve({ coords: { latitude: 41.5, longitude: 2.2 } });
      }
    } });
  });
  await page.route("**/api/reverse-geocode**", (route) => route.fulfill({ json: { name: "Late Location" } }));
  await page.goto("/");
  const before = await page.locator("#origin").inputValue();
  await page.click("#useCurrentLocationButton");
  await page.fill("#origin", "Explicit edit");
  await page.fill("#origin", before);
  await page.evaluate(() => window.releaseLocation());
  await page.waitForTimeout(200);
  await expect(page.locator("#origin")).toHaveValue(before);
  await expect(page.locator("#useCurrentLocationButton")).toBeEnabled();
  await expect(page.locator("#useCurrentLocationLabel")).not.toContainText("Locating");
});

test("reselecting the same origin invalidates delayed geolocation", async ({ page }) => {
  await stubApis(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { value: {
      getCurrentPosition(resolve) {
        window.releaseLocation = () => resolve({ coords: { latitude: 41.5, longitude: 2.2 } });
      }
    } });
  });
  await page.route("**/api/reverse-geocode**", (route) => route.fulfill({ json: { name: "Late Location" } }));
  await page.goto("/");
  await page.fill("#origin", "Test Center, Barcelona");
  await expect(page.locator("#originSuggestions li[role=option]")).toHaveCount(1);
  await page.locator("#origin").press("Escape");
  await page.click("#useCurrentLocationButton");
  // Reopen the list without editing the origin.
  await page.locator("#origin").press("ArrowDown");
  await expect(page.locator("#originSuggestions li[role=option]")).toBeVisible();
  await page.locator("#originSuggestions li[role=option]").click();
  const selected = await page.locator("#origin").inputValue();
  await page.evaluate(() => window.releaseLocation());
  await page.waitForTimeout(200);
  await expect(page.locator("#origin")).toHaveValue(selected);
  await expect(page.locator("#useCurrentLocationButton")).toBeEnabled();
});
