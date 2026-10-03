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
  await expect.poll(() => page.evaluate(() => [...window.readDirtyProfileColumns()])).toContain("targets");
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


test("account switch waits for an old fetch then hydrates the current user", async ({ page }) => {
  await accountPage(page);
  await page.evaluate(() => {
    const auth = window.birdtripAuth;
    auth.getProfile = () => new Promise((resolve) => { window.finishOldProfile = resolve; });
    // Start an A reconciliation and hold its fetch.
    window.runMergeAndHydrate();
    window.authEvent("SIGNED_IN", { user: { id: "account-b" } });
    auth.getProfile = async () => ({ targets: "B target", ebird_token: "B_TOKEN", life_list: {}, preferences: {}, row_exists: true });
  });
  // Prior account fields are removed without waiting for its slow fetch.
  await expect(page.locator("#apiToken")).toHaveValue("");
  await page.evaluate(() => window.finishOldProfile({ targets: "A stale target", ebird_token: "A_TOKEN", life_list: {}, preferences: {} }));
  await expect(page.locator("#targets")).toHaveValue("B target");
  await expect(page.locator("#apiToken")).toHaveValue("B_TOKEN");
});

test("account switch cancels the old merge dialog and hydrates the current user", async ({ page }) => {
  await accountPage(page);
  await page.evaluate(() => {
    window.birdtripAuth.getProfile = async () => ({ targets: "Conflicting A", ebird_token: "PRIVATE_TOKEN", life_list: {}, preferences: {}, row_exists: true });
    localStorage.removeItem("routeBirdingSyncedUser");
    localStorage.removeItem("routeBirdingRetainedOwner");
    window.markProfileDirty(["targets"]);
    window.runMergeAndHydrate();
  });
  await expect(page.locator("#authMergeModal")).toBeVisible();
  await page.evaluate(() => {
    window.birdtripAuth.getProfile = async () => ({ targets: "B target", ebird_token: "B_TOKEN", life_list: {}, preferences: {}, row_exists: true });
    window.authEvent("SIGNED_IN", { user: { id: "account-b" } });
  });
  await expect(page.locator("#authMergeModal")).toBeHidden();
  await expect(page.locator("#targets")).toHaveValue("B target");
  await expect(page.locator("#apiToken")).toHaveValue("B_TOKEN");
});


test("successful search and saved-trip rewrites retain the auth opt-in", async ({ page }) => {
  await accountPage(page);
  await page.evaluate(() => {
    window.replaceHistoryUrl(window.buildShareUrl({ autoRun: true }).toString());
  });
  expect(new URL(page.url()).searchParams.get("auth")).toBe("1");
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.birdtripAuth?.enabled)).toBe(true);
  await page.evaluate(() => window.replaceHistoryUrl("/?bt=1&origin=Saved"));
  expect(new URL(page.url()).searchParams.get("auth")).toBe("1");
});

test("another tab's successful flush preserves a debouncing edit through reload", async ({ page, context }) => {
  await accountPage(page);
  const second = await context.newPage();
  await accountPage(second);
  await page.evaluate(() => {
    window.birdtripAuth.upsertProfile = () => new Promise((resolve) => { window.completeWrite = resolve; });
    document.querySelector("#targetRows .target-row input").value = "A edit";
    window.syncTargetsFromRows();
  });
  await expect.poll(() => page.evaluate(() => typeof window.completeWrite)).toBe("function");
  await second.locator("#targetRows .target-row input").first().evaluate((el) => {
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => window.completeWrite({ ok: true }));
  expect(await second.evaluate(() => [...window.readDirtyProfileColumns()])).toContain("targets");
  await second.reload();
  await expect.poll(() => second.evaluate(() => window.profileWrites.length)).toBeGreaterThan(0);
  await expect(second.locator("#targets")).toHaveValue("");
  expect(await second.evaluate(() => window.profileWrites.at(-1).targets)).toBe("");
});
