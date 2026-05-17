const state = {
  map: null,
  routeLayer: null,
  markerLayer: null,
  route: null,
  routeName: "",
  results: [],
  selectedId: null
};

const els = {
  form: document.querySelector("#searchForm"),
  origin: document.querySelector("#origin"),
  destination: document.querySelector("#destination"),
  maxDetour: document.querySelector("#maxDetour"),
  recentDays: document.querySelector("#recentDays"),
  radiusKm: document.querySelector("#radiusKm"),
  maxStops: document.querySelector("#maxStops"),
  apiToken: document.querySelector("#apiToken"),
  targets: document.querySelector("#targets"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  printButton: document.querySelector("#printButton"),
  progressTitle: document.querySelector("#progressTitle"),
  progressMessage: document.querySelector("#progressMessage"),
  routeDistance: document.querySelector("#routeDistance"),
  routeDuration: document.querySelector("#routeDuration"),
  candidateCount: document.querySelector("#candidateCount"),
  resultContext: document.querySelector("#resultContext"),
  resultsList: document.querySelector("#resultsList"),
  resultTemplate: document.querySelector("#resultTemplate"),
  detailsPanel: document.querySelector("#detailsPanel"),
  detailsContent: document.querySelector("#detailsContent"),
  closeDetails: document.querySelector("#closeDetails")
};

init();

function init() {
  restorePreferences();
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
  els.printButton.addEventListener("click", () => window.print());
  els.closeDetails.addEventListener("click", () => {
    els.detailsPanel.hidden = true;
    state.selectedId = null;
    updateSelectedCard();
  });

  if (window.lucide) window.lucide.createIcons();
}

function restorePreferences() {
  const saved = JSON.parse(localStorage.getItem("routeBirdingPrefs") || "{}");
  for (const [key, value] of Object.entries(saved)) {
    if (els[key] && typeof value === "string") els[key].value = value;
  }
}

function savePreferences() {
  const fields = ["origin", "destination", "maxDetour", "recentDays", "radiusKm", "maxStops", "apiToken", "targets"];
  const payload = {};
  for (const field of fields) payload[field] = els[field].value;
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
}

function clearResults() {
  state.results = [];
  state.route = null;
  state.selectedId = null;
  if (state.routeLayer) state.map.removeLayer(state.routeLayer);
  state.markerLayer.clearLayers();
  els.resultsList.className = "results-list empty";
  els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="binoculars"></i><p>Results will appear here after the first search.</p></div>';
  els.resultContext.textContent = "No route searched yet.";
  els.routeDistance.textContent = "-";
  els.routeDuration.textContent = "-";
  els.candidateCount.textContent = "-";
  els.detailsPanel.hidden = true;
  setStatus("Ready", "Enter a route and run a search.");
  if (window.lucide) window.lucide.createIcons();
}

async function runSearch() {
  savePreferences();
  const params = readParams();
  setBusy(true);
  clearSearchArtifacts();

  try {
    setStatus("Geocoding", "Resolving origin and destination.");
    const [originMatches, destinationMatches] = await Promise.all([
      apiJson(`/api/geocode?q=${encodeURIComponent(params.origin)}`),
      apiJson(`/api/geocode?q=${encodeURIComponent(params.destination)}`)
    ]);
    if (!originMatches.length) throw new Error(`Could not geocode origin: ${params.origin}`);
    if (!destinationMatches.length) throw new Error(`Could not geocode destination: ${params.destination}`);

    const origin = originMatches[0];
    const destination = destinationMatches[0];
    state.routeName = `${shortName(origin.name)} to ${shortName(destination.name)}`;

    setStatus("Routing", "Drawing the direct route.");
    const route = await apiJson(routeUrl("/api/route", origin, destination));
    state.route = { ...route, origin, destination };
    renderRoute(route.geometry.coordinates);
    updateRouteSummary(route);

    if (!params.token) {
      setStatus("Token needed", "Route loaded. Add an eBird API token to rank live birding stops.");
      els.resultContext.textContent = "Route loaded, but live bird data needs an eBird token.";
      return;
    }

    setStatus("Scanning route", "Sampling points along the drive and requesting recent eBird observations.");
    const samples = sampleRoute(route.geometry.coordinates, route.distanceMeters, 14);
    const observationsBySample = await fetchRecentForSamples(samples, params);
    const candidates = buildCandidates(observationsBySample, samples, params);

    if (!candidates.length) {
      setStatus("No candidates", "No hotspot observations were found. Try a wider radius or longer recent window.");
      els.resultContext.textContent = "No birding locations matched the current route settings.";
      return;
    }

    setStatus("Checking detours", `Evaluating route impact for ${Math.min(candidates.length, params.maxStops * 3)} candidate stops.`);
    const practical = await evaluateDetours(candidates, origin, destination, route.durationSeconds, params);

    if (!practical.length) {
      setStatus("No stops within budget", "Try increasing the maximum added time or route radius.");
      els.resultContext.textContent = "Candidate birding locations were outside the detour budget.";
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

function clearSearchArtifacts() {
  state.results = [];
  state.selectedId = null;
  els.detailsPanel.hidden = true;
  state.markerLayer.clearLayers();
  if (state.routeLayer) {
    state.map.removeLayer(state.routeLayer);
    state.routeLayer = null;
  }
  els.resultsList.className = "results-list empty";
  els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="loader"></i><p>Searching route corridor...</p></div>';
  if (window.lucide) window.lucide.createIcons();
}

function setBusy(isBusy) {
  els.form.querySelectorAll("button, input, textarea").forEach((control) => {
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
    throw new Error(payload.error || response.statusText || "Request failed");
  }
  return payload;
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
    color: "#276b49",
    weight: 5,
    opacity: 0.82
  }).addTo(state.map);
  state.map.fitBounds(state.routeLayer.getBounds(), { padding: [34, 34] });
}

function updateRouteSummary(route) {
  els.routeDistance.textContent = miles(route.distanceMeters).toFixed(0);
  els.routeDuration.textContent = formatMinutes(route.durationSeconds / 60);
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
          species: new Map(),
          notable: [],
          nearestSample: sample,
          routeDistanceKm: Infinity,
          targetMatches: []
        });
      }
      const candidate = byKey.get(key);
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
    }
  }
  return practical;
}

async function addNotableObservations(candidates, params) {
  const top = candidates.slice(0, Math.max(params.maxStops, 6));
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
    }
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
  els.resultContext.textContent = `${state.routeName}; ${state.results.length} stops within budget.`;
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
    node.querySelector(".score-pill").textContent = candidate.score;
    node.querySelector(".metric-detour").textContent = `+${Math.round(candidate.addedMinutes)}m`;
    node.querySelector(".metric-species").textContent = candidate.species.size;
    node.querySelector(".metric-notable").textContent = uniqueNotableCount(candidate);
    node.querySelector(".metric-targets").textContent = candidate.targetMatches.length;
    const mainButton = node.querySelector(".stop-main");
    mainButton.setAttribute("aria-label", `View ${candidate.name}`);
    mainButton.addEventListener("click", () => selectCandidate(candidate.id));
    els.resultsList.appendChild(node);
  });

  if (window.lucide) window.lucide.createIcons();
}

function renderMarkers() {
  state.markerLayer.clearLayers();
  for (const candidate of state.results) {
    const marker = L.marker([candidate.lat, candidate.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="bird-marker ${markerClass(candidate)}"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    });
    marker.bindPopup(`<strong>${escapeHtml(candidate.name)}</strong><br>${candidate.score} score; +${Math.round(candidate.addedMinutes)} min<br>${candidate.species.size} recent species`);
    marker.on("click", () => selectCandidate(candidate.id));
    marker.addTo(state.markerLayer);
  }
}

function selectCandidate(id) {
  const candidate = state.results.find((item) => item.id === id);
  if (!candidate) return;
  state.selectedId = id;
  renderDetails(candidate);
  els.detailsPanel.hidden = false;
  updateSelectedCard();
  state.map.flyTo([candidate.lat, candidate.lng], Math.max(state.map.getZoom(), 11), { duration: 0.6 });
}

function renderDetails(candidate) {
  const species = Array.from(candidate.species.values())
    .sort((a, b) => String(a.comName).localeCompare(String(b.comName)))
    .slice(0, 60);
  const notable = candidate.notable.slice(0, 20);
  const ebirdUrl = candidate.locId
    ? `https://ebird.org/hotspot/${encodeURIComponent(candidate.locId)}`
    : `https://ebird.org/map?lat=${candidate.lat}&lng=${candidate.lng}`;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${candidate.lat},${candidate.lng}`;

  els.detailsContent.innerHTML = `
    <h3>${escapeHtml(candidate.name)}</h3>
    <p class="detail-subtitle">${candidate.score} score; +${Math.round(candidate.addedMinutes)} min and +${candidate.addedMiles.toFixed(1)} mi.</p>
    <div class="detail-grid">
      <div><b>${candidate.species.size}</b><small>recent species</small></div>
      <div><b>${candidate.observations.length}</b><small>records</small></div>
      <div><b>${uniqueNotableCount(candidate)}</b><small>notable species</small></div>
      <div><b>${candidate.targetMatches.length}</b><small>target matches</small></div>
    </div>
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
      <h4>Recent Species</h4>
      <ul>${species.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "Unknown species")} <small>${escapeHtml(obs.obsDt || "")}</small></li>`).join("")}</ul>
    </section>
    <div class="detail-actions">
      <a href="${mapsUrl}" target="_blank" rel="noreferrer">Directions</a>
      <a href="${ebirdUrl}" target="_blank" rel="noreferrer">eBird</a>
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
  if (candidate.score >= 65) return "marker-high";
  if (candidate.score >= 42) return "marker-mid";
  return "marker-low";
}

function speciesPreview(candidate) {
  const names = Array.from(candidate.species.values())
    .slice(0, 4)
    .map((obs) => obs.comName || obs.sciName)
    .filter(Boolean);
  return names.length ? names.join(", ") : "Recent observations available";
}

function uniqueNotableCount(candidate) {
  return new Set(candidate.notable.map((obs) => normalizeName(obs.comName || obs.sciName))).size;
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
