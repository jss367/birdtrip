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
    const redirectTo = window.location.origin + window.location.pathname + "?auth=1";
    const { error } = await auth.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) showAuthStatus(`Sign-in failed: ${error.message}`);
  };

  auth.signOut = async function signOut() {
    if (!auth.client) return;
    try {
      await auth.client.auth.signOut();
    } catch (err) {
      console.warn("Sign-out failed:", err && err.message);
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
      return data || {
        life_list: {},
        targets: "",
        ebird_token: null,
        preferences: {}
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
        .upsert(payload, { onConflict: "user_id" });
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
