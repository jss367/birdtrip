# User Accounts & Personalization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional Google sign-in and per-user persistence (life list, targets, eBird token, preferences) backed by Supabase. Anonymous use unchanged. Behind a `?auth=1` feature flag until validated.

**Architecture:** Browser ↔ Supabase direct for auth + profile row (Row-Level Security enforces per-user access). Node server unchanged except for exposing the Supabase public URL and anon key to the browser via the existing `/api/config` endpoint. localStorage stays as fast-path cache; Supabase is the cross-device source of truth when signed in.

**Tech Stack:** Vanilla JS frontend, Node `http` server (no build step, no test harness), Supabase JS v2 via CDN, Render hosting.

**Design source:** `docs/plans/2026-05-23-user-accounts-design.md`.

**Verification model:** No automated test harness exists in this repo. Each task uses **manual verification** in a browser (and Supabase dashboard where relevant). The bite-sized format below substitutes "manual check" for the test step.

---

## Task 0: Supabase + Google OAuth one-time setup (manual, no code)

**Why first:** the schema task and the JS integration both depend on credentials that only exist after this is done. ~15 minutes; do once.

**Files:** none.

**Step 1: Create the Supabase project.**

- Sign in at `https://supabase.com` with Google.
- Create a new project named `birdtrip`. Pick the closest region. Save the auto-generated database password somewhere private (not committed).
- Wait for provisioning (~1 min).

**Step 2: Capture the public credentials.**

In project Settings → API, copy:
- Project URL (looks like `https://<ref>.supabase.co`) → will become `SUPABASE_URL`
- `anon` public key → will become `SUPABASE_ANON_KEY`

Save these locally (e.g. `.env.local`, gitignored) for use in later tasks. Do **not** commit them.

**Step 3: Create the Google OAuth client.**

- Go to `https://console.cloud.google.com`, create a project named `birdtrip` (or reuse an existing one).
- APIs & Services → OAuth consent screen → External, fill in app name, support email. Scopes: `openid`, `email`, `profile`. Add yourself as a test user.
- APIs & Services → Credentials → Create Credentials → OAuth Client ID → Web application.
- Authorized JavaScript origins: `https://birdtrip.org`, `http://localhost:4177`.
- Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback` (use the exact Supabase project URL).
- Copy the Client ID and Client Secret.

**Step 4: Wire Google into Supabase Auth.**

- Supabase dashboard → Authentication → Providers → Google → enable.
- Paste Client ID and Client Secret.
- Under Authentication → URL Configuration: set Site URL to `https://birdtrip.org`. Add `http://localhost:4177` to Additional Redirect URLs.

**Step 5: Manual verification.**

- Supabase dashboard → Authentication → Users → click "Add user" → "Send invitation" is not needed; instead, open `https://<ref>.supabase.co/auth/v1/authorize?provider=google` in a browser. You should be redirected through Google sign-in and back to a Supabase URL. A new user should appear in Authentication → Users.
- If the redirect fails with `redirect_uri_mismatch`, the Google Cloud redirect URI does not exactly match Supabase's callback URL. Fix and retry.

**Step 6: No commit.** Nothing to commit; this task is environment setup.

---

## Task 1: Apply database schema in Supabase

**Files:**
- Create: `db/migrations/0001_profiles.sql` (committed for reproducibility; not auto-applied by the server)

**Step 1: Write the migration file.**

```sql
-- db/migrations/0001_profiles.sql
-- Apply manually via Supabase dashboard → SQL Editor.

create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  life_list      jsonb        not null default '{}'::jsonb,
  targets        text         not null default '',
  ebird_token    text,
  preferences    jsonb        not null default '{}'::jsonb,
  updated_at     timestamptz  not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own row read" on public.profiles;
create policy "own row read"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "own row insert" on public.profiles;
create policy "own row insert"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "own row update" on public.profiles;
create policy "own row update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_profile_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();
```

> **Schema notes:**
> - `life_list` stores the existing in-app shape verbatim (`{source, fileName, importedAt, species: [...], displayNames: [...]}`) rather than a normalized `{common, scientific, code}[]` shape. Reason: the importer already produces this object and the app reads it directly. Re-shaping would touch the importer for no functional gain (YAGNI). The design doc's `{common, scientific, code}` aspiration is deferred until something actually needs it.
> - `targets` is `text` (matches the existing free-text textarea in `els.targets.value`), not parsed JSON. Same YAGNI reasoning.

**Step 2: Apply the migration in Supabase.**

- Supabase dashboard → SQL Editor → New Query → paste the migration → Run.
- Verify success (no error, "Success. No rows returned").

**Step 3: Manual verification.**

In SQL Editor, run:

```sql
select table_name, row_security
from information_schema.tables
where table_name = 'profiles';

select policyname from pg_policies where tablename = 'profiles';
```

Expected:
- `profiles` row with `row_security = YES`.
- Three policy rows: `own row read`, `own row insert`, `own row update`.

**Step 4: Commit.**

```bash
git add db/migrations/0001_profiles.sql
git commit -m "Add profiles table migration for user accounts"
```

---

## Task 2: Expose Supabase config to the browser via /api/config

**Files:**
- Modify: `server.js:328-346` (the `/api/config` handler)

**Step 1: Read the env vars at startup.**

In `server.js`, near the top with the other env reads (around line 13), add:

```js
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
```

**Step 2: Add a `supabase` block to the `/api/config` response.**

Modify the existing handler (around `server.js:328`):

```js
if (url.pathname === "/api/config") {
  return sendJson(res, 200, {
    defaultMapProvider: DEFAULT_MAP_PROVIDER,
    ebirdConfigured: Boolean(process.env.EBIRD_API_KEY),
    providers: { /* unchanged */ },
    ebird: { /* unchanged */ },
    supabase: {
      enabled: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY
    }
  });
}
```

> Both values are designed to be public. RLS (Task 1) is the security boundary, not key secrecy.

**Step 3: Add the env vars locally and on Render.**

Local dev: add to your shell or a `.env.local` you source before `npm start`:

```sh
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=eyJ...
```

Render: dashboard → service → Environment → add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (do not deploy yet — wait until the rest of the feature lands so prod stays unaffected).

**Step 4: Manual verification.**

Start the server: `npm start`. Then:

```sh
curl -s http://localhost:4177/api/config | python3 -m json.tool
```

Expected: response contains a `supabase` field with `enabled: true`, `url`, `anonKey`. If unset locally, `enabled: false` and empty strings.

**Step 5: Commit.**

```bash
git add server.js
git commit -m "Expose Supabase URL and anon key via /api/config"
```

---

## Task 3: Load Supabase JS in index.html behind a feature flag

**Files:**
- Modify: `public/index.html` (add CDN script and an auth bar placeholder)

**Step 1: Decide where to put the Supabase script.**

Add this `<script>` tag in `<head>`, after existing scripts/styles but before `app.js`. It's small and only used when auth is enabled.

```html
<script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

> Using the official CDN keeps "no build step" intact. Pinned to major v2 to get patch updates without breaking changes.

**Step 2: Add the auth UI placeholder in the header.**

Locate the existing header/topbar area (search `index.html` for `quickStartButton` to find the button row). Add an auth slot next to it:

```html
<div id="authBar" class="auth-bar" hidden>
  <button id="signInButton" type="button" class="auth-button" hidden>
    Sign in with Google
  </button>
  <div id="signedInBox" class="auth-signed-in" hidden>
    <img id="userAvatar" class="auth-avatar" alt="" />
    <span id="userEmail" class="auth-email"></span>
    <button id="signOutButton" type="button" class="auth-button-secondary">
      Sign out
    </button>
  </div>
  <span id="authStatus" class="auth-status" hidden></span>
</div>
```

The whole `#authBar` starts `hidden`; Task 4 will reveal it when the feature flag and Supabase config are both present.

**Step 3: Add minimal styles.**

Append to `public/styles.css`:

```css
.auth-bar { display: flex; align-items: center; gap: 0.5rem; }
.auth-avatar { width: 24px; height: 24px; border-radius: 50%; }
.auth-email { font-size: 0.9rem; opacity: 0.85; }
.auth-button, .auth-button-secondary {
  padding: 0.35rem 0.7rem;
  font-size: 0.9rem;
  border-radius: 6px;
  cursor: pointer;
}
.auth-status { font-size: 0.85rem; opacity: 0.7; }
.auth-signed-in { display: flex; align-items: center; gap: 0.5rem; }
```

> Visual polish is out of scope for this slice; these are utilitarian defaults the existing design system can override later.

**Step 4: Manual verification.**

Reload the app. The auth bar should be in the DOM (visible in dev tools) but hidden. Nothing else should change.

**Step 5: Commit.**

```bash
git add public/index.html public/styles.css
git commit -m "Add Supabase JS CDN and hidden auth UI scaffold"
```

---

## Task 4: Add the auth module (`public/auth.js`)

**Files:**
- Create: `public/auth.js`
- Modify: `public/index.html` (load `auth.js` before `app.js`)

**Step 1: Create the module.**

```js
// public/auth.js
// All Supabase interaction lives here. app.js calls into this module.

(function () {
  const FEATURE_FLAG = new URL(window.location.href).searchParams.get("auth") === "1";

  const auth = {
    enabled: false,
    client: null,
    session: null,
    user: null,
    listeners: new Set()
  };

  window.birdtripAuth = auth;

  auth.init = async function init(config) {
    if (!FEATURE_FLAG) return;
    if (!config?.supabase?.enabled) return;
    if (typeof window.supabase?.createClient !== "function") {
      console.warn("Supabase JS did not load; auth disabled.");
      return;
    }
    auth.enabled = true;
    auth.client = window.supabase.createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data: { session } } = await auth.client.auth.getSession();
    setSession(session);

    auth.client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    revealAuthBar();
    renderAuthState();
  };

  auth.signIn = async function signIn() {
    if (!auth.client) return;
    const { error } = await auth.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname + "?auth=1" }
    });
    if (error) showAuthStatus(`Sign-in failed: ${error.message}`);
  };

  auth.signOut = async function signOut() {
    if (!auth.client) return;
    await auth.client.auth.signOut();
    setSession(null);
  };

  auth.onChange = function onChange(fn) {
    auth.listeners.add(fn);
    fn(auth.user);
    return () => auth.listeners.delete(fn);
  };

  function setSession(session) {
    auth.session = session || null;
    auth.user = session?.user || null;
    renderAuthState();
    auth.listeners.forEach((fn) => {
      try { fn(auth.user); } catch (err) { console.error(err); }
    });
  }

  function revealAuthBar() {
    const bar = document.querySelector("#authBar");
    if (bar) bar.hidden = false;
  }

  function renderAuthState() {
    const signInBtn = document.querySelector("#signInButton");
    const signedInBox = document.querySelector("#signedInBox");
    const avatar = document.querySelector("#userAvatar");
    const emailEl = document.querySelector("#userEmail");
    if (!signInBtn || !signedInBox) return;
    if (auth.user) {
      signInBtn.hidden = true;
      signedInBox.hidden = false;
      if (avatar) avatar.src = auth.user.user_metadata?.avatar_url || "";
      if (emailEl) emailEl.textContent = auth.user.email || "";
    } else {
      signInBtn.hidden = false;
      signedInBox.hidden = true;
    }
  }

  function showAuthStatus(msg) {
    const el = document.querySelector("#authStatus");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 5000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#signInButton")?.addEventListener("click", () => auth.signIn());
    document.querySelector("#signOutButton")?.addEventListener("click", () => auth.signOut());
  });
})();
```

**Step 2: Load the module in `index.html`.**

Add immediately before the existing `app.js` script tag:

```html
<script defer src="auth.js"></script>
```

**Step 3: Manual verification.**

- Reload `http://localhost:4177/` (no flag). The auth bar should stay hidden. No console errors.
- Reload `http://localhost:4177/?auth=1`. The "Sign in with Google" button should appear. Clicking it should redirect to Google and back, and the avatar + email should appear.
- Click "Sign out" — button reverts to "Sign in".

**Step 4: Commit.**

```bash
git add public/auth.js public/index.html
git commit -m "Add auth.js module and wire Google sign-in"
```

---

## Task 5: Initialize auth from `loadAppConfig`

**Files:**
- Modify: `public/app.js` (around `loadAppConfig` near line 806)

**Step 1: Find the existing config load.**

`public/app.js:806` calls `apiJson("/api/config")` and stores the result on `state.config`. After that resolves, call `window.birdtripAuth.init(config)`.

**Step 2: Modify the function.**

Locate the function containing `apiJson("/api/config")`. After the config is applied to `state.config`, add:

```js
if (window.birdtripAuth?.init) {
  await window.birdtripAuth.init(config);
}
```

If `loadAppConfig` is not already async, make it async and `await` accordingly. If it returns a promise that other code awaits (it does, via `state.configReady`), the auth init now also blocks `configReady` resolution — that's fine and intentional (means the merge step in Task 9 can run before any user mutations).

**Step 3: Manual verification.**

- Reload `?auth=1`. Confirm via dev tools console: `birdtripAuth.enabled === true`.
- Reload without flag: `birdtripAuth.enabled === false`.

**Step 4: Commit.**

```bash
git add public/app.js
git commit -m "Initialize auth module after app config loads"
```

---

## Task 6: Add the profile-fetch helper

**Files:**
- Modify: `public/auth.js` (add fetch/upsert helpers)

**Step 1: Add `getProfile` and `upsertProfile` to the auth module.**

Append inside the IIFE:

```js
auth.getProfile = async function getProfile() {
  if (!auth.client || !auth.user) return null;
  const { data, error } = await auth.client
    .from("profiles")
    .select("life_list, targets, ebird_token, preferences")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) {
    console.warn("Profile fetch failed:", error.message);
    return null;
  }
  return data || {
    life_list: {},
    targets: "",
    ebird_token: null,
    preferences: {}
  };
};

auth.upsertProfile = async function upsertProfile(patch) {
  if (!auth.client || !auth.user) return { ok: false, reason: "not-signed-in" };
  const payload = { user_id: auth.user.id, ...patch };
  const { error } = await auth.client
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" });
  if (error) {
    console.warn("Profile upsert failed:", error.message);
    return { ok: false, reason: error.message };
  }
  return { ok: true };
};
```

**Step 2: Manual verification.**

Reload signed in at `?auth=1`. In the dev tools console:

```js
await birdtripAuth.getProfile();
// → { life_list: {}, targets: "", ebird_token: null, preferences: {} }

await birdtripAuth.upsertProfile({ targets: "Greater Hoopoe-Lark" });
// → { ok: true }

await birdtripAuth.getProfile();
// → { ..., targets: "Greater Hoopoe-Lark" }
```

Then in Supabase dashboard → Table Editor → `profiles`, confirm a row exists with your user_id and `targets = "Greater Hoopoe-Lark"`.

**Step 3: Commit.**

```bash
git add public/auth.js
git commit -m "Add getProfile and upsertProfile helpers"
```

---

## Task 7: Hydrate from account on sign-in

**Files:**
- Modify: `public/app.js`

**Step 1: Add a hydration function.**

In `public/app.js`, add near `restorePreferences` (around line 359):

```js
async function hydrateFromAccount() {
  if (!window.birdtripAuth?.user) return;
  const profile = await window.birdtripAuth.getProfile();
  if (!profile) return;

  // Life list: only overwrite if account has one.
  if (profile.life_list && typeof profile.life_list === "object" && Array.isArray(profile.life_list.species)) {
    state.lifeList = {
      source: profile.life_list.source || "",
      fileName: profile.life_list.fileName || "",
      importedAt: profile.life_list.importedAt || "",
      species: new Set(profile.life_list.species.map(normalizeName).filter(Boolean)),
      displayNames: (profile.life_list.displayNames || []).map(String).filter(Boolean)
    };
    updateLifeListStatus();
    updateInputSummaries();
  }

  // Targets (raw textarea content).
  if (typeof profile.targets === "string" && profile.targets.length) {
    els.targets.value = profile.targets;
    updateInputSummaries();
  }

  // eBird token.
  if (typeof profile.ebird_token === "string" && profile.ebird_token.length) {
    els.apiToken.value = profile.ebird_token;
    els.rememberToken.checked = true;
    updateSetupStatus();
  }

  // Preferences.
  if (profile.preferences && typeof profile.preferences === "object") {
    for (const field of PREF_FIELDS) {
      if (typeof profile.preferences[field] === "string") {
        els[field].value = profile.preferences[field];
      }
    }
  }

  // Cache back to localStorage so the next anonymous open isn't empty.
  savePreferences();
}
```

**Step 2: Run hydration on sign-in.**

After `loadAppConfig()` resolves (the same spot you added `birdtripAuth.init` in Task 5), register an auth-change listener:

```js
if (window.birdtripAuth?.onChange) {
  window.birdtripAuth.onChange(async (user) => {
    if (user) await runMergeAndHydrate(); // defined in Task 9
  });
}
```

For Task 7 only (before Task 9 lands), temporarily replace `runMergeAndHydrate` with `hydrateFromAccount`. Task 9 will replace it with the merge logic.

**Step 3: Manual verification.**

- Sign in at `?auth=1`. With an existing row in `profiles` containing targets, confirm the targets textarea populates after sign-in.
- Sign out. The textarea retains its last value (we don't blank on sign-out by design — localStorage cache survives).

**Step 4: Commit.**

```bash
git add public/app.js
git commit -m "Hydrate UI state from account profile after sign-in"
```

---

## Task 8: Write-through on mutations

**Files:**
- Modify: `public/app.js` (`savePreferences` around line 389)

**Step 1: Add a debounced upsert helper.**

Near the top of `app.js`, add:

```js
let upsertTimer = 0;
let upsertPending = null;
function queueProfileUpsert() {
  if (!window.birdtripAuth?.user) return;
  if (upsertPending) return; // a write is already queued
  upsertPending = setTimeout(async () => {
    upsertPending = null;
    const patch = {
      life_list: state.lifeList.species.size ? {
        source: state.lifeList.source,
        fileName: state.lifeList.fileName,
        importedAt: state.lifeList.importedAt,
        species: Array.from(state.lifeList.species),
        displayNames: state.lifeList.displayNames
      } : {},
      targets: els.targets.value || "",
      ebird_token: els.rememberToken.checked ? (els.apiToken.value || null) : null,
      preferences: PREF_FIELDS.reduce((acc, f) => {
        acc[f] = els[f].value;
        return acc;
      }, {})
    };
    const result = await window.birdtripAuth.upsertProfile(patch);
    if (!result.ok) {
      addWarning("Couldn't save to your account — still saved in this browser.");
      renderWarnings();
    }
  }, 750);
}
```

> Single 750 ms debounce: covers rapid-fire typing in the targets textarea, batches the whole row each time. Simple, no per-field diffing.

**Step 2: Call it from `savePreferences`.**

At the end of `savePreferences()`, append:

```js
queueProfileUpsert();
```

That's the only callsite needed because every existing mutation already goes through `savePreferences` (token edits, life-list import, preference changes).

**Step 3: Manual verification.**

- Signed in at `?auth=1`, edit the targets textarea. Wait 1 second. Refresh the page. Targets persist.
- Open the same URL in a different browser, sign in with the same Google account. Targets and any other persisted fields should appear.
- Disconnect network. Edit targets. Confirm the warning toast appears within ~2 seconds. Reconnect, edit again, confirm it saves (and the warning is gone next mutation).

**Step 4: Commit.**

```bash
git add public/app.js
git commit -m "Write profile changes through to Supabase"
```

---

## Task 9: Anonymous → signed-in merge with conflict dialog

**Files:**
- Modify: `public/app.js` (new `runMergeAndHydrate` function, replace Task 7's temp call)
- Modify: `public/index.html` (modal markup)
- Modify: `public/styles.css` (modal styles)

**Step 1: Add the conflict modal to `index.html`.**

```html
<div id="authMergeModal" class="modal" hidden role="dialog" aria-modal="true">
  <div class="modal-card">
    <h2>Reconcile your account</h2>
    <p>We found data in both places. Pick which to keep for each item.</p>
    <ul id="authMergeList" class="modal-list"></ul>
    <div class="modal-actions">
      <button id="authMergeConfirm" type="button">Apply</button>
    </div>
  </div>
</div>
```

**Step 2: Add minimal modal styles (or reuse existing — search styles.css for `.modal`; if present, skip this step).**

```css
.modal[hidden] { display: none; }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { background: #fff; padding: 1.5rem; border-radius: 8px; max-width: 480px; width: 90%; }
.modal-list { list-style: none; padding: 0; margin: 1rem 0; }
.modal-list li { margin: 0.75rem 0; }
.modal-actions { display: flex; justify-content: flex-end; margin-top: 1rem; }
```

**Step 3: Replace `hydrateFromAccount` call with `runMergeAndHydrate`.**

In `public/app.js`:

```js
async function runMergeAndHydrate() {
  if (!window.birdtripAuth?.user) return;
  const account = await window.birdtripAuth.getProfile();
  if (!account) return;

  const conflicts = [];
  const merged = {};

  function fieldState(localHasData, accountHasData, equal) {
    if (!accountHasData && !localHasData) return "noop";
    if (!accountHasData && localHasData) return "push-local";
    if (accountHasData && !localHasData) return "use-account";
    return equal ? "noop" : "conflict";
  }

  const localLifeListHas = state.lifeList.species.size > 0;
  const accountLifeListHas = Array.isArray(account.life_list?.species) && account.life_list.species.length > 0;
  const lifeListEqual = localLifeListHas && accountLifeListHas
    && account.life_list.species.length === state.lifeList.species.size
    && account.life_list.species.every((s) => state.lifeList.species.has(normalizeName(s)));
  const lifeListChoice = fieldState(localLifeListHas, accountLifeListHas, lifeListEqual);
  if (lifeListChoice === "conflict") {
    conflicts.push({
      field: "life_list",
      label: `Life list (browser: ${state.lifeList.species.size}, account: ${account.life_list.species.length})`,
      options: ["Use account", "Use this browser", "Merge (union)"]
    });
  } else {
    merged.life_list = lifeListChoice;
  }

  const localTargets = (els.targets.value || "").trim();
  const accountTargets = (account.targets || "").trim();
  const targetsChoice = fieldState(Boolean(localTargets), Boolean(accountTargets), localTargets === accountTargets);
  if (targetsChoice === "conflict") {
    conflicts.push({
      field: "targets",
      label: "Target species",
      options: ["Use account", "Use this browser"]
    });
  } else {
    merged.targets = targetsChoice;
  }

  const localToken = els.rememberToken.checked ? (els.apiToken.value || "") : "";
  const accountToken = account.ebird_token || "";
  const tokenChoice = fieldState(Boolean(localToken), Boolean(accountToken), localToken === accountToken);
  if (tokenChoice === "conflict") {
    conflicts.push({
      field: "ebird_token",
      label: "eBird API token",
      options: ["Use account", "Use this browser"]
    });
  } else {
    merged.ebird_token = tokenChoice;
  }

  // Preferences: scalar-by-scalar, account wins on conflict silently (small UI values, not worth a modal).
  merged.preferences = "merge-prefs-silently";

  const choices = conflicts.length ? await showMergeDialog(conflicts) : {};
  await applyMergeChoices(account, merged, choices);
  savePreferences(); // re-emits write-through with the merged result
}

async function applyMergeChoices(account, merged, choices) {
  // life_list
  const lifeListChoice = choices.life_list || merged.life_list;
  if (lifeListChoice === "Use account" || lifeListChoice === "use-account") {
    hydrateLifeListFromAccount(account.life_list);
  } else if (lifeListChoice === "Use this browser" || lifeListChoice === "push-local") {
    // no-op, local stays
  } else if (lifeListChoice === "Merge (union)") {
    const union = new Set([
      ...state.lifeList.species,
      ...account.life_list.species.map(normalizeName).filter(Boolean)
    ]);
    state.lifeList.species = union;
    const displayUnion = new Set([...state.lifeList.displayNames, ...(account.life_list.displayNames || [])]);
    state.lifeList.displayNames = Array.from(displayUnion);
    updateLifeListStatus();
  }

  // targets
  const targetsChoice = choices.targets || merged.targets;
  if (targetsChoice === "Use account" || targetsChoice === "use-account") {
    els.targets.value = account.targets || "";
    updateInputSummaries();
  }

  // ebird_token
  const tokenChoice = choices.ebird_token || merged.ebird_token;
  if (tokenChoice === "Use account" || tokenChoice === "use-account") {
    els.apiToken.value = account.ebird_token || "";
    els.rememberToken.checked = Boolean(account.ebird_token);
    updateSetupStatus();
  }

  // preferences: silent account-wins for any account-set field; keep local where account empty.
  if (account.preferences) {
    for (const field of PREF_FIELDS) {
      const accountVal = account.preferences[field];
      if (typeof accountVal === "string" && accountVal.length) {
        els[field].value = accountVal;
      }
    }
  }
}

function hydrateLifeListFromAccount(ll) {
  if (!ll || !Array.isArray(ll.species)) return;
  state.lifeList = {
    source: ll.source || "",
    fileName: ll.fileName || "",
    importedAt: ll.importedAt || "",
    species: new Set(ll.species.map(normalizeName).filter(Boolean)),
    displayNames: (ll.displayNames || []).map(String).filter(Boolean)
  };
  updateLifeListStatus();
  updateInputSummaries();
}

function showMergeDialog(conflicts) {
  return new Promise((resolve) => {
    const modal = document.querySelector("#authMergeModal");
    const list = document.querySelector("#authMergeList");
    list.innerHTML = "";
    const choices = {};
    for (const c of conflicts) {
      const li = document.createElement("li");
      const label = document.createElement("div");
      label.textContent = c.label;
      const select = document.createElement("select");
      for (const opt of c.options) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        select.appendChild(o);
      }
      select.addEventListener("change", () => { choices[c.field] = select.value; });
      choices[c.field] = c.options[0];
      li.appendChild(label);
      li.appendChild(select);
      list.appendChild(li);
    }
    modal.hidden = false;
    const confirm = document.querySelector("#authMergeConfirm");
    const onClick = () => {
      modal.hidden = true;
      confirm.removeEventListener("click", onClick);
      resolve(choices);
    };
    confirm.addEventListener("click", onClick);
  });
}
```

**Step 4: Manual verification — all four cases per field.**

For each: clear local state (DevTools → Application → Local Storage → clear) and/or clear the row from Supabase Table Editor as needed, then test:

- **Both empty:** sign in. No modal. UI stays default.
- **Account only:** insert a row in Supabase with `targets = "x"`, clear localStorage, sign in. No modal. Targets shows `x`.
- **Browser only:** delete the Supabase row, type `y` in targets locally, sign in. No modal. Account now has `y`.
- **Conflict:** put `x` in Supabase, `y` in localStorage, sign in. Modal appears with the Targets row. Pick one, click Apply, confirm the UI reflects the choice and the next mutation writes the chosen value.

**Step 5: Commit.**

```bash
git add public/app.js public/index.html public/styles.css
git commit -m "Add anonymous-to-signed-in merge with conflict dialog"
```

---

## Task 10: End-to-end smoke test (manual)

**Files:** none.

**Step 1: Cross-device smoke.**

- Browser A: open `http://localhost:4177/?auth=1` (or your prod URL with the flag), sign in, import a small eBird CSV. Wait 1 second.
- Browser B (different browser or incognito): open the same URL with the flag, sign in. Confirm the life list, targets, token (if remembered), and preferences appear without any local prior data.

**Step 2: Offline tolerance.**

- DevTools → Network → Offline. Edit targets. Confirm warning toast. Edit again 1 second later — confirm only one toast (debounced).
- Go back online. Edit targets once more. Confirm the next reload still shows the latest value (i.e., a successful write happened after recovery).

**Step 3: Sign-out behavior.**

- Sign out. Confirm targets, life list, and token all remain in the UI (localStorage cache survives).
- Reload. Confirm the same — anonymous mode keeps its data.

**Step 4: No-flag default.**

- Open the same URL without `?auth=1`. Confirm the auth bar stays hidden and nothing is sent to Supabase (Network tab: no `*.supabase.co` requests).

**Step 5: Commit.** Nothing to commit; smoke test only. If any step fails, return to the relevant task.

---

## Task 11: Make the feature flag default-on

**Files:**
- Modify: `public/auth.js`

**Step 1: Flip the default.**

In the IIFE at the top of `auth.js`:

```js
// Before:
const FEATURE_FLAG = new URL(window.location.href).searchParams.get("auth") === "1";

// After:
const FEATURE_FLAG = new URL(window.location.href).searchParams.get("auth") !== "0";
```

Now auth is on by default; `?auth=0` is the emergency off switch.

**Step 2: Manual verification.**

Reload the prod URL with no params. Auth bar should appear. `?auth=0` hides it.

**Step 3: Commit.**

```bash
git add public/auth.js
git commit -m "Enable auth by default; ?auth=0 disables"
```

---

## Task 12: Document follow-ups

**Files:**
- Modify: `docs/plans/2026-05-23-user-accounts-design.md` (add a "Status" note at the top: implemented per `2026-05-23-user-accounts-plan.md`, with remaining follow-ups unchanged)
- Modify: `README.md` (one line under "Bird Data" mentioning optional sign-in)

**Step 1: Update design doc status.**

Add at the top of the design doc:

```markdown
> **Status:** Implemented 2026-05-23 per `docs/plans/2026-05-23-user-accounts-plan.md`. Follow-ups listed at bottom remain open.
```

**Step 2: Update README.**

Under the existing "Bird Data" section, add:

```markdown
Signed-in users (Google) get their life list, target species, eBird token, and preferences remembered across devices. Sign-in is optional; anonymous use is unchanged.
```

**Step 3: Commit.**

```bash
git add docs/plans/2026-05-23-user-accounts-design.md README.md
git commit -m "Document user accounts feature in README and design status"
```

---

## Cross-Cutting Notes

- **No new dependencies in `package.json`.** Supabase is loaded via CDN; the server change is one env-var read.
- **Render env vars** must be added before the first signed-in user hits prod, otherwise `/api/config` returns `supabase.enabled: false` and the auth bar stays hidden.
- **RLS is the only gate** on profile data. If anyone disables RLS or changes the policies, the anon key allows reading every profile. Re-check the policies (Task 1 Step 3 verification query) any time the schema is migrated.
- **Token storage** is plaintext (encrypted at rest by Supabase, but not application-encrypted). Same threat model as today's localStorage. Document it in the design doc if a stricter model is ever requested.
- **One known gap:** if the user signs in on Browser A, then mutates on Browser B, then mutates on Browser A without reloading, A's write will clobber B's most recent change. Acceptable for v1; if multi-device-concurrent edit becomes real, switch to per-field upserts with optimistic concurrency on `updated_at`.
