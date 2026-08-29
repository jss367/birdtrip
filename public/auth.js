// public/auth.js
// All Supabase interaction lives here. app.js calls into this module
// via window.birdtripAuth. Behind a `?auth=1` (or no `?auth=0`) flag.

(function () {
  const url = new URL(window.location.href);
  // Default: opt-in via ?auth=1. After validation, swap to ?auth!=0.
  const FEATURE_FLAG = url.searchParams.get("auth") === "1";

  const auth = {
    enabled: false,
    client: null,
    session: null,
    user: null,
    // True while a user-requested sign-out is in flight or has just completed.
    // Listeners consult this to tell an explicit sign-out (privacy-wipe local
    // data) apart from involuntary session loss such as a failed token
    // refresh (keep local data). app.js resets it after consuming it.
    explicitSignOut: false,
    listeners: new Set()
  };

  window.birdtripAuth = auth;

  auth.init = async function init(config) {
    if (!FEATURE_FLAG) return;
    if (!config || !config.supabase || !config.supabase.enabled) {
      showAuthStatus("Sign-in unavailable");
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.warn("Supabase JS did not load; auth disabled.");
      showAuthStatus("Sign-in unavailable");
      return;
    }

    auth.enabled = true;
    auth.client = window.supabase.createClient(
      config.supabase.url,
      config.supabase.anonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    try {
      const { data } = await auth.client.auth.getSession();
      setSession(data ? data.session : null, { fireListeners: false });
    } catch (err) {
      console.warn("Initial session fetch failed:", err && err.message);
    }

    auth.client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    revealAuthBar();
    renderAuthState();
  };

  auth.signIn = async function signIn() {
    if (!auth.client) return;
    // Preserve any other query params (e.g. shared trip links) across the round trip.
    const here = new URL(window.location.href);
    here.searchParams.set("auth", "1");
    here.hash = "";
    const { error } = await auth.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: here.toString() }
    });
    if (error) showAuthStatus(`Sign-in failed: ${error.message}`);
  };

  auth.signOut = async function signOut() {
    if (!auth.client) return;
    // Only clear the session/UI once Supabase confirms the sign-out. Clearing
    // on failure would make the page look signed out (and wipe local user
    // data via the sign-out listener) while the persisted Supabase session is
    // still valid, so a reload on a shared browser would restore the account.
    let error = null;
    // Set before awaiting: Supabase emits SIGNED_OUT through onAuthStateChange
    // while the call is still in flight, and the listeners must already know
    // that null session is user-requested.
    auth.explicitSignOut = true;
    try {
      ({ error } = await auth.client.auth.signOut());
    } catch (err) {
      error = err;
    }
    if (error) {
      auth.explicitSignOut = false;
      console.warn("Sign-out failed:", error && error.message);
      showAuthStatus(`Sign-out failed: ${(error && error.message) || "please try again"}`);
      return;
    }
    setSession(null);
  };

  auth.getProfile = async function getProfile() {
    if (!auth.client || !auth.user) return null;
    try {
      const { data, error } = await auth.client
        .from("profiles")
        .select("life_list, targets, ebird_token, preferences")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) {
        console.warn("Profile fetch failed:", error.message);
        return null;
      }
      // row_exists tells the caller whether a profiles row is already in the
      // database: the first write for a brand-new account must send every
      // column (see queueProfileUpsert), not just a diff against the empty
      // defaults below.
      if (data) return { ...data, row_exists: true };
      return {
        life_list: {},
        targets: "",
        ebird_token: null,
        preferences: {},
        row_exists: false
      };
    } catch (err) {
      console.warn("Profile fetch threw:", err && err.message);
      return null;
    }
  };

  auth.upsertProfile = async function upsertProfile(patch) {
    if (!auth.client || !auth.user) return { ok: false, reason: "not-signed-in" };
    const payload = { user_id: auth.user.id, ...patch };
    try {
      const { error } = await auth.client
        .from("profiles")
        // defaultToNull:false: if a partial payload ever has to insert (row
        // missing), omitted columns fall back to the database defaults
        // instead of null, so the NOT NULL constraints can't be violated.
        .upsert(payload, { onConflict: "user_id", defaultToNull: false });
      if (error) {
        console.warn("Profile upsert failed:", error.message);
        return { ok: false, reason: error.message };
      }
      return { ok: true };
    } catch (err) {
      console.warn("Profile upsert threw:", err && err.message);
      return { ok: false, reason: (err && err.message) || "unknown" };
    }
  };

  auth.onChange = function onChange(fn) {
    auth.listeners.add(fn);
    // Fire immediately with current state so callers don't have to special-case.
    try { fn(auth.user); } catch (err) { console.error(err); }
    return () => auth.listeners.delete(fn);
  };

  function setSession(session, options) {
    const fireListeners = !options || options.fireListeners !== false;
    auth.session = session || null;
    auth.user = session && session.user ? session.user : null;
    renderAuthState();
    if (!fireListeners) return;
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
      if (avatar) {
        const url = auth.user.user_metadata && auth.user.user_metadata.avatar_url;
        avatar.src = url || "";
        avatar.hidden = !url;
      }
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
    const bar = document.querySelector("#authBar");
    if (bar) bar.hidden = false;
    setTimeout(() => { el.hidden = true; }, 5000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const signInBtn = document.querySelector("#signInButton");
    const signOutBtn = document.querySelector("#signOutButton");
    if (signInBtn) signInBtn.addEventListener("click", () => auth.signIn());
    if (signOutBtn) signOutBtn.addEventListener("click", () => auth.signOut());
  });
})();
