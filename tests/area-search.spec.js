const { test, expect } = require("@playwright/test");
const { runAreaSearch, visibleOrder } = require("./helpers");
const { CENTER, recentFor } = require("./fixtures");

test("area search renders ranked stops from fixtures", async ({ page }) => {
  await runAreaSearch(page);
  const names = await visibleOrder(page);
  expect(names).toHaveLength(5);
});

test("default ordering matches the balanced baseline", async ({ page }) => {
  await runAreaSearch(page);
  // Utilities at convMult 1 (current + stable + practicality): L1 70.12,
  // L3 68.25, L4 68.05, L2 66.37, L5 50.05, then the far reserves (L6 43.46,
  // L8 36.61, L7 34.69) whose practicality collapses.
  expect(await visibleOrder(page)).toEqual([
    "City Park Alpha",
    "City Park Gamma",
    "Harbor Park",
    "City Park Beta",
    "Near Pond"
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
  expect(tooltips.some((t) => /Personal value 15(\.0)?\/15/.test(t))).toBe(true);
});

test("duplicate target entries do not dilute target credit", async ({ page }) => {
  await runAreaSearch(page, {
    beforeSubmit: async () => {
      // The same species twice must normalize to one target slot, not two:
      // otherwise the sole distinct target only earns half its personal value.
      await page.locator("#targetRows input").first().fill("Far Rich Reserve Species 1");
      await page.keyboard.press("Enter");
      await page.locator("#targetRows input").nth(1).fill("Far Rich Reserve Species 1");
      await page.keyboard.press("Enter");
    }
  });
  await expect(page.locator("#targetCount")).toHaveText("1");
  const tooltips = await page.locator(".score-pill").evaluateAll((els) => els.map((e) => e.title));
  expect(tooltips.some((t) => /Personal value 15(\.0)?\/15/.test(t))).toBe(true);
});

test("notable counts are distinct species, not a per-stop sum", async ({ page }) => {
  await runAreaSearch(page, {
    beforeSubmit: async () => {
      // One notable at the center falls within 10 km of every visible stop.
      await page.route("**/api/ebird/notable**", (route) => route.fulfill({
        json: [{ comName: "Vagrant Warbler", sciName: "Rarus vagrans", locId: "L0", locName: "Center", obsDt: "2026-01-01 09:00", howMany: 1, ...CENTER }]
      }));
    }
  });
  await expect(page.locator(".stop-card .metric-notable").first()).toHaveText("1");
  await expect(page.locator("#notableCount")).toHaveText("1");
  await expect(page.locator("#sightingSummary")).toContainText("including 1 nearby notable species");
});

test("spuhs, hybrids, and domestic forms never count as unseen species", async ({ page }) => {
  const extras = ["gull sp.", "Western x Glaucous-winged Gull (hybrid)", "Mallard (Domestic type)", "Western/Glaucous-winged Gull"];
  const withExtras = (observations) => [
    ...observations,
    ...extras.map((comName) => ({ ...observations[0], comName, sciName: comName }))
  ];
  await runAreaSearch(page, {
    beforeSubmit: async () => {
      await page.route("**/api/ebird/recent**", (route) => route.fulfill({ json: withExtras(recentFor("L1")) }));
      await page.route("**/api/ebird/hotspot-recent**", (route) => {
        const locId = new URL(route.request().url()).searchParams.get("locId");
        route.fulfill({ json: locId === "L1" ? withExtras(recentFor("L1")) : recentFor(locId) });
      });
      const rows = Array.from({ length: 78 }, (_, i) => `City Park Alpha Species ${i + 1}`).join("\n");
      await page.setInputFiles("#lifeListInput", {
        name: "life-list.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(`Common Name\n${rows}`)
      });
    }
  });
  await expect(page.locator('.stop-card:has-text("City Park Alpha")')).toHaveCount(1);
  await expect(page.locator('.stop-card:has-text("City Park Alpha") .chip-lifer')).toHaveCount(0);
});
