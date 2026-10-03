const { test, expect } = require("@playwright/test");

// Shared behavior of the standalone seasonal and migration pages.
const PAGES = [
  { path: "/seasonal.html", input: "#seasonalLocation", suggestions: "#seasonalSuggestions" },
  { path: "/migration.html", input: "#timingLocation", suggestions: "#timingSuggestions" }
];

const PLACES = ["Ramona, California", "Ramona, Oklahoma", "Ramona, Kansas"].map((name, index) => ({
  name,
  lat: 33 + index,
  lng: -116 + index
}));

async function stubApis(page) {
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: { error: "Unstubbed" } }));
  await page.route("**/api/config", (route) => route.fulfill({ json: { ebirdConfigured: true } }));
  await page.route("**/api/geocode**", (route) => route.fulfill({ json: PLACES }));
}

for (const { path, input, suggestions } of PAGES) {
  test(`${path}: ArrowUp with nothing highlighted selects the last suggestion`, async ({ page }) => {
    await stubApis(page);
    await page.goto(path);
    await page.fill(input, "Ramona");
    const items = page.locator(`${suggestions} li`);
    await expect(items).toHaveCount(3);

    await page.press(input, "ArrowUp");
    await expect(items.nth(2)).toHaveClass(/is-active/);
    await expect(page.locator(`${suggestions} li.is-active`)).toHaveCount(1);

    await page.press(input, "Escape");
    await page.fill(input, "Ramon");
    await page.fill(input, "Ramona");
    await expect(items).toHaveCount(3);
    await page.press(input, "ArrowDown");
    await expect(items.nth(0)).toHaveClass(/is-active/);
  });

  test(`${path}: a geocoder 403 is not reported as an eBird token problem`, async ({ page }) => {
    await stubApis(page);
    await page.route("**/api/geocode**", (route) => route.fulfill({
      status: 403,
      json: { error: "Geocoding request was refused (403)." }
    }));
    await page.goto(`${path}?q=Ramona`);
    const message = page.locator(".empty-state");
    await expect(message).toContainText("Geocoding request was refused (403).");
    await expect(message).not.toContainText("Request a free token");
  });

  test(`${path}: an eBird 403 still asks for a token`, async ({ page }) => {
    await stubApis(page);
    await page.route("**/api/ebird/seasonality**", (route) => route.fulfill({
      status: 403,
      json: { error: "eBird rejected the API token." }
    }));
    await page.goto(`${path}?q=Ramona`);
    await expect(page.locator(".empty-state")).toContainText("Request a free token");
  });
}

test("seasonal Share falls back to a fully visible URL when copying fails", async ({ page }) => {
  await stubApis(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("Clipboard blocked")) }
    });
  });
  await page.goto("/seasonal.html");
  await page.click("#shareButton");

  const status = page.locator("#pageStatus");
  await expect(status).toHaveText(page.url());
  await expect(status).toHaveClass(/is-expanded/);
  await expect(status).toHaveCSS("white-space", "normal");
});
