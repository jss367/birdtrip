const { test, expect } = require("@playwright/test");
const { stubApis } = require("./fixtures");

async function accountPage(page, targets = "Gilded Flicker") {
  await stubApis(page);
  await page.route("**/api/config", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.supabase = { enabled: true, url: "https://example.invalid", anonKey: "test" };
    await route.fulfill({ json: config });
  });
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
  await page.addInitScript((targets) => {
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
          data: { life_list: {}, targets, ebird_token: "PRIVATE_TOKEN", preferences: {} }
        }) }) }),
        upsert: async (patch) => {
          window.profileWrites.push(patch);
          return { error: { message: "offline" } };
        }
      })
    }) };
  }, targets);
  await page.goto("/?auth=1");
  await expect(page.locator("#targets")).toHaveValue(targets);
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
  });
  await expect.poll(() => page.evaluate(() => typeof window.finishOldProfile)).toBe("function");
  await page.evaluate(() => {
    window.authEvent("SIGNED_IN", { user: { id: "account-b" } });
    window.birdtripAuth.getProfile = async () => ({ targets: "B target", ebird_token: "B_TOKEN", life_list: {}, preferences: {}, row_exists: true });
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


for (const superseded of [false, true]) {
test(`a new tab retires ${superseded ? "superseded closed-tab revisions" : "a closed tab dirty revision"} after reconciliation`, async ({ page, context }) => {
  await accountPage(page);
  const latest = superseded ? await context.newPage() : page;
  if (superseded) {
    await accountPage(latest);
    await page.locator("#targetRows .target-row input").first().evaluate((el) => {
      el.value = "Earlier orphan target";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await latest.locator("#targetRows .target-row input").first().evaluate((el) => {
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.close(); // sessionStorage ownership disappears with the tab.
  if (superseded) await latest.close();
  const reopened = await context.newPage();
  // Mock the same account, then allow this reconciliation's write to succeed.
  await stubApis(reopened);
  await reopened.route("**/api/config", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.supabase = { enabled: true, url: "https://example.invalid", anonKey: "test" };
    await route.fulfill({ json: config });
  });
  await reopened.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
  await reopened.addInitScript(() => {
    window.supabase = { createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "account-a" } } } }),
        onAuthStateChange: () => {}
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
          targets: "Gilded Flicker", ebird_token: "PRIVATE_TOKEN", life_list: {}, preferences: {}
        } }) }) }),
        upsert: async () => ({})
      })
    }) };
  });
  await reopened.goto("/?auth=1");
  await expect(reopened.locator("#targets")).toHaveValue("");
  await expect.poll(() => reopened.evaluate(() => [...window.readDirtyProfileColumns()])).toEqual([]);
  expect(await reopened.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("routeBirdingProfileDirty:")))).toEqual([]);
  await reopened.reload();
  // Once the pending clear is confirmed, a later remote update wins normally.
  await expect(reopened.locator("#targets")).toHaveValue("Gilded Flicker");
});

}


test("a stale cross-tab cache cannot claim an unmatched dirty target", async ({ page, context }) => {
  await accountPage(page);
  const second = await context.newPage();
  await accountPage(second);
  await page.locator("#targetRows .target-row input").first().evaluate((el) => {
    el.value = "A pending target";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await second.evaluate(() => {
    document.querySelector("#recentDays").value = "9";
    window.savePreferences();
  });
  await page.close();
  await second.close();
  const reopened = await context.newPage();
  await accountPage(reopened, "Account latest target");
  expect(await reopened.evaluate(() => [...window.readDirtyProfileColumns()])).not.toContain("targets");
  await expect.poll(() => reopened.evaluate(() => window.profileWrites.length)).toBeGreaterThan(0);
  expect(await reopened.evaluate(() => window.profileWrites.every((patch) => !Object.hasOwn(patch, "targets")))).toBe(true);
});

test("sign-out from a shared trip does not persist the sender's locked fields", async ({ page }) => {
  await accountPage(page);
  await page.evaluate(() => {
    window.applySharedSearch({ mode: "route", origin: "SenderOrigin", destination: "SenderDestination", targets: "SenderTarget" });
  });
  await expect(page.locator("#targets")).toHaveValue("SenderTarget");
  await page.evaluate(() => window.birdtripAuth.signOut());
  await expect(page.locator("#targets")).toHaveValue("SenderTarget");
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("routeBirdingPrefs")));
  expect(prefs.targets).toBe("");
  expect(prefs.origin).not.toBe("SenderOrigin");
  expect(prefs.destination).not.toBe("SenderDestination");
});


test("an explicit mode choice on a shared page persists without adopting its fields", async ({ page }) => {
  await accountPage(page);
  await page.evaluate(() => window.applySharedSearch({ mode: "route", origin: "SenderOrigin", targets: "SenderTarget" }));
  await page.locator("#areaModeButton").click();
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("routeBirdingPrefs")));
  expect(prefs.searchMode).toBe("area");
  expect(prefs.origin).not.toBe("SenderOrigin");
  expect(prefs.targets).not.toBe("SenderTarget");
});


test("a partly represented orphan revision retires after reconciliation", async ({ page, context }) => {
  await accountPage(page);
  await page.evaluate(() => {
    document.querySelector("#targets").value = "Pending target";
    document.querySelector("#recentDays").value = "9";
    window.savePreferences();
    // A later stale cache save preserves the target but restores preferences.
    const prefs = JSON.parse(localStorage.getItem("routeBirdingPrefs"));
    prefs.recentDays = "7";
    localStorage.setItem("routeBirdingPrefs", JSON.stringify(prefs));
  });
  await page.close();
  const reopened = await context.newPage();
  await accountPage(reopened, "Pending target");
  await reopened.evaluate(async () => {
    window.birdtripAuth.upsertProfile = async () => ({ ok: true });
    await window.runMergeAndHydrate();
    await window.flushProfileUpsert();
  });
  await expect.poll(() => reopened.evaluate(() => [...window.readDirtyProfileColumns()])).toEqual([]);
  await reopened.reload();
  await expect(reopened.locator("#targets")).toHaveValue("Pending target");
});

test("OAuth restoration retires old sign-out intent without wiping a later refresh loss", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("routeBirdingExplicitSignOut", "1");
    sessionStorage.setItem("routeBirdingOAuthPending", "1");
  });
  await accountPage(page);
  expect(await page.evaluate(() => localStorage.getItem("routeBirdingExplicitSignOut"))).toBeNull();
  await page.evaluate(() => window.authEvent("SIGNED_OUT", null));
  await expect(page.locator("#targets")).toHaveValue("Gilded Flicker");
  await expect(page.locator("#apiToken")).toHaveValue("PRIVATE_TOKEN");
});


test("reconciliation preserves a live peer's unmatched pending preference", async ({ page, context }) => {
  await accountPage(page);
  await page.evaluate(() => {
    window.birdtripAuth.upsertProfile = () => new Promise((resolve) => { window.finishPeerWrite = resolve; });
    document.querySelector("#targets").value = "Pending target";
    document.querySelector("#recentDays").value = "9";
    window.savePreferences();
    window.peerDirtyKey = Object.keys(localStorage).find((key) => key.startsWith("routeBirdingProfileDirty:"));
    window.peerDirtyRaw = localStorage.getItem(window.peerDirtyKey);
  });
  await expect.poll(() => page.evaluate(() => typeof window.finishPeerWrite)).toBe("function");
  // Deterministically simulate a stale whole-cache save while the owner is
  // still live and its network write remains held.
  await page.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem("routeBirdingPrefs"));
    prefs.recentDays = "7";
    localStorage.setItem("routeBirdingPrefs", JSON.stringify(prefs));
  });
  const reconciler = await context.newPage();
  await accountPage(reconciler, "Pending target");
  await reconciler.evaluate(async () => {
    window.birdtripAuth.upsertProfile = async () => ({ ok: true });
    await window.runMergeAndHydrate();
    await window.flushProfileUpsert();
  });
  expect(await page.evaluate(() => localStorage.getItem(window.peerDirtyKey))).toBe(await page.evaluate(() => window.peerDirtyRaw));
  expect(await page.evaluate(() => localStorage.getItem(`routeBirdingProfileDirtyAck:${JSON.parse(window.peerDirtyRaw).revision}`))).toBeNull();
  // Failed owner writes leave the exact record pending; a later successful
  // owner retry confirms its preference rather than a peer clearing it.
  await page.evaluate(() => window.finishPeerWrite({ ok: false }));
  await page.evaluate(async () => {
    window.birdtripAuth.upsertProfile = async (patch) => { window.retryPatch = patch; return { ok: true }; };
    await window.flushProfileUpsert();
  });
  expect(await page.evaluate(() => window.retryPatch.preferences.recentDays)).toBe("9");
  expect(await page.evaluate(() => localStorage.getItem(window.peerDirtyKey))).toBeNull();
});


test("a pending preference does not overwrite a newer remote setting on reload", async ({ page }) => {
  await accountPage(page);
  await expect.poll(() => page.evaluate(() => window.profileWrites.length)).toBeGreaterThan(0);
  await page.evaluate(async () => {
    window.birdtripAuth.upsertProfile = async () => ({ ok: true });
    await window.flushProfileUpsert();
  });
  expect(await page.evaluate(() => [...window.readDirtyProfileColumns()])).toEqual([]);
  await page.evaluate(() => {
    document.querySelector("#recentDays").value = "9";
    window.savePreferences();
  });
  await page.addInitScript(() => {
    const createClient = window.supabase.createClient;
    window.supabase.createClient = (...args) => {
      const client = createClient(...args);
      const from = client.from;
      client.from = (...table) => {
        const query = from(...table);
        query.select = () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
          life_list: {}, targets: "Gilded Flicker", ebird_token: "PRIVATE_TOKEN",
          preferences: { recentDays: "7", maxStops: "18" }
        } }) }) });
        return query;
      };
      return client;
    };
  });
  await page.reload();
  await expect(page.locator("#recentDays")).toHaveValue("9");
  await expect(page.locator("#maxStops")).toHaveValue("18");
  await expect.poll(() => page.evaluate(() => window.profileWrites.length)).toBeGreaterThan(0);
  const written = await page.evaluate(() => window.profileWrites.at(-1).preferences);
  expect(written.recentDays).toBe("9");
  expect(written.maxStops).toBe("18");
});
