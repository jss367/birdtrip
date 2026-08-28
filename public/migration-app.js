(function () {
  const BS = window.BirdtripSeasonal;
  const MT = window.BirdtripMigrationTiming;
  const STORAGE_KEY = "birdtripMigrationView";
  const PREFS_KEY = "routeBirdingPrefs";
  const SESSION_TOKEN_KEY = "birdtripEbirdApiToken";
  const STRIP_LIMIT = 12;
  const STATUS_ICONS = { passage: "wind", summer: "sun", winter: "snowflake", irregular: "shuffle" };
  const STATUS_HINTS = {
    passage: "Only here while migrating — seeing one means movement is underway.",
    summer: "Arrive in spring to breed and leave in fall; arrival and departure are the movement.",
    winter: "Arrive in fall to spend the winter and head back out in spring.",
    irregular: "Reported in a pattern that doesn't fit a clean seasonal shape."
  };

  const els = {
    form: document.querySelector("#timingForm"),
    input: document.querySelector("#timingLocation"),
    suggestions: document.querySelector("#timingSuggestions"),
    group: document.querySelector("#timingGroup"),
    submit: document.querySelector("#timingSubmit"),
    results: document.querySelector("#timingResults"),
    resultContext: document.querySelector("#resultContext"),
    status: document.querySelector("#pageStatus"),
    shareButton: document.querySelector("#shareButton"),
    tooltip: document.querySelector("#timingTooltip")
  };

  const state = {
    busy: false,
    ebirdConfigured: null,
    place: null,
    data: null,
    query: ""
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function setStatus(message) {
    if (els.status) els.status.textContent = message || "";
  }

  function storedApiToken() {
    try {
      const sessionToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (typeof sessionToken === "string" && sessionToken.trim()) return sessionToken.trim();
    } catch {
      // Session storage unavailable; a remembered token may still be available.
    }
    try {
      const prefs = JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}");
      return typeof prefs.apiToken === "string" ? prefs.apiToken.trim() : "";
    } catch {
      return "";
    }
  }

  async function apiJson(url) {
    const token = storedApiToken();
    const response = await fetch(url, {
      headers: token ? { "x-ebird-api-token": token } : {}
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const error = new Error(body?.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return body;
  }

  // Location autocomplete: same lightweight approach as the seasonal page.
  const ac = { items: [], active: -1, resolved: null, timer: null, controller: null };

  function closeSuggestions() {
    ac.items = [];
    ac.active = -1;
    els.suggestions.hidden = true;
    els.suggestions.innerHTML = "";
    els.input.setAttribute("aria-expanded", "false");
  }

  function renderSuggestions() {
    if (!ac.items.length) return closeSuggestions();
    els.suggestions.innerHTML = ac.items
      .map((item, index) => `
        <li role="option" data-index="${index}" class="${index === ac.active ? "is-active" : ""}" aria-selected="${index === ac.active}">
          <i data-lucide="map-pin"></i>
          <span class="ac-name">${escapeHtml(item.name)}</span>
        </li>`)
      .join("");
    els.suggestions.hidden = false;
    els.input.setAttribute("aria-expanded", "true");
    renderIcons();
  }

  function pickSuggestion(index) {
    const item = ac.items[index];
    if (!item) return;
    els.input.value = item.name;
    ac.resolved = item;
    closeSuggestions();
  }

  async function fetchSuggestions(query) {
    if (ac.controller) ac.controller.abort();
    ac.controller = new AbortController();
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
        signal: ac.controller.signal
      });
      if (!response.ok) return;
      const matches = await response.json();
      if (state.busy || els.input.value.trim() !== query) return;
      ac.items = Array.isArray(matches) ? matches.slice(0, 5) : [];
      ac.active = -1;
      renderSuggestions();
    } catch {
      // Aborted or offline - the field still works via submit-time geocoding.
    }
  }

  els.input.addEventListener("input", () => {
    ac.resolved = null;
    clearTimeout(ac.timer);
    const query = els.input.value.trim();
    if (query.length < 2) return closeSuggestions();
    ac.timer = setTimeout(() => fetchSuggestions(query), 250);
  });

  els.input.addEventListener("keydown", (event) => {
    if (els.suggestions.hidden) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      ac.active = (ac.active + step + ac.items.length) % ac.items.length;
      renderSuggestions();
    } else if (event.key === "Enter" && ac.active >= 0) {
      event.preventDefault();
      pickSuggestion(ac.active);
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  });

  els.suggestions.addEventListener("mousedown", (event) => {
    const item = event.target.closest("li[data-index]");
    if (!item) return;
    event.preventDefault();
    pickSuggestion(Number(item.dataset.index));
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".autocomplete")) closeSuggestions();
  });

  function renderMessage(icon, html) {
    els.results.innerHTML = `
      <div class="empty-state">
        <i data-lucide="${icon}"></i>
        <p>${html}</p>
      </div>`;
    renderIcons();
  }

  function renderTokenNotice() {
    renderMessage(
      "key-round",
      'Migration timing needs an eBird API token. <a href="https://ebird.org/api/keygen" target="_blank" rel="noopener">Request a free token</a>, add it in the <a href="./">Trip Planner</a> settings, then search again here.'
    );
  }

  function renderError(error) {
    if (error && (error.status === 401 || error.status === 403)) return renderTokenNotice();
    renderMessage("triangle-alert", escapeHtml(error?.message || "Something went wrong. Try again."));
  }

  function formatPercent(rate) {
    return `${Math.round(rate * 100)}%`;
  }

  function selectedGroup() {
    return MT.isGroup(els.group.value) ? els.group.value : "all";
  }

  function groupNoun(timing) {
    return timing.groupKey === "all" ? "migrants" : timing.group.label.toLowerCase();
  }

  function headline(timing) {
    const noun = groupNoun(timing);
    if (!timing.migrantCount) {
      return `No clearly migratory ${noun === "migrants" ? "species" : noun} stood out in this area's reports.`;
    }
    const windows = [timing.peaks.spring, timing.peaks.fall]
      .filter(Boolean)
      .map((window) => MT.runLabel(window.months));
    if (!windows.length) return `${capitalize(noun)} show little concentrated movement here.`;
    return `${capitalize(noun)} move through mainly ${windows.join(" and ")}.`;
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function rightNowLine(timing) {
    const now = new Date().getMonth();
    const peak = Math.max(...timing.monthly, 0);
    if (!timing.migrantCount || peak <= 0) return "";
    const ratio = timing.monthly[now] / peak;
    const level = ratio >= 0.75
      ? "near its annual peak"
      : ratio >= 0.4
        ? "moderate"
        : ratio > 0.1
          ? "light"
          : "quiet";
    return `Right now (${MT.MONTH_NAMES[now]}): movement is ${level} — ${timing.movingCount[now]} of ${timing.migrantCount} migrant species typically on the move.`;
  }

  function chartHtml(timing) {
    const peak = Math.max(...timing.monthly, 0);
    if (peak <= 0) return "";
    const now = new Date().getMonth();
    const windowMonths = new Set([
      ...(timing.peaks.spring?.months || []),
      ...(timing.peaks.fall?.months || [])
    ]);
    const cells = timing.monthly.map((value, month) => {
      const height = value > 0 ? Math.max(6, Math.round((value / peak) * 100)) : 0;
      const classes = [
        "timing-chart-cell",
        windowMonths.has(month) ? "is-window" : "",
        month === now ? "is-now" : ""
      ].filter(Boolean).join(" ");
      const tip = `${MT.MONTH_NAMES[month]}: ${timing.movingCount[month]} of ${timing.migrantCount} migrant species on the move`;
      return `<span class="${classes}" data-tip="${escapeHtml(tip)}"><i style="height:${height}%"></i><b>${MT.MONTH_LABELS[month]}</b></span>`;
    }).join("");
    return `
      <section class="timing-chart-panel">
        <h3>Movement through the year</h3>
        <div class="timing-chart" aria-label="Relative migration movement by month">${cells}</div>
        <p>Bar height is the combined movement of ${timing.groupKey === "all" ? "every migrant species" : `the migrant ${escapeHtml(groupNoun(timing))}`} here: presence for birds passing through, arrivals and departures for seasonal residents. Green months are the peak windows; the outlined month is now.</p>
      </section>`;
  }

  function monthStripHtml(item) {
    const highlight = new Set(item.runs.flat());
    const cells = MT.MONTH_LABELS.map((label, month) => {
      const rate = item.presence[month] || 0;
      const height = rate > 0 ? Math.max(8, Math.round(rate * 100)) : 0;
      const peak = highlight.has(month) ? " is-peak" : "";
      const tip = `${label} · reported on ${formatPercent(rate)} of sampled dates`;
      return `<span class="seasonal-month-cell${peak}" data-tip="${escapeHtml(tip)}"><i style="height:${height}%"></i></span>`;
    }).join("");
    return `<div class="seasonal-months" aria-hidden="true">${cells}</div>`;
  }

  function speciesTimingText(item) {
    const runs = item.runs;
    if (!runs.length) return "Timing unclear from the sample.";
    if (item.status === "passage") return `Passes through ${MT.runsLabel(runs)}.`;
    if (item.status === "summer" || item.status === "winter") {
      const run = runs.reduce((a, b) => (b.length > a.length ? b : a));
      const arrival = MT.MONTH_NAMES[run[0]];
      const departure = MT.MONTH_NAMES[run[run.length - 1]];
      return `Arrives around ${arrival}, departs around ${departure}.`;
    }
    return `Present mainly ${MT.runsLabel(runs)}.`;
  }

  function speciesRowHtml(item) {
    return `
      <article class="seasonal-species">
        <div class="seasonal-species-head">
          <h4>${escapeHtml(item.comName)}</h4>
          <p class="seasonal-sci">${escapeHtml(item.sciName)}</p>
        </div>
        ${monthStripHtml(item)}
        <p class="seasonal-rates">${escapeHtml(speciesTimingText(item))} Reported on up to <b>${formatPercent(item.peakRate)}</b> of sampled dates.</p>
      </article>`;
  }

  function statusSectionHtml(status, items) {
    if (!items.length) return "";
    const shown = items.slice(0, STRIP_LIMIT);
    const rest = items.slice(STRIP_LIMIT);
    const more = rest.length
      ? `<p class="timing-more">Also: ${rest.map((item) => escapeHtml(item.comName)).join(", ")}.</p>`
      : "";
    return `
      <section class="seasonal-season">
        <header class="seasonal-season-header">
          <i data-lucide="${STATUS_ICONS[status]}"></i>
          <h3>${MT.STATUS_LABELS[status]}</h3>
          <span>${items.length} species</span>
        </header>
        <p class="timing-status-hint">${STATUS_HINTS[status]}</p>
        ${shown.map(speciesRowHtml).join("")}
        ${more}
      </section>`;
  }

  function renderResults() {
    const { place, data } = state;
    if (!place || !data) return;
    const timing = MT.buildMigrationTiming(data.species, data.sampledDays, {
      latitude: place.lat,
      group: selectedGroup()
    });
    const minSamples = Math.min(...data.sampledDays);
    const maxSamples = Math.max(...data.sampledDays);
    const sampleSummary = minSamples === maxSamples
      ? `${minSamples} days per month`
      : `${minSamples}–${maxSamples} days per month`;
    els.resultContext.textContent =
      `eBird reports from ${data.regionName} · ${data.year}, sampled ${sampleSummary}`;

    const nowLine = rightNowLine(timing);
    const leftovers = [];
    if (timing.residentCount) {
      leftovers.push(`${timing.residentCount} year-round resident${timing.residentCount === 1 ? "" : "s"} (they don't migrate here)`);
    }
    if (timing.scarceCount) {
      leftovers.push(`${timing.scarceCount} species too scarce in the sample to judge`);
    }
    const sections = ["passage", "summer", "winter", "irregular"]
      .map((status) => statusSectionHtml(status, timing.buckets[status]))
      .join("");

    els.results.innerHTML = `
      <div class="seasonal-overview">
        <span>${escapeHtml(place.name)} · ${escapeHtml(timing.group.label)}</span>
        <h3>${escapeHtml(headline(timing))}</h3>
        ${nowLine ? `<p class="timing-now">${escapeHtml(nowLine)}</p>` : ""}
        <p>${escapeHtml(timing.group.description)} Built from the share of sampled dates each species was reported in this area — real reports, not live radar.</p>
      </div>
      ${chartHtml(timing)}
      ${timing.migrantCount
        ? `<div class="seasonal-grid">${sections}</div>`
        : `<div class="empty-state"><i data-lucide="bird"></i><p>No migratory species in this group stood out here. Try another group or a nearby location.</p></div>`}
      ${leftovers.length ? `<p class="timing-more timing-leftovers">Not shown: ${escapeHtml(leftovers.join(" and "))}.</p>` : ""}`;
    renderIcons();
  }

  // One shared tooltip for the month bars, driven by event delegation.
  els.results.addEventListener("pointerover", (event) => {
    const cell = event.target.closest("[data-tip]");
    if (!cell || !els.tooltip) return;
    els.tooltip.textContent = cell.dataset.tip || "";
    els.tooltip.hidden = false;
  });
  els.results.addEventListener("pointermove", (event) => {
    if (!els.tooltip || els.tooltip.hidden) return;
    els.tooltip.style.left = `${event.clientX + 12}px`;
    els.tooltip.style.top = `${event.clientY + 14}px`;
  });
  els.results.addEventListener("pointerout", (event) => {
    if (!els.tooltip) return;
    if (event.target.closest("[data-tip]")) els.tooltip.hidden = true;
  });

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: state.query, group: selectedGroup() }));
    } catch {
      // Storage unavailable - the search still works, it just isn't remembered.
    }
    const url = new URL(window.location.href);
    url.search = "";
    if (state.query) url.searchParams.set("q", state.query);
    url.searchParams.set("group", selectedGroup());
    window.history.replaceState(null, "", url);
  }

  function initialView() {
    const search = new URLSearchParams(window.location.search);
    const urlGroup = search.get("group");
    const urlQuery = (search.get("q") || "").trim();
    let stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      stored = null;
    }
    const storedGroup = stored && typeof stored.group === "string" ? stored.group : "";
    const storedQuery = stored && typeof stored.q === "string" ? stored.q.trim() : "";
    return {
      // Legacy corridor-map links also used ?group=<key>; their ?month is ignored.
      group: MT.isGroup(urlGroup) ? urlGroup : (MT.isGroup(storedGroup) ? storedGroup : "all"),
      q: urlQuery || storedQuery
    };
  }

  async function runSearch() {
    if (state.busy) return;
    const query = els.input.value.trim();
    if (query.length < 2) {
      setStatus("Enter a location to search.");
      return;
    }
    state.busy = true;
    els.submit.disabled = true;
    clearTimeout(ac.timer);
    if (ac.controller) ac.controller.abort();
    closeSuggestions();
    try {
      setStatus("Finding location…");
      let place = ac.resolved && ac.resolved.name === query ? ac.resolved : null;
      if (!place) {
        const matches = await apiJson(`/api/geocode?q=${encodeURIComponent(query)}`);
        if (!Array.isArray(matches) || !matches.length) {
          throw new Error(`No location matched "${query}".`);
        }
        place = matches[0];
      }
      setStatus("Sampling a year of eBird reports…");
      renderMessage(
        "loader-2",
        "Sampling last year's eBird reports across all twelve months… the first search for a new area can take up to a minute."
      );
      els.results.querySelector(".empty-state")?.classList.add("seasonal-loading");
      const data = await apiJson(
        `/api/ebird/seasonality?lat=${encodeURIComponent(place.lat)}&lng=${encodeURIComponent(place.lng)}`
      );
      state.place = place;
      state.data = data;
      state.query = query;
      renderResults();
      persist();
      setStatus("");
    } catch (error) {
      renderError(error);
      setStatus("");
    } finally {
      state.busy = false;
      els.submit.disabled = false;
    }
  }

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });

  els.group.addEventListener("change", () => {
    if (!state.data) return;
    renderResults();
    persist();
  });

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard copy failed");
  }

  els.shareButton?.addEventListener("click", async () => {
    try {
      await copyTextToClipboard(window.location.href);
      setStatus("Link copied.");
    } catch {
      setStatus(window.location.href);
    }
  });

  async function init() {
    renderIcons();
    try {
      const response = await fetch("/api/config");
      const config = response.ok ? await response.json() : null;
      state.ebirdConfigured = Boolean(config?.ebirdConfigured);
    } catch {
      state.ebirdConfigured = false;
    }
    const view = initialView();
    els.group.value = view.group;
    if (view.q) els.input.value = view.q;
    if (!storedApiToken() && !state.ebirdConfigured) {
      renderTokenNotice();
      return;
    }
    if (view.q) runSearch();
  }

  // BS is loaded for presenceRates via buildMigrationTiming; keep the reference
  // explicit so a missing script surfaces immediately.
  if (!BS || !MT) {
    renderMessage("triangle-alert", "This page failed to load its scripts. Refresh to try again.");
  } else {
    init();
  }
})();
