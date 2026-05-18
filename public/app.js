const state = {
  map: null,
  routeLayer: null,
  markerLayer: null,
  route: null,
  routeName: "",
  results: [],
  selectedId: null,
  warnings: [],
  params: null,
  origin: null,
  destination: null
};

const els = {
  quickStartButton: document.querySelector("#quickStartButton"),
  settingsButton: document.querySelector("#settingsButton"),
  setupStatus: document.querySelector("#setupStatus"),
  form: document.querySelector("#searchForm"),
  origin: document.querySelector("#origin"),
  destination: document.querySelector("#destination"),
  maxDetour: document.querySelector("#maxDetour"),
  recentDays: document.querySelector("#recentDays"),
  radiusKm: document.querySelector("#radiusKm"),
  maxStops: document.querySelector("#maxStops"),
  apiToken: document.querySelector("#apiToken"),
  rememberToken: document.querySelector("#rememberToken"),
  targets: document.querySelector("#targets"),
  originError: document.querySelector("#originError"),
  destinationError: document.querySelector("#destinationError"),
  warningPanel: document.querySelector("#warningPanel"),
  warningMessage: document.querySelector("#warningMessage"),
  report: document.querySelector("#report"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  printButton: document.querySelector("#printButton"),
  progressTitle: document.querySelector("#progressTitle"),
  progressMessage: document.querySelector("#progressMessage"),
  targetCount: document.querySelector("#targetCount"),
  notableCount: document.querySelector("#notableCount"),
  hotspotCount: document.querySelector("#hotspotCount"),
  routeDistance: document.querySelector("#routeDistance"),
  maxAdded: document.querySelector("#maxAdded"),
  candidateCount: document.querySelector("#candidateCount"),
  resultContext: document.querySelector("#resultContext"),
  tripPlanSummary: document.querySelector("#tripPlanSummary"),
  targetSpeciesSummary: document.querySelector("#targetSpeciesSummary"),
  sightingSummary: document.querySelector("#sightingSummary"),
  resultsList: document.querySelector("#resultsList"),
  resultTemplate: document.querySelector("#resultTemplate"),
  detailsPanel: document.querySelector("#detailsPanel"),
  detailsContent: document.querySelector("#detailsContent"),
  closeDetails: document.querySelector("#closeDetails"),
  quickStartModal: document.querySelector("#quickStartModal"),
  closeQuickStart: document.querySelector("#closeQuickStart"),
  modalSampleButton: document.querySelector("#modalSampleButton"),
  modalExploreButton: document.querySelector("#modalExploreButton")
};

const PREF_FIELDS = ["origin", "destination", "maxDetour", "recentDays", "radiusKm", "maxStops", "targets"];

init();

function init() {
  restorePreferences();
  updateSetupStatus();
  updateInputSummaries();
  state.map = L.map("map", { zoomControl: true }).setView([33.45, -112.07], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(state.map);
  state.markerLayer = L.layerGroup().addTo(state.map);

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });
  els.sampleButton.addEventListener("click", useSampleRoute);
  els.clearButton.addEventListener("click", clearResults);
  // Revoke or grant token persistence the moment the choice changes,
  // not only on the next search submit.
  els.rememberToken.addEventListener("change", savePreferences);
  els.apiToken.addEventListener("change", () => {
    if (els.rememberToken.checked) savePreferences();
    updateSetupStatus();
  });
  els.apiToken.addEventListener("input", updateSetupStatus);
  els.targets.addEventListener("input", updateInputSummaries);
  els.maxDetour.addEventListener("input", updateInputSummaries);
  els.quickStartButton.addEventListener("click", openQuickStart);
  els.settingsButton.addEventListener("click", () => {
    els.maxDetour.scrollIntoView({ block: "center", behavior: "smooth" });
    els.maxDetour.focus();
  });
  els.closeQuickStart.addEventListener("click", closeQuickStart);
  els.quickStartModal.addEventListener("click", (event) => {
    if (event.target === els.quickStartModal) closeQuickStart();
  });
  els.modalSampleButton.addEventListener("click", () => {
    useSampleRoute();
    closeQuickStart();
    els.origin.focus();
  });
  els.modalExploreButton.addEventListener("click", () => {
    setStatus("Explore without setup", "Enter a route to preview distance and drive time. Add an eBird token when you want live bird rankings.");
    closeQuickStart();
    els.origin.focus();
  });
  els.printButton.addEventListener("click", () => {
    renderReport();
    window.print();
  });
  window.addEventListener("beforeprint", renderReport);
  els.closeDetails.addEventListener("click", () => {
    els.detailsPanel.hidden = true;
    state.selectedId = null;
    updateSelectedCard();
    renderMarkers();
  });

  if (window.lucide) window.lucide.createIcons();
}

function restorePreferences() {
  let saved = {};
  try {
    const parsed = JSON.parse(localStorage.getItem("routeBirdingPrefs") || "{}");
    if (parsed && typeof parsed === "object") saved = parsed;
  } catch {
    localStorage.removeItem("routeBirdingPrefs");
  }
  for (const field of PREF_FIELDS) {
    if (typeof saved[field] === "string") els[field].value = saved[field];
  }
  els.rememberToken.checked = saved.rememberToken === true;
  // The token is only ever restored when the user previously opted in.
  if (saved.rememberToken === true && typeof saved.apiToken === "string") {
    els.apiToken.value = saved.apiToken;
  }
}

function savePreferences() {
  const payload = {};
  for (const field of PREF_FIELDS) payload[field] = els[field].value;
  const remember = els.rememberToken.checked;
  payload.rememberToken = remember;
  if (remember) payload.apiToken = els.apiToken.value;
  localStorage.setItem("routeBirdingPrefs", JSON.stringify(payload));
}

function useSampleRoute() {
  els.origin.value = "Yuma, AZ";
  els.destination.value = "Phoenix, AZ";
  els.maxDetour.value = "60";
  els.recentDays.value = "14";
  els.radiusKm.value = "25";
  els.maxStops.value = "10";
  els.targets.value = "Gilded Flicker\nAbert's Towhee\nRosy-faced Lovebird\nBendire's Thrasher";
  updateInputSummaries();
}

function clearResults() {
  state.results = [];
  state.route = null;
  state.selectedId = null;
  state.params = null;
  state.warnings = [];
  if (state.routeLayer) state.map.removeLayer(state.routeLayer);
  state.markerLayer.clearLayers();
  clearFieldErrors();
  clearWarning();
  els.report.innerHTML = "";
  els.resultsList.className = "results-list empty";
  els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="binoculars"></i><p>Results will appear here after the first search.</p></div>';
  els.resultContext.textContent = "No route searched yet.";
  els.routeDistance.textContent = "-";
  els.notableCount.textContent = "-";
  els.hotspotCount.textContent = "-";
  els.candidateCount.textContent = "-";
  updateInputSummaries();
  renderInsights();
  els.detailsPanel.hidden = true;
  setStatus("Ready", "Enter a route and run a search.");
  if (window.lucide) window.lucide.createIcons();
}

async function runSearch() {
  savePreferences();
  const params = readParams();
  setBusy(true);
  clearSearchArtifacts();
  state.params = params;

  try {
    setStatus("Geocoding", "Resolving origin and destination.");
    const [originResult, destinationResult] = await Promise.allSettled([
      geocodeField("origin", params.origin),
      geocodeField("destination", params.destination)
    ]);
    if (originResult.status === "rejected") throw originResult.reason;
    if (destinationResult.status === "rejected") throw destinationResult.reason;
    const origin = originResult.value;
    const destination = destinationResult.value;
    state.origin = origin;
    state.destination = destination;
    state.routeName = `${shortName(origin.name)} to ${shortName(destination.name)}`;

    setStatus("Routing", "Drawing the direct route.");
    const route = await apiJson(routeUrl("/api/route", origin, destination));
    state.route = { ...route, origin, destination };
    renderRoute(route.geometry.coordinates);
    updateRouteSummary(route);

    if (!params.token) {
      setStatus("Token needed", "Route loaded. Add an eBird API token to rank live birding stops.");
      els.resultContext.textContent = "Route loaded, but live bird data needs an eBird token.";
      els.resultsList.className = "results-list empty";
      els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="feather"></i><p>Add an eBird API token to rank live birding stops.</p></div>';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    setStatus("Scanning route", "Sampling points along the drive and requesting recent eBird observations.");
    const samples = sampleRoute(route.geometry.coordinates, route.distanceMeters, 14);
    const observationsBySample = await fetchRecentForSamples(samples, params);
    const candidates = buildCandidates(observationsBySample, samples, params);

    if (!candidates.length) {
      setStatus("No candidates", "No hotspot observations were found. Try a wider radius or longer recent window.");
      els.resultContext.textContent = "No birding locations matched the current route settings.";
      renderWarnings();
      return;
    }

    setStatus("Checking detours", `Evaluating route impact for ${Math.min(candidates.length, params.maxStops * 3)} candidate stops.`);
    const practical = await evaluateDetours(candidates, origin, destination, route.durationSeconds, params);

    if (!practical.length) {
      setStatus("No stops within budget", "Try increasing the maximum added time or route radius.");
      els.resultContext.textContent = "Candidate birding locations were outside the detour budget.";
      renderWarnings();
      return;
    }

    setStatus("Adding notable birds", "Checking recent notable reports for the strongest candidates.");
    await addNotableObservations(practical, params);
    scoreCandidates(practical, params);

    state.results = practical
      .filter((candidate) => candidate.addedMinutes <= params.maxDetour)
      .sort((a, b) => b.score - a.score)
      .slice(0, params.maxStops);

    renderResults();
    renderMarkers();
    renderReport();
    renderWarnings();
    setStatus("Complete", `Found ${state.results.length} stops within the detour budget.`);
  } catch (error) {
    setStatus("Search failed", error.message || "Something went wrong.");
    console.error(error);
  } finally {
    setBusy(false);
  }
}

function readParams() {
  return {
    origin: els.origin.value.trim(),
    destination: els.destination.value.trim(),
    maxDetour: clamp(Number(els.maxDetour.value || 60), 0, 240),
    recentDays: clamp(Number(els.recentDays.value || 14), 1, 30),
    radiusKm: clamp(Number(els.radiusKm.value || 25), 1, 50),
    maxStops: clamp(Number(els.maxStops.value || 10), 3, 20),
    token: els.apiToken.value.trim(),
    targets: els.targets.value
      .split(/\n|,/)
      .map((target) => normalizeName(target))
      .filter(Boolean)
  };
}

function openQuickStart() {
  els.quickStartModal.hidden = false;
  if (window.lucide) window.lucide.createIcons();
  els.closeQuickStart.focus();
}

function closeQuickStart() {
  els.quickStartModal.hidden = true;
  els.quickStartButton.focus();
}

function updateSetupStatus() {
  const hasToken = Boolean(els.apiToken.value.trim());
  els.setupStatus.classList.toggle("setup-ready", hasToken);
  els.setupStatus.classList.toggle("setup-needed", !hasToken);
  els.setupStatus.innerHTML = hasToken
    ? '<i data-lucide="check-circle-2"></i>Ready to Search'
    : '<i data-lucide="circle-alert"></i>Setup Required';
  renderInsights();
  if (window.lucide) window.lucide.createIcons();
}

function updateInputSummaries() {
  const targets = parseTargetsInput();
  els.targetCount.textContent = String(targets.length);
  els.maxAdded.textContent = `${clamp(Number(els.maxDetour.value || 60), 0, 240)}m`;
  renderInsights();
}

function parseTargetsInput() {
  return els.targets.value
    .split(/\n|,/)
    .map((target) => normalizeName(target))
    .filter(Boolean);
}

function clearSearchArtifacts() {
  state.results = [];
  state.selectedId = null;
  state.warnings = [];
  state.route = null;
  state.routeName = "";
  state.origin = null;
  state.destination = null;
  clearFieldErrors();
  clearWarning();
  els.report.innerHTML = "";
  els.detailsPanel.hidden = true;
  state.markerLayer.clearLayers();
  if (state.routeLayer) {
    state.map.removeLayer(state.routeLayer);
    state.routeLayer = null;
  }
  els.resultsList.className = "results-list empty";
  els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="loader"></i><p>Searching route corridor...</p></div>';
  els.notableCount.textContent = "-";
  els.hotspotCount.textContent = "-";
  els.candidateCount.textContent = "-";
  renderInsights();
  if (window.lucide) window.lucide.createIcons();
}

function setBusy(isBusy) {
  const controls = [
    ...els.form.querySelectorAll("button, input, textarea"),
    els.quickStartButton,
    els.settingsButton,
    els.modalSampleButton,
    els.modalExploreButton
  ];

  controls.forEach((control) => {
    if (control.dataset.staticDisabled === "true") {
      control.disabled = true;
      return;
    }
    control.disabled = isBusy;
  });
}

function setStatus(title, message) {
  els.progressTitle.textContent = title;
  els.progressMessage.textContent = message;
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      ...(options.token ? { "x-ebird-api-token": options.token } : {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const base = payload.error || response.statusText || "Request failed";
    const detail = detailText(payload.details);
    const error = new Error(detail ? `${base} — ${detail}` : base);
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }
  return payload;
}

function detailText(details) {
  if (!details) return "";
  if (typeof details === "string") return truncate(details, 240);
  if (typeof details === "object") {
    if (typeof details.message === "string" && details.message) return truncate(details.message, 240);
    if (typeof details.code === "string" && details.code) return details.code;
    try {
      return truncate(JSON.stringify(details), 240);
    } catch {
      return "";
    }
  }
  return truncate(String(details), 240);
}

function truncate(value, max) {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function geocodeField(field, query) {
  let matches;
  try {
    matches = await apiJson(`/api/geocode?q=${encodeURIComponent(query)}`);
  } catch (error) {
    setFieldError(field, `Lookup failed: ${error.message}`);
    throw new Error(`${field === "origin" ? "Origin" : "Destination"} lookup failed`);
  }
  if (!matches.length) {
    setFieldError(field, `No match for "${query}". Try a more specific place or "City, ST".`);
    throw new Error(`Could not geocode ${field}: ${query}`);
  }
  return matches[0];
}

function setFieldError(field, message) {
  const errorEl = els[`${field}Error`];
  const inputEl = els[field];
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
  errorEl.setAttribute("role", "alert");
  if (inputEl) {
    inputEl.setAttribute("aria-invalid", "true");
    inputEl.setAttribute("aria-describedby", `${field}Error`);
  }
}

function clearFieldErrors() {
  for (const field of ["origin", "destination"]) {
    const errorEl = els[`${field}Error`];
    const inputEl = els[field];
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
    if (inputEl) {
      inputEl.removeAttribute("aria-invalid");
      inputEl.removeAttribute("aria-describedby");
    }
  }
}

function addWarning(message) {
  if (message && !state.warnings.includes(message)) state.warnings.push(message);
}

function renderWarnings() {
  if (!state.warnings.length) return clearWarning();
  els.warningMessage.textContent = state.warnings.join(" ");
  els.warningPanel.hidden = false;
}

function clearWarning() {
  els.warningMessage.textContent = "";
  els.warningPanel.hidden = true;
}

function routeUrl(path, origin, destination, via) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("origin", `${origin.lng},${origin.lat}`);
  url.searchParams.set("destination", `${destination.lng},${destination.lat}`);
  if (via) url.searchParams.set("via", `${via.lng},${via.lat}`);
  return `${url.pathname}${url.search}`;
}

function renderRoute(coordinates) {
  const latLngs = coordinates.map(([lng, lat]) => [lat, lng]);
  state.routeLayer = L.polyline(latLngs, {
    color: "#3b82f6",
    weight: 5,
    opacity: 0.86
  }).addTo(state.map);
  state.map.fitBounds(state.routeLayer.getBounds(), { padding: [34, 34] });
}

function updateRouteSummary(route) {
  els.routeDistance.textContent = miles(route.distanceMeters).toFixed(0);
  renderInsights();
}

function sampleRoute(coordinates, routeMeters, maxSamples) {
  if (coordinates.length <= maxSamples) {
    return coordinates.map(([lng, lat], index) => ({ lng, lat, index }));
  }

  const segments = [];
  let cumulative = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    const distance = haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }) * 1000;
    cumulative += distance;
    segments.push({ start: coordinates[i - 1], end: coordinates[i], distance, cumulative });
  }

  const samples = [];
  const usable = Math.max(2, maxSamples);
  for (let i = 0; i < usable; i += 1) {
    const target = (routeMeters * i) / (usable - 1);
    const segment = segments.find((item) => item.cumulative >= target) || segments[segments.length - 1];
    const previous = segment.cumulative - segment.distance;
    const ratio = segment.distance ? (target - previous) / segment.distance : 0;
    const lng = segment.start[0] + (segment.end[0] - segment.start[0]) * ratio;
    const lat = segment.start[1] + (segment.end[1] - segment.start[1]) * ratio;
    samples.push({ lng, lat, index: i });
  }
  return samples;
}

async function fetchRecentForSamples(samples, params) {
  const chunks = [];
  for (let i = 0; i < samples.length; i += 4) chunks.push(samples.slice(i, i + 4));

  const all = [];
  for (let i = 0; i < chunks.length; i += 1) {
    setStatus("Scanning route", `Requesting recent observations ${i * 4 + 1}-${Math.min((i + 1) * 4, samples.length)} of ${samples.length}.`);
    const batch = await Promise.all(chunks[i].map((sample) => {
      const url = `/api/ebird/recent?lat=${sample.lat}&lng=${sample.lng}&dist=${params.radiusKm}&back=${params.recentDays}&maxResults=500`;
      return apiJson(url, { token: params.token })
        .then((observations) => ({ sample, observations }))
        .catch((error) => ({ sample, observations: [], error }));
    }));
    all.push(...batch);
  }
  const failed = all.filter((entry) => entry.error).length;
  if (failed) {
    addWarning(`${failed} of ${all.length} recent-observation requests failed; ranking uses the data that loaded.`);
  }
  return all;
}

function buildCandidates(observationsBySample, samples, params) {
  const byKey = new Map();

  for (const { sample, observations } of observationsBySample) {
    for (const obs of observations) {
      if (!Number.isFinite(obs.lat) || !Number.isFinite(obs.lng)) continue;
      const key = obs.locId || `${obs.lat.toFixed(3)},${obs.lng.toFixed(3)}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          id: key,
          locId: obs.locId || "",
          name: obs.locName || "Unnamed birding location",
          lat: obs.lat,
          lng: obs.lng,
          observations: [],
          seen: new Set(),
          species: new Map(),
          notable: [],
          nearestSample: sample,
          routeDistanceKm: Infinity,
          targetMatches: []
        });
      }
      const candidate = byKey.get(key);
      const obsKey = obs.subId && obs.speciesCode
        ? `${obs.subId}|${obs.speciesCode}`
        : `${normalizeName(obs.comName || obs.sciName)}|${obs.obsDt || ""}|${obs.howMany ?? ""}`;
      if (candidate.seen.has(obsKey)) continue;
      candidate.seen.add(obsKey);
      candidate.observations.push(obs);
      const speciesKey = normalizeName(obs.comName || obs.sciName || "Unknown species");
      if (speciesKey && !candidate.species.has(speciesKey)) {
        candidate.species.set(speciesKey, obs);
      }
    }
  }

  const candidates = Array.from(byKey.values());
  for (const candidate of candidates) {
    for (const sample of samples) {
      const distance = haversineKm(candidate, sample);
      if (distance < candidate.routeDistanceKm) {
        candidate.routeDistanceKm = distance;
        candidate.nearestSample = sample;
      }
    }
    candidate.targetMatches = params.targets
      .map((target) => candidate.species.get(target))
      .filter(Boolean);
  }

  return candidates
    .filter((candidate) => candidate.species.size > 0)
    .sort((a, b) => preliminaryScore(b) - preliminaryScore(a))
    .slice(0, Math.max(params.maxStops * 3, params.maxStops));
}

function preliminaryScore(candidate) {
  return candidate.species.size * 4 + candidate.observations.length + Math.max(0, 20 - candidate.routeDistanceKm);
}

async function evaluateDetours(candidates, origin, destination, baseDurationSeconds, params) {
  const practical = [];
  let failed = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    setStatus("Checking detours", `Evaluating ${i + 1} of ${candidates.length}: ${candidate.name}`);
    try {
      const viaRoute = await apiJson(routeUrl("/api/route-via", origin, destination, candidate));
      candidate.viaRoute = viaRoute;
      candidate.addedMinutes = Math.max(0, (viaRoute.durationSeconds - baseDurationSeconds) / 60);
      candidate.addedMiles = Math.max(0, miles(viaRoute.distanceMeters - state.route.distanceMeters));
      if (candidate.addedMinutes <= params.maxDetour) practical.push(candidate);
    } catch (error) {
      candidate.routeError = error.message;
      failed += 1;
    }
  }
  if (failed) {
    addWarning(`${failed} of ${candidates.length} detour estimates failed and those stops were skipped.`);
  }
  return practical;
}

async function addNotableObservations(candidates, params) {
  const top = candidates.slice(0, Math.max(params.maxStops, 6));
  let failed = 0;
  for (let i = 0; i < top.length; i += 1) {
    const candidate = top[i];
    setStatus("Adding notable birds", `Checking notable reports ${i + 1} of ${top.length}.`);
    try {
      candidate.notable = await apiJson(
        `/api/ebird/notable?lat=${candidate.lat}&lng=${candidate.lng}&dist=${Math.min(params.radiusKm, 10)}&back=${params.recentDays}&maxResults=100`,
        { token: params.token }
      );
    } catch {
      candidate.notable = [];
      failed += 1;
    }
  }
  if (failed) {
    addWarning(`${failed} of ${top.length} notable-report lookups failed; notable counts may be understated.`);
  }
}

function scoreCandidates(candidates, params) {
  for (const candidate of candidates) {
    const uniqueNotable = new Set(candidate.notable.map((obs) => normalizeName(obs.comName))).size;
    const speciesScore = Math.min(candidate.species.size, 90) / 90 * 45;
    const activityScore = Math.min(candidate.observations.length, 250) / 250 * 15;
    const notableScore = Math.min(uniqueNotable, 8) / 8 * 20;
    const targetScore = Math.min(candidate.targetMatches.length, 5) / 5 * 15;
    const practicalityScore = params.maxDetour === 0
      ? 20
      : Math.max(0, 20 * (1 - candidate.addedMinutes / Math.max(params.maxDetour, 1)));
    candidate.scoreParts = {
      species: speciesScore,
      activity: activityScore,
      notable: notableScore,
      targets: targetScore,
      practicality: practicalityScore
    };
    candidate.score = Math.round(speciesScore + activityScore + notableScore + targetScore + practicalityScore);
  }
}

function renderResults() {
  els.candidateCount.textContent = String(state.results.length);
  els.hotspotCount.textContent = String(state.results.filter(isHotspot).length);
  els.notableCount.textContent = String(state.results.reduce((sum, candidate) => sum + uniqueNotableCount(candidate), 0));
  els.resultContext.textContent = `${state.routeName}; ${state.results.length} stops within budget.`;
  renderInsights();
  els.resultsList.className = "results-list";
  els.resultsList.innerHTML = "";

  if (!state.results.length) {
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="search-x"></i><p>No stops matched the current constraints.</p></div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  state.results.forEach((candidate, index) => {
    const node = els.resultTemplate.content.cloneNode(true);
    const card = node.querySelector(".stop-card");
    card.dataset.id = candidate.id;
    if (candidate.id === state.selectedId) card.classList.add("is-selected");
    node.querySelector(".rank").textContent = String(index + 1);
    node.querySelector(".stop-name").textContent = candidate.name;
    node.querySelector(".stop-preview").textContent = speciesPreview(candidate);
    node.querySelector(".stop-chips").innerHTML = candidateChips(candidate);
    node.querySelector(".score-pill").textContent = candidate.score;
    node.querySelector(".metric-detour").textContent = `+${Math.round(candidate.addedMinutes)}m`;
    node.querySelector(".metric-offroute").textContent = `${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi`;
    node.querySelector(".metric-species").textContent = candidate.species.size;
    node.querySelector(".metric-notable").textContent = uniqueNotableCount(candidate);
    node.querySelector(".metric-targets").textContent = candidate.targetMatches.length;
    const links = candidateLinks(candidate);
    const dir = node.querySelector(".stop-dir");
    const ebird = node.querySelector(".stop-ebird");
    dir.href = links.mapsUrl;
    ebird.href = links.ebirdUrl;
    dir.setAttribute("aria-label", `Directions to ${candidate.name}`);
    ebird.setAttribute("aria-label", `${candidate.name} on eBird`);
    const mainButton = node.querySelector(".stop-main");
    mainButton.setAttribute("aria-label", `View ${candidate.name}`);
    mainButton.addEventListener("click", () => selectCandidate(candidate.id));
    els.resultsList.appendChild(node);
  });

  if (window.lucide) window.lucide.createIcons();
}

function renderMarkers() {
  state.markerLayer.clearLayers();
  state.results.forEach((candidate, index) => {
    const marker = L.marker([candidate.lat, candidate.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="bird-marker ${markerClass(candidate)} ${candidate.id === state.selectedId ? "marker-selected" : ""}">${index + 1}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    });
    marker.bindPopup(`<strong>${escapeHtml(candidate.name)}</strong><br>${candidate.score} score; +${Math.round(candidate.addedMinutes)} min<br>${candidate.species.size} recent species`);
    marker.on("click", () => selectCandidate(candidate.id));
    marker.addTo(state.markerLayer);
  });
}

function selectCandidate(id) {
  const candidate = state.results.find((item) => item.id === id);
  if (!candidate) return;
  state.selectedId = id;
  renderDetails(candidate);
  els.detailsPanel.hidden = false;
  updateSelectedCard();
  renderMarkers();
  state.map.flyTo([candidate.lat, candidate.lng], Math.max(state.map.getZoom(), 11), { duration: 0.6 });
}

function renderDetails(candidate) {
  const species = groupSpecies(candidate).slice(0, 80);
  const notable = candidate.notable.slice(0, 20);
  const links = candidateLinks(candidate);
  const offRouteMi = formatMiles(kmToMiles(candidate.routeDistanceKm));

  els.detailsContent.innerHTML = `
    <h3>${escapeHtml(candidate.name)}</h3>
    <p class="detail-subtitle">${candidate.score} score; +${Math.round(candidate.addedMinutes)} min and +${candidate.addedMiles.toFixed(1)} mi detour.</p>
    <div class="detail-grid">
      <div><b>${candidate.species.size}</b><small>recent species</small></div>
      <div><b>${candidate.observations.length}</b><small>records</small></div>
      <div><b>${uniqueNotableCount(candidate)}</b><small>notable species</small></div>
      <div><b>${candidate.targetMatches.length}</b><small>target matches</small></div>
    </div>
    <section class="score-line">
      <h4>Route impact</h4>
      <div class="impact-list">
        <div class="impact-row"><span>Added time</span><b>+${Math.round(candidate.addedMinutes)} min</b></div>
        <div class="impact-row"><span>Added distance</span><b>+${candidate.addedMiles.toFixed(1)} mi</b></div>
        <div class="impact-row"><span>Off route (approx.)</span><b>~${offRouteMi} mi</b></div>
      </div>
    </section>
    <section class="score-line">
      <h4>Score</h4>
      <div class="score-bars">
        ${scoreRow("Species", candidate.scoreParts.species, 45)}
        ${scoreRow("Activity", candidate.scoreParts.activity, 15)}
        ${scoreRow("Notable", candidate.scoreParts.notable, 20)}
        ${scoreRow("Targets", candidate.scoreParts.targets, 15)}
        ${scoreRow("Route", candidate.scoreParts.practicality, 20)}
      </div>
    </section>
    ${candidate.targetMatches.length ? `
      <section class="species-list">
        <h4>Targets</h4>
        <ul>${candidate.targetMatches.map((obs) => `<li>${escapeHtml(obs.comName)} <small>${escapeHtml(obs.obsDt || "")}</small></li>`).join("")}</ul>
      </section>
    ` : ""}
    ${notable.length ? `
      <section class="species-list">
        <h4>Notable Reports</h4>
        <ul>${notable.map((obs) => `<li>${escapeHtml(obs.comName)} <small>${escapeHtml(obs.obsDt || "")}</small></li>`).join("")}</ul>
      </section>
    ` : ""}
    <section class="species-list">
      <h4>Recent Species <small>(${candidate.species.size} grouped by common name)</small></h4>
      <ul>${species.map((sp) => `<li>${escapeHtml(sp.name)} <small>×${sp.count}${sp.latest ? ` · ${escapeHtml(sp.latest)}` : ""}</small></li>`).join("")}</ul>
    </section>
    <div class="detail-actions">
      <a href="${links.mapsUrl}" target="_blank" rel="noreferrer">Directions</a>
      <a href="${links.ebirdUrl}" target="_blank" rel="noreferrer">eBird</a>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function updateSelectedCard() {
  els.resultsList.querySelectorAll(".stop-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.id === state.selectedId);
  });
}

function scoreRow(label, value, max) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const width = Math.max(0, Math.min(100, safeValue / max * 100));
  return `
    <div class="score-row">
      <span>${escapeHtml(label)}</span>
      <span class="score-track"><span style="width: ${width.toFixed(0)}%"></span></span>
      <b>${safeValue.toFixed(1)}</b>
    </div>
  `;
}

function markerClass(candidate) {
  if (candidate.targetMatches.length) return "marker-low";
  if (uniqueNotableCount(candidate)) return "marker-mid";
  return isHotspot(candidate) ? "marker-high" : "marker-standard";
}

function speciesPreview(candidate) {
  const names = Array.from(candidate.species.values())
    .slice(0, 4)
    .map((obs) => obs.comName || obs.sciName)
    .filter(Boolean);
  return names.length ? names.join(", ") : "Recent observations available";
}

function candidateChips(candidate) {
  const chips = [];
  if (candidate.targetMatches.length) chips.push(`<span class="stop-chip chip-target">${candidate.targetMatches.length} target</span>`);
  if (uniqueNotableCount(candidate)) chips.push(`<span class="stop-chip chip-notable">${uniqueNotableCount(candidate)} notable</span>`);
  if (isHotspot(candidate)) chips.push('<span class="stop-chip chip-hotspot">top hotspot</span>');
  return chips.join("");
}

function isHotspot(candidate) {
  return candidate.score >= 65 || candidate.species.size >= 40;
}

function uniqueNotableCount(candidate) {
  return new Set(candidate.notable.map((obs) => normalizeName(obs.comName || obs.sciName))).size;
}

function renderInsights() {
  const liveDetour = clamp(Number(els.maxDetour.value || 60), 0, 240);
  const liveTargets = parseTargetsInput();
  const hasToken = Boolean(els.apiToken.value.trim());
  const routeText = state.route
    ? `${state.routeName}: ${miles(state.route.distanceMeters).toFixed(0)} miles, ${formatMinutes(state.route.durationSeconds / 60)} drive time, ${liveDetour} min detour budget.`
    : "Set a route to compare drive time, detour budget, and ranked birding stops.";
  els.tripPlanSummary.textContent = routeText;

  els.targetSpeciesSummary.textContent = liveTargets.length
    ? `${liveTargets.length} target species queued: ${liveTargets.slice(0, 3).join(", ")}${liveTargets.length > 3 ? ", ..." : ""}.`
    : "Add targets to highlight matching reports along the corridor.";

  if (state.results.length) {
    const speciesCount = state.results.reduce((sum, candidate) => sum + candidate.species.size, 0);
    const notableCount = state.results.reduce((sum, candidate) => sum + uniqueNotableCount(candidate), 0);
    els.sightingSummary.textContent = `${speciesCount} recent species across ${state.results.length} ranked stops, including ${notableCount} notable species.`;
  } else {
    els.sightingSummary.textContent = state.route && !hasToken
      ? "Route is ready. Add an eBird token to load recent sightings and notable reports."
      : "Recent eBird activity and notable reports appear after search.";
  }
}

function formatMinutes(minutes) {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (!hours) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function miles(meters) {
  return meters / 1609.344;
}

function kmToMiles(km) {
  return Number.isFinite(km) ? km / 1.609344 : 0;
}

function formatMiles(value) {
  if (!Number.isFinite(value)) return "0";
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

function candidateLinks(candidate) {
  return {
    ebirdUrl: candidate.locId
      ? `https://ebird.org/hotspot/${encodeURIComponent(candidate.locId)}`
      : `https://ebird.org/map?lat=${candidate.lat}&lng=${candidate.lng}`,
    mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${candidate.lat},${candidate.lng}`
  };
}

function groupSpecies(candidate) {
  const groups = new Map();
  for (const obs of candidate.observations) {
    const name = obs.comName || obs.sciName || "Unknown species";
    const norm = normalizeName(name);
    let group = groups.get(norm);
    if (!group) {
      group = { name, count: 0, latest: "" };
      groups.set(norm, group);
    }
    group.count += 1;
    const when = obs.obsDt || "";
    if (when > group.latest) group.latest = when;
  }
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function renderReport() {
  if (!els.report) return;
  if (!state.route || !state.params) {
    els.report.innerHTML = "";
    return;
  }
  const p = state.params;
  const route = state.route;
  const generated = new Date().toLocaleString();
  const param = (label, value) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;

  const paramsBlock = `
    <h2>Search parameters</h2>
    <dl class="report-params">
      ${param("Origin", p.origin)}
      ${param("Destination", p.destination)}
      ${param("Max added", `${p.maxDetour} min`)}
      ${param("Corridor radius", `${p.radiusKm} km`)}
      ${param("Recent window", `${p.recentDays} days`)}
      ${param("Max stops", p.maxStops)}
      ${param("Targets", p.targets.length ? p.targets.join(", ") : "none")}
    </dl>`;

  const routeBlock = `
    <h2>Route summary</h2>
    <dl class="report-route">
      ${param("Route", state.routeName || `${p.origin} to ${p.destination}`)}
      ${param("Distance", `${miles(route.distanceMeters).toFixed(0)} mi`)}
      ${param("Drive time", formatMinutes(route.durationSeconds / 60))}
      ${param("Ranked stops", state.results.length)}
    </dl>`;

  const stopsBlock = state.results.length
    ? `<h2>Ranked stops</h2>${state.results.map((candidate, index) => {
        const species = groupSpecies(candidate).slice(0, 40);
        const notable = candidate.notable.slice(0, 12);
        return `
          <div class="report-stop">
            <h3>${index + 1}. ${escapeHtml(candidate.name)}</h3>
            <p class="report-stop-meta">
              Score ${candidate.score} ·
              +${Math.round(candidate.addedMinutes)} min ·
              +${candidate.addedMiles.toFixed(1)} mi detour ·
              ~${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi off route ·
              ${candidate.species.size} species ·
              ${uniqueNotableCount(candidate)} notable ·
              ${candidate.targetMatches.length} targets
            </p>
            ${candidate.targetMatches.length ? `<h4>Target matches</h4><ul>${candidate.targetMatches.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")}</li>`).join("")}</ul>` : ""}
            ${notable.length ? `<h4>Notable</h4><ul>${notable.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")} <small>${escapeHtml(obs.obsDt || "")}</small></li>`).join("")}</ul>` : ""}
            <h4>Recent species</h4>
            <ul>${species.map((sp) => `<li>${escapeHtml(sp.name)} <small>×${sp.count}</small></li>`).join("")}</ul>
          </div>`;
      }).join("")}`
    : `<h2>Ranked stops</h2><p>No stops within the current detour budget.</p>`;

  els.report.innerHTML = `
    <h1>Birdtrip Trip Report</h1>
    <p class="report-sub">${escapeHtml(state.routeName || "")} · Generated ${escapeHtml(generated)}</p>
    ${paramsBlock}
    ${routeBlock}
    ${stopsBlock}
  `;
}

function haversineKm(a, b) {
  const radiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function shortName(displayName) {
  return String(displayName || "").split(",").slice(0, 2).join(",").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
