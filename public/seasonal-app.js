(function () {
  const BS = window.BirdtripSeasonal;
  const STORAGE_KEY = "birdtripSeasonalView";
  const PREFS_KEY = "routeBirdingPrefs";
  const SESSION_TOKEN_KEY = "birdtripEbirdApiToken";
  const SEASON_ICONS = { winter: "snowflake", spring: "flower-2", summer: "sun", fall: "leaf" };

  const els = {
    form: document.querySelector("#seasonalForm"),
    input: document.querySelector("#seasonalLocation"),
    suggestions: document.querySelector("#seasonalSuggestions"),
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

  // Location autocomplete: a lighter version of the trip planner's origin field.
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

  function monthStripHtml(item, seasonMonths) {
    const cells = BS.MONTH_LABELS.map((label, month) => {
      const rate = item.presence[month] || 0;
      const height = rate > 0 ? Math.max(8, Math.round(rate * 100)) : 0;
      const peak = seasonMonths.includes(month) ? " is-peak" : "";
      const tip = `${label} · reported on ${formatPercent(rate)} of sampled dates`;
      return `<span class="seasonal-month-cell${peak}" data-tip="${escapeHtml(tip)}"><i style="height:${height}%"></i></span>`;
    }).join("");
    return `<div class="seasonal-months" aria-hidden="true">${cells}</div>`;
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

  function renderResults(place, data) {
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

    els.results.innerHTML = `
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

  function persist(query) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: query }));
    } catch {
      // Storage unavailable - the search still works, it just isn't remembered.
    }
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("q", query);
    window.history.replaceState(null, "", url);
  }

  function initialQuery() {
    const fromUrl = new URLSearchParams(window.location.search).get("q");
    if (fromUrl && fromUrl.trim()) return fromUrl.trim();
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      return stored && typeof stored.q === "string" ? stored.q.trim() : "";
    } catch {
      return "";
    }
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
      renderResults(place, data);
      persist(query);
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
    const query = initialQuery();
    if (query) els.input.value = query;
    if (!storedApiToken() && !state.ebirdConfigured) {
      renderTokenNotice();
      return;
    }
    if (query) runSearch();
  }

  init();
})();
