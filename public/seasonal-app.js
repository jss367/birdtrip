(function () {
  const BS = window.BirdtripSeasonal;
  const STORAGE_KEY = "birdtripSeasonalView";
  const PREFS_KEY = "routeBirdingPrefs";
  const SESSION_TOKEN_KEY = "birdtripEbirdApiToken";
  const UNSEEN_ONLY_KEY = "birdtripSeasonalUnseenOnly";
  const SEASON_ICONS = { winter: "snowflake", spring: "flower-2", summer: "sun", fall: "leaf" };
  const RECENT_RADIUS_KM = 25;
  const RECENT_DAYS = 30;
  // The most /api/ebird/species will return; a full page means the feed was cut off.
  const RECENT_MAX_RESULTS = 10000;

  const els = {
    form: document.querySelector("#seasonalForm"),
    input: document.querySelector("#seasonalLocation"),
    suggestions: document.querySelector("#seasonalSuggestions"),
    speciesInput: document.querySelector("#seasonalSpecies"),
    speciesSuggestions: document.querySelector("#seasonalSpeciesSuggestions"),
    submit: document.querySelector("#seasonalSubmit"),
    results: document.querySelector("#seasonalResults"),
    resultContext: document.querySelector("#resultContext"),
    status: document.querySelector("#pageStatus"),
    shareButton: document.querySelector("#shareButton"),
    tooltip: document.querySelector("#seasonalTooltip"),
    unseenOnlyToggle: document.querySelector("#unseenOnlyToggle"),
    unseenOnly: document.querySelector("#unseenOnly")
  };

  const state = {
    busy: false,
    ebirdConfigured: null,
    lifeList: { species: new Set(), count: 0 },
    // The last rendered search, so the life-list toggle can re-render it
    // without fetching again.
    lastResult: null
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

  function setStatus(message, options = {}) {
    if (!els.status) return;
    els.status.textContent = message || "";
    // Clipboard-fallback URLs must stay fully visible and copyable; the
    // default status style truncates at 340px.
    els.status.classList.toggle("is-expanded", Boolean(options.expanded));
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

  // The trip planner owns the life list (import, clear, and account sync) and
  // caches it in its preferences; this page only reads that cache.
  function readLifeList() {
    try {
      const lifeList = JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}")?.lifeList;
      const species = Array.isArray(lifeList?.species) ? lifeList.species : [];
      const displayNames = Array.isArray(lifeList?.displayNames) ? lifeList.displayNames : [];
      const aliases = new Set(species.map(BS.normalizeSpeciesName).filter(Boolean));
      return { species: aliases, count: aliases.size ? displayNames.length || aliases.size : 0 };
    } catch {
      return { species: new Set(), count: 0 };
    }
  }

  function readUnseenOnly() {
    try {
      return window.localStorage.getItem(UNSEEN_ONLY_KEY) === "1";
    } catch {
      return false;
    }
  }

  function saveUnseenOnly(value) {
    try {
      if (value) window.localStorage.setItem(UNSEEN_ONLY_KEY, "1");
      else window.localStorage.removeItem(UNSEEN_ONLY_KEY);
    } catch {
      // Storage unavailable - the toggle still applies on this page.
    }
  }

  function hasLifeList() {
    return state.lifeList.species.size > 0;
  }

  function unseenOnly() {
    return hasLifeList() && els.unseenOnly.checked;
  }

  function isUnseen(species) {
    return hasLifeList() && !BS.isOnLifeList(species, state.lifeList.species);
  }

  function syncLifeList() {
    state.lifeList = readLifeList();
    els.unseenOnlyToggle.hidden = !hasLifeList();
    els.unseenOnlyToggle.title = hasLifeList()
      ? `Compared with the ${state.lifeList.count.toLocaleString()} species on the life list imported in the Trip Planner`
      : "";
  }

  async function apiJson(url, { signal } = {}) {
    const token = storedApiToken();
    const response = await fetch(url, {
      headers: token ? { "x-ebird-api-token": token } : {},
      signal
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
      error.body = body;
      // Only eBird endpoints can fail on the token; a 401/403 from geocoding
      // is the upstream geocoder's, so renderError must not blame the token.
      error.ebird = url.startsWith("/api/ebird/");
      throw error;
    }
    return body;
  }

  // A lighter version of the trip planner's autocomplete, shared by the
  // location and species fields.
  function createAutocomplete({ input, list, icon, fetchItems, itemLabel, itemDetail, limit = 6 }) {
    const ac = { items: [], active: -1, resolved: null, timer: null, controller: null };

    function close() {
      ac.items = [];
      ac.active = -1;
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
    }

    function render() {
      if (!ac.items.length) return close();
      list.innerHTML = ac.items
        .map((item, index) => {
          const detail = itemDetail ? itemDetail(item) : "";
          return `
        <li role="option" data-index="${index}" class="${index === ac.active ? "is-active" : ""}" aria-selected="${index === ac.active}">
          <i data-lucide="${icon}"></i>
          <span class="ac-name">${escapeHtml(itemLabel(item))}</span>${detail ? `
          <span class="ac-meta">${escapeHtml(detail)}</span>` : ""}
        </li>`;
        })
        .join("");
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      renderIcons();
    }

    function pick(index) {
      const item = ac.items[index];
      if (!item) return;
      input.value = itemLabel(item);
      ac.resolved = item;
      close();
    }

    async function load(query) {
      if (ac.controller) ac.controller.abort();
      ac.controller = new AbortController();
      try {
        const matches = await fetchItems(query, ac.controller.signal);
        if (state.busy || input.value.trim() !== query) return;
        ac.items = Array.isArray(matches) ? matches.slice(0, limit) : [];
        ac.active = -1;
        render();
      } catch {
        // Aborted or offline - the field still works via submit-time lookup.
      }
    }

    // Close right away so suggestions for the previous text can't be picked
    // during the debounce.
    input.addEventListener("input", () => {
      ac.resolved = null;
      clearTimeout(ac.timer);
      close();
      const query = input.value.trim();
      if (query.length < 2) return;
      ac.timer = setTimeout(() => load(query), 250);
    });

    input.addEventListener("keydown", (event) => {
      if (list.hidden) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const count = ac.items.length;
        // With nothing highlighted, ArrowDown starts at the first item and
        // ArrowUp at the last.
        if (ac.active < 0) ac.active = event.key === "ArrowDown" ? 0 : count - 1;
        else ac.active = (ac.active + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
        render();
      } else if (event.key === "Enter" && ac.active >= 0) {
        event.preventDefault();
        pick(ac.active);
      } else if (event.key === "Escape") {
        close();
      }
    });

    list.addEventListener("mousedown", (event) => {
      const item = event.target.closest("li[data-index]");
      if (!item) return;
      event.preventDefault();
      pick(Number(item.dataset.index));
    });

    document.addEventListener("click", (event) => {
      if (!input.parentElement.contains(event.target)) close();
    });

    return {
      // The picked suggestion, as long as the field still shows its label.
      resolvedFor(value) {
        return ac.resolved && itemLabel(ac.resolved) === value ? ac.resolved : null;
      },
      cancel() {
        clearTimeout(ac.timer);
        if (ac.controller) ac.controller.abort();
        close();
      }
    };
  }

  const locationAc = createAutocomplete({
    input: els.input,
    list: els.suggestions,
    icon: "map-pin",
    limit: 5,
    fetchItems: (query, signal) => apiJson(`/api/geocode?q=${encodeURIComponent(query)}`, { signal }),
    itemLabel: (item) => item.name
  });

  const speciesAc = createAutocomplete({
    input: els.speciesInput,
    list: els.speciesSuggestions,
    icon: "bird",
    fetchItems: (query, signal) => apiJson(`/api/ebird/taxonomy/search?q=${encodeURIComponent(query)}`, { signal }),
    itemLabel: (item) => item.comName,
    itemDetail: (item) => item.sciName
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
      'Seasonal search needs an eBird API token. <a href="https://ebird.org/api/keygen" target="_blank" rel="noopener">Request a free token</a>, add it in the <a href="./">Trip Planner</a> settings, then search again here.'
    );
  }

  function renderError(error) {
    if (error?.ebird && (error.status === 401 || error.status === 403)) return renderTokenNotice();
    renderMessage("triangle-alert", escapeHtml(error?.message || "Something went wrong. Try again."));
  }

  function formatPercent(rate) {
    return `${Math.round(rate * 100)}%`;
  }

  function monthStripHtml(item, highlightMonths, { large = false } = {}) {
    const cells = BS.MONTH_LABELS.map((label, month) => {
      const rate = item.presence[month] || 0;
      const height = rate > 0 ? Math.max(8, Math.round(rate * 100)) : 0;
      const peak = highlightMonths.includes(month) ? " is-peak" : "";
      const tip = `${label} · reported on ${formatPercent(rate)} of sampled dates`;
      return `<span class="seasonal-month-cell${peak}" data-tip="${escapeHtml(tip)}"><i style="height:${height}%"></i></span>`;
    }).join("");
    if (!large) return `<div class="seasonal-months" aria-hidden="true">${cells}</div>`;
    const labels = BS.MONTH_LABELS.map((label) => `<span>${label.charAt(0)}</span>`).join("");
    return `
      <div class="seasonal-months is-large" aria-hidden="true">${cells}</div>
      <div class="seasonal-month-labels" aria-hidden="true">${labels}</div>`;
  }

  // "2026-09-20 07:15" -> "Sep 20", without Date parsing's timezone shifts.
  function formatObsDate(obsDt) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(obsDt || ""));
    if (!match) return "";
    return `${BS.MONTH_LABELS[Number(match[2]) - 1] || ""} ${Number(match[3])}`.trim();
  }

  function shortPlaceName(place) {
    return String(place?.name || "").split(",")[0].trim() || "this place";
  }

  function recentSightingsHtml(place, observations) {
    const near = `within ${RECENT_RADIUS_KM} km of ${escapeHtml(shortPlaceName(place))}`;
    if (!Array.isArray(observations)) {
      return '<p class="seasonal-recent">Recent nearby reports couldn\'t be loaded.</p>';
    }
    const summary = BS.recentSightingsSummary(observations);
    if (!summary.locationCount) {
      return `<p class="seasonal-recent"><i data-lucide="radar"></i><span>No reports ${near} in the last ${RECENT_DAYS} days.</span></p>`;
    }
    const atLeast = observations.length >= RECENT_MAX_RESULTS ? "at least " : "";
    const places = summary.locationCount === 1 && !atLeast ? "1 location" : `${atLeast}${summary.locationCount} locations`;
    const latest = summary.latest
      ? ` Most recently at <b>${escapeHtml(summary.latest.locName)}</b> on ${escapeHtml(formatObsDate(summary.latest.date))}.`
      : "";
    const others = summary.topLocations.filter((loc) => loc.locName !== summary.latest?.locName);
    const more = summary.locationCount - 1 > others.length ? ", and more" : "";
    const top = others.length
      ? ` Also at ${others.map((loc) => escapeHtml(loc.locName)).join(", ")}${more}.`
      : "";
    return `<p class="seasonal-recent"><i data-lucide="radar"></i><span>Reported at ${places} ${near} in the last ${RECENT_DAYS} days.${latest}${top}</span></p>`;
  }

  function lifeListChipHtml(species, { showSeen = false } = {}) {
    if (!hasLifeList()) return "";
    if (isUnseen(species)) return '<span class="stop-chip chip-lifer">Not on your life list</span>';
    return showSeen ? '<span class="stop-chip chip-seen">On your life list</span>' : "";
  }

  function speciesCardHtml(place, data, lookup) {
    const species = lookup.species;
    const entry = data.species.find((item) => item.speciesCode === species.speciesCode);
    const comName = species.comName || entry?.comName || lookup.query;
    const sciName = species.sciName || entry?.sciName || "";
    const timing = BS.speciesTiming(entry, data.sampledDays);
    const sentence = BS.speciesTimingSentence(timing, comName, data.regionName);
    // The sparse sentence already carries the date counts.
    const rates = timing.status === "sparse"
      ? ""
      : `<p class="seasonal-rates">Reported on <b>${timing.reportedDays}</b> of ${timing.totalSampled} sampled dates in ${escapeHtml(data.year)}. Green months are its peak.</p>`;
    const detail = timing.status === "absent"
      ? ""
      : `${monthStripHtml(timing, timing.peakMonths, { large: true })}${rates}`;
    return `
      <section class="seasonal-species-answer" data-status="${timing.status}">
        <div class="seasonal-species-head">
          <h3>${escapeHtml(comName)}</h3>
          ${sciName ? `<p class="seasonal-sci">${escapeHtml(sciName)}</p>` : ""}
          ${lifeListChipHtml({ speciesCode: species.speciesCode, comName, sciName }, { showSeen: true })}
        </div>
        <p class="seasonal-species-lead">${escapeHtml(sentence)}</p>
        ${detail}
        ${recentSightingsHtml(place, lookup.observations)}
      </section>`;
  }

  function speciesRowHtml(item, seasonMonths, seasonLabel) {
    return `
      <article class="seasonal-species">
        <div class="seasonal-species-head">
          <h4>${escapeHtml(item.comName)}</h4>
          <p class="seasonal-sci">${escapeHtml(item.sciName)}</p>
          ${unseenOnly() ? "" : lifeListChipHtml(item)}
        </div>
        ${monthStripHtml(item, seasonMonths)}
        <p class="seasonal-rates">Reported on <b>${formatPercent(item.seasonRate)}</b> of sampled ${escapeHtml(seasonLabel.toLowerCase())} dates · ${formatPercent(item.offSeasonRate)} the rest of the year</p>
      </article>`;
  }

  function overviewSentence(specialties, seasons) {
    const parts = seasons
      .filter((season) => specialties[season.key].length)
      .map((season) => {
        const names = specialties[season.key].slice(0, 2).map((item) => item.comName);
        return `in ${season.label.toLowerCase()}, look for ${names.join(" and ")}`;
      });
    if (!parts.length) return "";
    const sentence = parts.join("; ");
    return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
  }

  // Counts each bird once, even when it peaks in two seasons.
  function uniqueSpecialties(specialties, seasons) {
    const byCode = new Map();
    for (const season of seasons) {
      for (const item of specialties[season.key]) byCode.set(item.speciesCode, item);
    }
    return [...byCode.values()];
  }

  function lifeListSummaryHtml(specialties, seasons) {
    if (!hasLifeList()) {
      return '<p class="seasonal-life-list-note">Import your life list in the <a href="./">Trip Planner</a> to see which of these birds you haven\'t seen yet.</p>';
    }
    if (unseenOnly()) {
      return '<p class="seasonal-life-list-note">Showing only birds that aren\'t on your life list.</p>';
    }
    const birds = uniqueSpecialties(specialties, seasons);
    if (!birds.length) return "";
    const unseen = birds.filter(isUnseen).length;
    const birdsLabel = `${birds.length} seasonal ${birds.length === 1 ? "bird" : "birds"}`;
    const text = unseen
      ? `<b>${unseen}</b> of these ${birdsLabel} ${unseen === 1 ? "isn't" : "aren't"} on your life list.`
      : "You've seen every seasonal bird shown here.";
    return `<p class="seasonal-life-list-note">${text}</p>`;
  }

  function renderResults(place, data, lookup) {
    state.lastResult = { place, data, lookup };
    const seasons = BS.seasonsForLatitude(place.lat);
    // Filter before ranking, so each season fills its list with unseen birds
    // rather than showing whatever survives from the overall top picks.
    const pool = unseenOnly() ? data.species.filter(isUnseen) : data.species;
    const specialties = BS.seasonalSpecialties(pool, data.sampledDays, { seasons });
    const minSamples = Math.min(...data.sampledDays);
    const maxSamples = Math.max(...data.sampledDays);
    const sampleSummary = minSamples === maxSamples
      ? `${minSamples} days per month`
      : `${minSamples}–${maxSamples} days per month`;
    els.resultContext.textContent =
      `eBird reports from ${data.regionName} · ${data.year}, sampled ${sampleSummary}`;

    const lead = overviewSentence(specialties, seasons);
    const seasonCards = seasons.map((season) => {
      const items = specialties[season.key];
      const body = items.length
        ? items.map((item) => speciesRowHtml(item, season.months, season.label)).join("")
        : unseenOnly()
          ? `<p class="seasonal-none">You've seen every strong ${escapeHtml(season.label.toLowerCase())} specialty here.</p>`
          : '<p class="seasonal-none">No strong specialties stood out for this season.</p>';
      return `
        <section class="seasonal-season">
          <header class="seasonal-season-header">
            <i data-lucide="${SEASON_ICONS[season.key]}"></i>
            <h3>${season.label}</h3>
            <span>${season.hint}</span>
          </header>
          ${body}
        </section>`;
    }).join("");

    els.results.innerHTML = `${lookup ? speciesCardHtml(place, data, lookup) : ""}
      <div class="seasonal-overview">
        <span>${escapeHtml(place.name)}</span>
        ${lead ? `<h3>${escapeHtml(lead)}</h3>` : `<h3>${unseenOnly() ? "No unseen birds stood out strongly in any season here." : "No season stood out strongly here."}</h3>`}
        ${lifeListSummaryHtml(specialties, seasons)}
        <p>Bars show the share of sampled dates with at least one report, January through December; green months belong to that card's season. This day-level occurrence is not complete-checklist frequency.</p>
      </div>
      <div class="seasonal-grid">${seasonCards}</div>`;
    renderIcons();
  }

  // One shared tooltip for the month bars, driven by event delegation.
  els.results.addEventListener("pointerover", (event) => {
    const cell = event.target.closest(".seasonal-month-cell");
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
    if (event.target.closest(".seasonal-month-cell")) els.tooltip.hidden = true;
  });

  // An empty query clears the remembered place, so a failed search can't
  // leave the previous location in the share URL or reload state.
  function persist(query, species = "") {
    try {
      if (query) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: query, species }));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable - the search still works, it just isn't remembered.
    }
    const url = new URL(window.location.href);
    url.search = "";
    if (query) url.searchParams.set("q", query);
    if (query && species) url.searchParams.set("species", species);
    window.history.replaceState(null, "", url);
  }

  // A shared link wins outright: its place comes with its own species (or
  // none), never with the species remembered from an earlier search.
  function initialQuery() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("q");
    if (fromUrl && fromUrl.trim()) {
      return { q: fromUrl.trim(), species: (params.get("species") || "").trim() };
    }
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      return {
        q: typeof stored?.q === "string" ? stored.q.trim() : "",
        species: typeof stored?.species === "string" ? stored.species.trim() : ""
      };
    } catch {
      return { q: "", species: "" };
    }
  }

  // Mirrors the server's resolveSpecies: an exact common or scientific name,
  // else a prefix that matches exactly one species.
  async function resolveSpeciesName(query) {
    const matches = await apiJson(`/api/ebird/taxonomy/search?q=${encodeURIComponent(query)}`).catch(() => null);
    if (!Array.isArray(matches)) return null;
    const norm = query.toLowerCase();
    const exact = matches.find((item) => item.comName.toLowerCase() === norm || String(item.sciName || "").toLowerCase() === norm);
    if (exact) return exact;
    const starts = matches.filter((item) => item.comName.toLowerCase().startsWith(norm)
      || String(item.sciName || "").toLowerCase().startsWith(norm));
    return starts.length === 1 ? starts[0] : null;
  }

  // Resolves the species field and fetches its recent nearby reports in one
  // call. An unknown name fails the search. If only the recent reports fail,
  // the seasonal answer still renders without them - but only once the
  // species itself is known, so a lookup outage never reads as an absence.
  async function lookupSpecies(place, query, picked) {
    const params = new URLSearchParams({
      lat: String(place.lat),
      lng: String(place.lng),
      dist: String(RECENT_RADIUS_KM),
      back: String(RECENT_DAYS),
      maxResults: String(RECENT_MAX_RESULTS)
    });
    if (picked) params.set("speciesCode", picked.speciesCode);
    else params.set("name", query);
    try {
      const body = await apiJson(`/api/ebird/species?${params}`);
      return {
        query,
        species: body?.species || picked || { speciesCode: body?.speciesCode, comName: query, sciName: "" },
        observations: Array.isArray(body?.observations) ? body.observations : []
      };
    } catch (error) {
      if (error.status === 401 || error.status === 403) throw error;
      if (error.status === 404 && !picked) {
        const suggestions = (error.body?.suggestions || []).slice(0, 4).map((item) => item.comName);
        const hint = suggestions.length ? ` Try ${suggestions.join(", ")}.` : "";
        const noMatch = new Error(`No eBird species matched "${query}".${hint}`);
        noMatch.status = 404;
        throw noMatch;
      }
      const species = picked || await resolveSpeciesName(query);
      if (!species) {
        throw new Error(`Couldn't look up "${query}" right now. Pick it from the suggestions or try again.`);
      }
      return { query, species, observations: null };
    }
  }

  async function runSearch() {
    if (state.busy) return;
    const query = els.input.value.trim();
    const speciesQuery = els.speciesInput.value.trim();
    if (query.length < 2) {
      setStatus("Enter a location to search.");
      return;
    }
    state.busy = true;
    state.lastResult = null;
    els.submit.disabled = true;
    const picked = speciesAc.resolvedFor(speciesQuery);
    const resolvedPlace = locationAc.resolvedFor(query);
    locationAc.cancel();
    speciesAc.cancel();
    try {
      persist("");
      setStatus("Finding location…");
      let place = resolvedPlace;
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
      const [data, lookup] = await Promise.all([
        apiJson(`/api/ebird/seasonality?lat=${encodeURIComponent(place.lat)}&lng=${encodeURIComponent(place.lng)}`),
        speciesQuery ? lookupSpecies(place, speciesQuery, picked) : null
      ]);
      // Show the canonical eBird name, and remember it rather than a partial
      // entry. The share URL follows the rendered result, but a field the user
      // edited mid-search keeps their edit for the next submit.
      const speciesName = lookup ? lookup.species.comName || speciesQuery : "";
      if (speciesName && els.speciesInput.value.trim() === speciesQuery) els.speciesInput.value = speciesName;
      renderResults(place, data, lookup);
      persist(query, speciesName);
      setStatus("");
    } catch (error) {
      renderError(error);
      setStatus("");
    } finally {
      state.busy = false;
      els.submit.disabled = false;
    }
  }

  function rerenderLastResult() {
    if (!state.lastResult || state.busy) return;
    const { place, data, lookup } = state.lastResult;
    renderResults(place, data, lookup);
  }

  els.unseenOnly.addEventListener("change", () => {
    saveUnseenOnly(els.unseenOnly.checked);
    rerenderLastResult();
  });

  // Importing or clearing the life list in a planner tab updates this page.
  window.addEventListener("storage", (event) => {
    if (event.key !== PREFS_KEY && event.key !== null) return;
    syncLifeList();
    rerenderLastResult();
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
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
      setStatus(window.location.href, { expanded: true });
    }
  });

  async function init() {
    els.unseenOnly.checked = readUnseenOnly();
    syncLifeList();
    renderIcons();
    try {
      const response = await fetch("/api/config");
      const config = response.ok ? await response.json() : null;
      state.ebirdConfigured = Boolean(config?.ebirdConfigured);
    } catch {
      state.ebirdConfigured = false;
    }
    const initial = initialQuery();
    if (initial.q) els.input.value = initial.q;
    if (initial.q && initial.species) els.speciesInput.value = initial.species;
    if (!storedApiToken() && !state.ebirdConfigured) {
      renderTokenNotice();
      return;
    }
    if (initial.q) runSearch();
  }

  init();
})();
