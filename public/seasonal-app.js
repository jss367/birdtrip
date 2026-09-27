(function () {
  const BS = window.BirdtripSeasonal;
  const STORAGE_KEY = "birdtripSeasonalView";
  const PREFS_KEY = "routeBirdingPrefs";
  const SESSION_TOKEN_KEY = "birdtripEbirdApiToken";
  const SEASON_ICONS = { winter: "snowflake", spring: "flower-2", summer: "sun", fall: "leaf" };
  const RECENT_RADIUS_KM = 25;
  const RECENT_DAYS = 30;

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
    tooltip: document.querySelector("#seasonalTooltip")
  };

  const state = {
    busy: false,
    ebirdConfigured: null
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
        const step = event.key === "ArrowDown" ? 1 : -1;
        ac.active = (ac.active + step + ac.items.length) % ac.items.length;
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
    if (error && (error.status === 401 || error.status === 403)) return renderTokenNotice();
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
    const places = summary.locationCount === 1 ? "1 location" : `${summary.locationCount} locations`;
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

  function renderResults(place, data, lookup) {
    const seasons = BS.seasonsForLatitude(place.lat);
    const specialties = BS.seasonalSpecialties(data.species, data.sampledDays, { seasons });
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
        ${lead ? `<h3>${escapeHtml(lead)}</h3>` : "<h3>No season stood out strongly here.</h3>"}
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
      back: String(RECENT_DAYS)
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
