const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");

async function accountPage(page) {
  await stubApis(page);
  await page.route("**/api/config", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.supabase = { enabled: true, url: "https://example.invalid", anonKey: "test" };
    await route.fulfill({ json: config });
  });
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
  await page.addInitScript(() => {
    const session = { user: { id: "account-a", email: "test@example.invalid" } };
    window.profileWrites = [];
    window.supabase = { createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session } }),
        onAuthStateChange: (callback) => { window.authEvent = callback; },
        signOut: async () => {
          window.authEvent("SIGNED_OUT", null);
          return {};
        }
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { life_list: {}, targets: "Gilded Flicker", ebird_token: "PRIVATE_TOKEN", preferences: {} }
        }) }) }),
        upsert: async (patch) => {
          window.profileWrites.push(patch);
          return { error: { message: "offline" } };
        }
      })
    }) };
  });
  await page.goto("/?auth=1");
  await expect(page.locator("#targets")).toHaveValue("Gilded Flicker");
}

test("failed first reconciliation preserves a subsequent local clear on reload", async ({ page }) => {
  // A first merge has a local preference to write back, so it really fails
  // rather than committing the sync marker through a no-change diff.
  await page.addInitScript(() => {
    if (!localStorage.getItem("testSeeded")) {
      localStorage.setItem("routeBirdingPrefs", JSON.stringify({ origin: "Local origin" }));
      localStorage.setItem("testSeeded", "1");
    }
  });
  await accountPage(page);
  await expect.poll(() => page.evaluate(() => window.profileWrites.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem("routeBirdingSyncedUser"))).toBeNull();
  await page.locator("#targetRows .target-row input").first().evaluate((el) => {
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("routeBirdingProfileDirty") || "[]"))).toContain("targets");
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.birdtripAuth?.user?.id)).toBe("account-a");
  await expect.poll(() => page.evaluate(() => window.profileWrites.length)).toBeGreaterThan(0);
  await expect(page.locator("#targets")).toHaveValue("");
  expect(await page.evaluate(() => window.profileWrites.at(-1).targets)).toBe("");
});

test("refresh in a second tab cannot consume explicit sign-out intent", async ({ page, context }) => {
  await accountPage(page);
  const second = await context.newPage();
  await accountPage(second);
  await page.evaluate(() => window.birdtripAuth.signOut());
  await second.evaluate(() => {
    // Supabase delivers refresh before the sign-out broadcast to this tab.
    window.authEvent("TOKEN_REFRESHED", { user: { id: "account-a" } });
    window.authEvent("SIGNED_IN", { user: { id: "account-a" } });
    window.authEvent("SIGNED_OUT", null);
  });
  await expect(second.locator("#apiToken")).toHaveValue("");
  await expect(second.locator("#targets")).toHaveValue("");
  expect(await second.evaluate(() => localStorage.getItem("routeBirdingApiToken"))).toBeNull();
});
