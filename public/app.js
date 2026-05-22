const state = {
  mode: "route",
  mapAdapter: null,
  route: null,
  routeName: "",
  results: [],
  selectedId: null,
  savedTrips: [],
  warnings: [],
  params: null,
  origin: null,
  destination: null,
  areaCenter: null,
  provider: "osm",
  lifeList: {
    source: "",
    fileName: "",
    importedAt: "",
    species: new Set(),
    displayNames: []
  },
  config: {
    defaultMapProvider: "osm",
    providers: {
      osm: { enabled: true },
      google: { enabled: false, browserKey: "", serverConfigured: false }
    }
  }
};

const els = {
  quickStartButton: document.querySelector("#quickStartButton"),
  downloadReportButton: document.querySelector("#downloadReportButton"),
  settingsButton: document.querySelector("#settingsButton"),
  setupStatus: document.querySelector("#setupStatus"),
  form: document.querySelector("#searchForm"),
  modeButtons: document.querySelectorAll(".mode-switch button[data-mode]"),
  routeModeButton: document.querySelector("#routeModeButton"),
  areaModeButton: document.querySelector("#areaModeButton"),
  locationGroupTitle: document.querySelector("#locationGroupTitle"),
  originLabelText: document.querySelector("#originLabelText"),
  destinationField: document.querySelector("#destinationField"),
  origin: document.querySelector("#origin"),
  destination: document.querySelector("#destination"),
  mapProvider: document.querySelector("#mapProvider"),
  mapProviderHint: document.querySelector("#mapProviderHint"),
  maxDetour: document.querySelector("#maxDetour"),
  maxDetourLabel: document.querySelector("#maxDetourLabel"),
  maxDetourUnit: document.querySelector("#maxDetourUnit"),
  recentDays: document.querySelector("#recentDays"),
  radiusKm: document.querySelector("#radiusKm"),
  maxStops: document.querySelector("#maxStops"),
  apiToken: document.querySelector("#apiToken"),
  rememberToken: document.querySelector("#rememberToken"),
  targets: document.querySelector("#targets"),
  lifeListInput: document.querySelector("#lifeListInput"),
  lifeListStatus: document.querySelector("#lifeListStatus"),
  clearLifeListButton: document.querySelector("#clearLifeListButton"),
  originError: document.querySelector("#originError"),
  destinationError: document.querySelector("#destinationError"),
  warningPanel: document.querySelector("#warningPanel"),
  warningMessage: document.querySelector("#warningMessage"),
  report: document.querySelector("#report"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  printButton: document.querySelector("#printButton"),
  tripName: document.querySelector("#tripName"),
  savedTripSelect: document.querySelector("#savedTripSelect"),
  saveTripButton: document.querySelector("#saveTripButton"),
  loadTripButton: document.querySelector("#loadTripButton"),
  deleteTripButton: document.querySelector("#deleteTripButton"),
  savedTripsStatus: document.querySelector("#savedTripsStatus"),
  progressTitle: document.querySelector("#progressTitle"),
  progressMessage: document.querySelector("#progressMessage"),
  targetCount: document.querySelector("#targetCount"),
  liferCount: document.querySelector("#liferCount"),
  notableCount: document.querySelector("#notableCount"),
  hotspotCount: document.querySelector("#hotspotCount"),
  routeDistance: document.querySelector("#routeDistance"),
  routeDistanceLabel: document.querySelector("#routeDistanceLabel"),
  maxAdded: document.querySelector("#maxAdded"),
  maxAddedLabel: document.querySelector("#maxAddedLabel"),
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
  modalExploreButton: document.querySelector("#modalExploreButton"),
  submitLabel: document.querySelector("#submitLabel"),
  mapAreaLegend: document.querySelector("#mapAreaLegend")
};

const PREF_FIELDS = ["origin", "destination", "mapProvider", "maxDetour", "recentDays", "radiusKm", "maxStops", "targets"];
const SAVED_TRIPS_KEY = "birdtripSavedTrips";

function init() {
  const saved = restorePreferences();
  state.savedTrips = readSavedTrips();
  state.mode = saved.searchMode === "area" ? "area" : "route";
  const preferredProvider = typeof saved.mapProvider === "string" ? providerFromInput() : null;
  state.provider = preferredProvider || "osm";
  setupProviderControl();
  setSearchMode(state.mode, { persist: false });
  updateSetupStatus();
  updateInputSummaries();
  renderSavedTrips();
  setMapProvider("osm", { persist: false, preserveData: false });
  loadAppConfig(preferredProvider);

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });
  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setSearchMode(button.dataset.mode));
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
  els.mapProvider.addEventListener("change", () => setMapProvider(providerFromInput()));
  els.targets.addEventListener("input", updateInputSummaries);
  els.lifeListInput.addEventListener("change", handleLifeListFile);
  els.clearLifeListButton.addEventListener("click", clearLifeList);
  els.maxDetour.addEventListener("input", updateInputSummaries);
  els.quickStartButton.addEventListener("click", openQuickStart);
  els.downloadReportButton.addEventListener("click", downloadHtmlReport);
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
  els.saveTripButton.addEventListener("click", saveCurrentTrip);
  els.loadTripButton.addEventListener("click", () => loadSelectedTrip());
  els.deleteTripButton.addEventListener("click", deleteSelectedTrip);
  els.savedTripSelect.addEventListener("change", handleSavedTripSelection);
  els.tripName.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    saveCurrentTrip();
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
  if (saved.lifeList && typeof saved.lifeList === "object") {
    const species = Array.isArray(saved.lifeList.species) ? saved.lifeList.species : [];
    const displayNames = Array.isArray(saved.lifeList.displayNames) ? saved.lifeList.displayNames : species;
    state.lifeList = {
      source: typeof saved.lifeList.source === "string" ? saved.lifeList.source : "",
      fileName: typeof saved.lifeList.fileName === "string" ? saved.lifeList.fileName : "",
      importedAt: typeof saved.lifeList.importedAt === "string" ? saved.lifeList.importedAt : "",
      species: new Set(species.map((name) => normalizeName(name)).filter(Boolean)),
      displayNames: displayNames.map(String).filter(Boolean)
    };
  }
  return saved;
}

function savePreferences() {
  const payload = {};
  for (const field of PREF_FIELDS) payload[field] = els[field].value;
  payload.searchMode = state.mode;
  const remember = els.rememberToken.checked;
  payload.rememberToken = remember;
  if (remember) payload.apiToken = els.apiToken.value;
  if (state.lifeList.species.size) {
    payload.lifeList = {
      source: state.lifeList.source,
      fileName: state.lifeList.fileName,
      importedAt: state.lifeList.importedAt,
      species: Array.from(state.lifeList.species),
      displayNames: state.lifeList.displayNames
    };
  }
  try {
    localStorage.setItem("routeBirdingPrefs", JSON.stringify(payload));
  } catch {
    delete payload.lifeList;
    localStorage.setItem("routeBirdingPrefs", JSON.stringify(payload));
    addWarning("The imported life list was too large to save in this browser, but it will work until the page is refreshed.");
    renderWarnings();
  }
}

function setSearchMode(mode, options = {}) {
  const { persist = true } = options;
  const previousMode = state.mode;
  state.mode = mode === "area" ? "area" : "route";
  const isArea = state.mode === "area";
  els.form.dataset.mode = state.mode;

  els.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  els.locationGroupTitle.textContent = isArea ? "Area" : "Route";
  els.originLabelText.textContent = isArea ? "Location" : "Origin";
  els.origin.placeholder = isArea ? "City, park, hotel, or address" : "";
  els.destinationField.hidden = isArea;
  els.destination.required = !isArea;
  els.maxDetourLabel.textContent = isArea ? "Area limit" : "Max added";
  els.maxDetourUnit.textContent = isArea ? "off" : "min";
  els.maxDetour.disabled = isArea;
  els.submitLabel.textContent = isArea ? "Search Area" : "Find Stops";
  els.routeDistanceLabel.textContent = isArea ? "Area Radius" : "Route Miles";
  els.maxAddedLabel.textContent = isArea ? "Area Mode" : "Added Time Budget";
  els.mapAreaLegend.textContent = isArea ? "Search area" : "Route corridor";
  els.sampleButton.title = isArea ? "Use sample area" : "Use sample route";
  els.progressMessage.textContent = isArea && els.progressTitle.textContent === "Ready"
    ? "Enter a city, park, or lodging location and run a search."
    : els.progressMessage.textContent;

  clearFieldErrors();
  if (persist && previousMode !== state.mode && (state.route || state.areaCenter || state.results.length)) {
    clearResults();
  }
  updateInputSummaries();
  renderInsights();
  if (persist) savePreferences();
  if (window.lucide) window.lucide.createIcons();
}

function readSavedTrips() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_TRIPS_KEY) || "{}");
    const trips = Array.isArray(parsed.trips) ? parsed.trips : [];
    return trips
      .filter((trip) => trip && typeof trip.id === "string" && typeof trip.name === "string")
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  } catch {
    localStorage.removeItem(SAVED_TRIPS_KEY);
    return [];
  }
}

function writeSavedTrips(trips = state.savedTrips) {
  localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify({
    version: 1,
    trips
  }));
}

function renderSavedTrips(selectedId = els.savedTripSelect.value) {
  const trips = state.savedTrips;
  els.savedTripSelect.innerHTML = "";

  if (!trips.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved trips";
    els.savedTripSelect.appendChild(option);
  } else {
    for (const trip of trips) {
      const option = document.createElement("option");
      option.value = trip.id;
      option.textContent = tripOptionLabel(trip);
      els.savedTripSelect.appendChild(option);
    }
  }

  els.savedTripSelect.value = trips.some((trip) => trip.id === selectedId) ? selectedId : (trips[0]?.id || "");
  updateSavedTripControls();
}

function tripOptionLabel(trip) {
  const date = trip.updatedAt ? new Date(trip.updatedAt) : null;
  const stamp = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  return stamp ? `${trip.name} - ${stamp}` : trip.name;
}

function updateSavedTripControls(message) {
  const hasTrip = Boolean(els.savedTripSelect.value);
  els.loadTripButton.disabled = !hasTrip;
  els.deleteTripButton.disabled = !hasTrip;
  if (message) els.savedTripsStatus.textContent = message;
}

function handleSavedTripSelection() {
  const trip = currentSavedTrip();
  if (trip) {
    els.tripName.value = trip.name;
    updateSavedTripControls(`${trip.name} is selected.`);
  } else {
    updateSavedTripControls("Trips stay in this browser.");
  }
}

function currentSavedTrip() {
  return state.savedTrips.find((trip) => trip.id === els.savedTripSelect.value) || null;
}

function saveCurrentTrip() {
  const name = cleanTripName(els.tripName.value || state.routeName || `${els.origin.value.trim()} to ${els.destination.value.trim()}`);
  if (!name) {
    updateSavedTripControls("Add a name before saving.");
    els.tripName.focus();
    return;
  }

  renderReport();
  const matchingTrip = state.savedTrips.find((trip) => trip.name.toLowerCase() === name.toLowerCase());
  const id = matchingTrip?.id || createTripId();
  const trip = {
    id,
    name,
    updatedAt: new Date().toISOString(),
    settings: readTripSettings(),
    state: serializeTripState(),
    reportHtml: els.report.innerHTML
  };

  const nextSavedTrips = [
    trip,
    ...state.savedTrips.filter((item) => item.id !== id)
  ].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  try {
    writeSavedTrips(nextSavedTrips);
  } catch (error) {
    updateSavedTripControls("Could not save trip; local storage is full.");
    console.error(error);
    return;
  }

  state.savedTrips = nextSavedTrips;
  els.tripName.value = name;
  renderSavedTrips(id);
  updateSavedTripControls(`Saved ${name} locally.`);
}

async function loadSelectedTrip() {
  const trip = currentSavedTrip();
  if (!trip) return;

  try {
    const settings = {
      ...(trip.settings || {}),
      searchMode: trip.settings?.searchMode || trip.state?.params?.mode || state.mode
    };
    applyTripSettings(settings);
    updateSetupStatus();
    updateInputSummaries();
    clearFieldErrors();
    clearWarning();
    await setMapProvider(settings.mapProvider || state.provider, { persist: false, preserveData: false });
    restoreTripState(trip);
    savePreferences();
    els.tripName.value = trip.name;
    renderSavedTrips(trip.id);
    updateSavedTripControls(`Loaded ${trip.name}.`);
    setStatus("Trip loaded", `${trip.name} restored from this browser.`);
  } catch (error) {
    console.error(error);
    updateSavedTripControls(`Could not load ${trip.name}.`);
    setStatus("Load failed", error.message || "Saved trip could not be restored.");
  }
}

function deleteSelectedTrip() {
  const trip = currentSavedTrip();
  if (!trip) return;
  if (!window.confirm(`Delete "${trip.name}" from saved trips?`)) return;
  const nextSavedTrips = state.savedTrips.filter((item) => item.id !== trip.id);
  try {
    writeSavedTrips(nextSavedTrips);
  } catch (error) {
    updateSavedTripControls("Could not delete trip; local storage could not be updated.");
    console.error(error);
    return;
  }
  state.savedTrips = nextSavedTrips;
  renderSavedTrips();
  updateSavedTripControls(`Deleted ${trip.name}.`);
}

function readTripSettings() {
  const settings = {};
  for (const field of PREF_FIELDS) settings[field] = els[field].value;
  settings.searchMode = state.mode;
  settings.mapProvider = state.provider;
  return settings;
}

function applyTripSettings(settings) {
  for (const field of PREF_FIELDS) {
    if (typeof settings[field] === "string" && els[field]) els[field].value = settings[field];
  }
  if (typeof settings.searchMode === "string") {
    setSearchMode(settings.searchMode, { persist: false });
  }
}

function serializeTripState() {
  return {
    routeName: state.routeName,
    route: state.route,
    results: state.results.map(serializeCandidate),
    selectedId: state.selectedId,
    warnings: state.warnings,
    params: state.params ? { ...state.params, token: "" } : null,
    origin: state.origin,
    destination: state.destination,
    areaCenter: state.areaCenter
  };
}

function serializeCandidate(candidate) {
  return {
    id: candidate.id,
    locId: candidate.locId,
    name: candidate.name,
    lat: candidate.lat,
    lng: candidate.lng,
    observations: candidate.observations,
    notable: candidate.notable,
    nearestSample: candidate.nearestSample,
    routeDistanceKm: candidate.routeDistanceKm,
    targetMatches: candidate.targetMatches,
    viaRoute: candidate.viaRoute,
    addedMinutes: candidate.addedMinutes,
    addedMiles: candidate.addedMiles,
    scoreParts: candidate.scoreParts,
    score: candidate.score
  };
}

function restoreTripState(trip) {
  const savedState = trip.state || {};
  state.routeName = savedState.routeName || "";
  state.route = savedState.route || null;
  state.results = Array.isArray(savedState.results)
    ? savedState.results.filter(isObjectRecord).map(hydrateCandidate)
    : [];
  state.selectedId = savedState.selectedId || null;
  state.warnings = Array.isArray(savedState.warnings) ? savedState.warnings : [];
  state.params = isObjectRecord(savedState.params)
    ? { ...savedState.params, mapProvider: state.provider, token: els.apiToken.value.trim() }
    : null;
  state.origin = savedState.origin || state.route?.origin || null;
  state.destination = savedState.destination || state.route?.destination || null;
  state.areaCenter = savedState.areaCenter || null;

  if (state.mapAdapter) state.mapAdapter.clear();
  els.detailsPanel.hidden = true;
  els.report.innerHTML = "";

  if (state.route?.geometry?.coordinates) {
    renderRoute(state.route.geometry.coordinates);
    updateRouteSummary(state.route);
  } else if (state.areaCenter) {
    renderArea(state.areaCenter, Number(state.params?.radiusKm || els.radiusKm.value || 25));
    updateAreaSummary(Number(state.params?.radiusKm || els.radiusKm.value || 25));
  } else {
    els.routeDistance.textContent = "-";
  }

  if (state.results.length) {
    renderResults();
    renderMarkers();
  } else {
    renderEmptyResults("binoculars", state.route ? "Route restored. Run a search to refresh birding stops." : "Saved settings restored. Run a search to build this trip.");
    els.candidateCount.textContent = "-";
    els.hotspotCount.textContent = "-";
    els.notableCount.textContent = "-";
    els.resultContext.textContent = state.routeName ? `${state.routeName}; no saved stops.` : "No route searched yet.";
  }

  renderWarnings();
  renderReport();
  renderInsights();
  restoreSelectedStop();
  if (window.lucide) window.lucide.createIcons();
}

function hydrateCandidate(candidate) {
  const observations = Array.isArray(candidate.observations)
    ? candidate.observations.filter(isObjectRecord)
    : [];
  const notable = Array.isArray(candidate.notable)
    ? candidate.notable.filter(isObjectRecord)
    : [];
  const species = new Map();
  const seen = new Set();

  for (const obs of observations) {
    const speciesKey = normalizeName(obs.comName || obs.sciName || "Unknown species");
    if (speciesKey && !species.has(speciesKey)) species.set(speciesKey, obs);
    const obsKey = obs.subId && obs.speciesCode
      ? `${obs.subId}|${obs.speciesCode}`
      : `${speciesKey}|${obs.obsDt || ""}|${obs.howMany ?? ""}`;
    seen.add(obsKey);
  }

  return {
    ...candidate,
    observations,
    notable,
    seen,
    species,
    targetMatches: Array.isArray(candidate.targetMatches) ? candidate.targetMatches : [],
    routeDistanceKm: Number.isFinite(candidate.routeDistanceKm) ? candidate.routeDistanceKm : 0,
    scoreParts: candidate.scoreParts || {
      species: 0,
      activity: 0,
      notable: 0,
      targets: 0,
      practicality: 0
    },
    score: Number.isFinite(candidate.score) ? candidate.score : 0
  };
}

function isObjectRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function restoreSelectedStop() {
  if (!state.selectedId) return;
  const candidate = state.results.find((item) => item.id === state.selectedId);
  if (!candidate) {
    state.selectedId = null;
    return;
  }
  renderDetails(candidate);
  els.detailsPanel.hidden = false;
  updateSelectedCard();
  renderMarkers();
}

function renderEmptyResults(icon, message) {
  els.resultsList.className = "results-list empty";
  els.resultsList.innerHTML = `<div class="empty-state"><i data-lucide="${icon}"></i><p>${escapeHtml(message)}</p></div>`;
}

function cleanTripName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function createTripId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadAppConfig(preferredProvider) {
  try {
    const config = await apiJson("/api/config");
    state.config = {
      ...state.config,
      ...config,
      providers: {
        ...state.config.providers,
        ...(config.providers || {})
      }
    };
  } catch (error) {
    addWarning(`Map service setup could not be checked: ${error.message}`);
    renderWarnings();
  }
  setupProviderControl();
  await setMapProvider(resolveProvider(preferredProvider || state.config.defaultMapProvider || providerFromInput()), { persist: false });
}

function setupProviderControl() {
  const googleOption = els.mapProvider.querySelector('option[value="google"]');
  if (googleOption) googleOption.disabled = !canUseGoogle();
  const resolved = resolveProvider(providerFromInput());
  if (els.mapProvider.value !== resolved) els.mapProvider.value = resolved;
  updateProviderHint();
}

function canUseGoogle() {
  return Boolean(
    state.config.providers.google?.enabled &&
    state.config.providers.google?.browserKey &&
    state.config.providers.google?.serverConfigured
  );
}

function providerFromInput() {
  return els.mapProvider.value === "google" ? "google" : "osm";
}

function resolveProvider(provider) {
  if (provider === "google" && !canUseGoogle()) return "osm";
  return provider === "google" ? "google" : "osm";
}

function providerLabel(provider) {
  return provider === "google" ? "Google Maps" : "OpenStreetMap";
}

function updateProviderHint() {
  if (els.mapProvider.value === "google") {
    els.mapProviderHint.textContent = "Google Maps routing, geocoding, and map display.";
  } else if (state.config.providers.google?.serverConfigured || state.config.providers.google?.browserKey) {
    els.mapProviderHint.textContent = canUseGoogle()
      ? "OpenStreetMap routing and map tiles."
      : "Google Maps needs both browser and server keys.";
  } else {
    els.mapProviderHint.textContent = "OpenStreetMap routing and map tiles.";
  }
}

async function setMapProvider(provider, options = {}) {
  const { persist = true, preserveData = true } = options;
  const nextProvider = resolveProvider(provider);
  els.mapProvider.value = nextProvider;
  updateProviderHint();

  if (state.provider === nextProvider && state.mapAdapter) {
    if (persist) savePreferences();
    return;
  }

  state.provider = nextProvider;
  try {
    await initializeMap(nextProvider, { preserveData });
    if (persist) savePreferences();
  } catch (error) {
    if (nextProvider === "google") {
      addWarning(`Google Maps could not be loaded: ${error.message}. Falling back to OpenStreetMap.`);
      state.provider = "osm";
      els.mapProvider.value = "osm";
      updateProviderHint();
      await initializeMap("osm", { preserveData });
    } else {
      throw error;
    }
  }
}

async function initializeMap(provider, options = {}) {
  const { preserveData = true } = options;
  const container = document.querySelector("#map");
  const routeCoordinates = preserveData ? state.route?.geometry?.coordinates : null;
  const areaCenter = preserveData ? state.areaCenter : null;
  const areaRadiusKm = preserveData ? state.params?.radiusKm : null;
  const results = preserveData ? state.results : [];
  const selectedId = preserveData ? state.selectedId : null;

  if (state.mapAdapter) {
    state.mapAdapter.destroy();
    state.mapAdapter = null;
  }
  container.innerHTML = "";

  if (provider === "google") {
    await loadGoogleMapsScript(state.config.providers.google.browserKey);
    state.mapAdapter = new GoogleMapAdapter(container);
  } else {
    state.mapAdapter = new LeafletMapAdapter(container);
  }
  state.mapAdapter.init();
  if (routeCoordinates) renderRoute(routeCoordinates);
  if (areaCenter && areaRadiusKm) renderArea(areaCenter, areaRadiusKm);
  if (results.length) {
    state.selectedId = selectedId;
    renderMarkers();
  }
}

function loadGoogleMapsScript(key) {
  if (window.google?.maps) return Promise.resolve();
  if (window.googleMapsLoading) return window.googleMapsLoading;
  const params = new URLSearchParams({
    key,
    v: "weekly"
  });
  window.googleMapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      window.googleMapsLoading = null;
      reject(new Error("Maps JavaScript API failed to load"));
    };
    document.head.appendChild(script);
  });
  return window.googleMapsLoading;
}

function useSampleRoute() {
  if (state.mode === "area") {
    els.origin.value = "Papago Park, Phoenix, AZ";
    els.recentDays.value = "14";
    els.radiusKm.value = "20";
    els.maxStops.value = "10";
    els.targets.value = "Rosy-faced Lovebird\nGilded Flicker\nAbert's Towhee";
  } else {
    els.origin.value = "Yuma, AZ";
    els.destination.value = "Phoenix, AZ";
    els.maxDetour.value = "60";
    els.recentDays.value = "14";
    els.radiusKm.value = "25";
    els.maxStops.value = "10";
    els.targets.value = "Gilded Flicker\nAbert's Towhee\nRosy-faced Lovebird\nBendire's Thrasher";
  }
  updateInputSummaries();
}

function clearResults() {
  state.results = [];
  state.route = null;
  state.areaCenter = null;
  state.selectedId = null;
  state.params = null;
  state.warnings = [];
  if (state.mapAdapter) state.mapAdapter.clear();
  clearFieldErrors();
  clearWarning();
  els.report.innerHTML = "";
  els.resultsList.className = "results-list empty";
  els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="binoculars"></i><p>Results will appear here after the first search.</p></div>';
  els.resultContext.textContent = state.mode === "area" ? "No area searched yet." : "No route searched yet.";
  els.routeDistance.textContent = "-";
  els.notableCount.textContent = "-";
  els.hotspotCount.textContent = "-";
  els.candidateCount.textContent = "-";
  els.liferCount.textContent = "-";
  updateInputSummaries();
  renderInsights();
  els.detailsPanel.hidden = true;
  setStatus("Ready", state.mode === "area"
    ? "Enter a city, park, or lodging location and run a search."
    : "Enter a route and run a search.");
  if (window.lucide) window.lucide.createIcons();
}

async function runSearch() {
  savePreferences();
  const params = readParams();
  setBusy(true);
  clearSearchArtifacts();
  state.params = params;

  try {
    if (params.mode === "area") {
      await runAreaSearch(params);
    } else {
      await runRouteSearch(params);
    }
  } catch (error) {
    setStatus("Search failed", error.message || "Something went wrong.");
    console.error(error);
  } finally {
    setBusy(false);
  }
}

async function runRouteSearch(params) {
  setStatus("Geocoding", "Resolving origin and destination.");
  const [originResult, destinationResult] = await Promise.allSettled([
    geocodeField("origin", params.origin, params.mapProvider),
    geocodeField("destination", params.destination, params.mapProvider)
  ]);
  if (originResult.status === "rejected") throw originResult.reason;
  if (destinationResult.status === "rejected") throw destinationResult.reason;
  const origin = originResult.value;
  const destination = destinationResult.value;
  state.origin = origin;
  state.destination = destination;
  state.routeName = `${shortName(origin.name)} to ${shortName(destination.name)}`;
  if (!els.tripName.value.trim()) els.tripName.value = state.routeName;

  setStatus("Routing", "Drawing the direct route.");
  const route = await apiJson(routeUrl("/api/route", origin, destination, null, params.mapProvider));
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
}

async function runAreaSearch(params) {
  setStatus("Geocoding", "Resolving search location.");
  const center = await geocodeField("origin", params.origin, params.mapProvider);
  state.origin = center;
  state.areaCenter = center;
  state.routeName = shortName(center.name) || params.origin;
  if (!els.tripName.value.trim()) els.tripName.value = state.routeName;
  renderArea(center, params.radiusKm);
  updateAreaSummary(params.radiusKm);

  if (!params.token) {
    setStatus("Token needed", "Area loaded. Add an eBird API token to rank live birding stops.");
    els.resultContext.textContent = "Area loaded, but live bird data needs an eBird token.";
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="feather"></i><p>Add an eBird API token to rank live birding stops.</p></div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  setStatus("Scanning area", "Requesting recent eBird observations near the selected location.");
  const samples = [{ lat: center.lat, lng: center.lng, index: 0 }];
  const observationsBySample = await fetchRecentForSamples(samples, params);
  const candidates = buildCandidates(observationsBySample, samples, params);

  if (!candidates.length) {
    setStatus("No candidates", "No hotspot observations were found. Try a wider radius or longer recent window.");
    els.resultContext.textContent = "No birding locations matched the current area settings.";
    renderWarnings();
    return;
  }

  const practical = candidates.map((candidate) => ({
    ...candidate,
    addedMinutes: 0,
    addedMiles: 0
  }));

  setStatus("Adding notable birds", "Checking recent notable reports for the strongest area matches.");
  await addNotableObservations(practical, params);
  scoreCandidates(practical, params);

  state.results = practical
    .sort((a, b) => b.score - a.score)
    .slice(0, params.maxStops);

  renderResults();
  renderMarkers();
  renderReport();
  renderWarnings();
  setStatus("Complete", `Found ${state.results.length} stops within ${params.radiusKm} km.`);
}

function readParams() {
  return {
    mode: state.mode,
    origin: els.origin.value.trim(),
    destination: els.destination.value.trim(),
    maxDetour: clamp(Number(els.maxDetour.value || 60), 0, 240),
    recentDays: clamp(Number(els.recentDays.value || 14), 1, 30),
    radiusKm: clamp(Number(els.radiusKm.value || 25), 1, 50),
    maxStops: clamp(Number(els.maxStops.value || 10), 3, 20),
    mapProvider: state.provider,
    token: els.apiToken.value.trim(),
    targets: els.targets.value
      .split(/\n|,/)
      .map((target) => normalizeName(target))
      .filter(Boolean),
    lifeList: new Set(state.lifeList.species)
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
  els.maxAdded.textContent = state.mode === "area"
    ? "Area"
    : `${clamp(Number(els.maxDetour.value || 60), 0, 240)}m`;
  updateLifeListStatus();
  renderInsights();
}

function parseTargetsInput() {
  return els.targets.value
    .split(/\n|,/)
    .map((target) => normalizeName(target))
    .filter(Boolean);
}

async function handleLifeListFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseLifeListText(text, file.name);
    if (!parsed.species.size) {
      throw new Error("No bird species names were found. Try an eBird or iNaturalist CSV export.");
    }
    state.lifeList = {
      source: parsed.source,
      fileName: file.name,
      importedAt: new Date().toISOString(),
      species: parsed.species,
      displayNames: parsed.displayNames
    };
    applyLifeListToCurrentResults();
    savePreferences();
    updateInputSummaries();
    renderResultsIfPresent();
    setStatus("Life list imported", `${state.lifeList.displayNames.length} species loaded from ${file.name}. Run search again for full reranking.`);
  } catch (error) {
    setStatus("Import failed", error.message || "Could not import that life list.");
  } finally {
    els.lifeListInput.value = "";
  }
}

function clearLifeList() {
  state.lifeList = {
    source: "",
    fileName: "",
    importedAt: "",
    species: new Set(),
    displayNames: []
  };
  applyLifeListToCurrentResults();
  savePreferences();
  updateInputSummaries();
  renderResultsIfPresent();
  setStatus("Life list cleared", "Imported species will no longer affect lifer ranking.");
}

function updateLifeListStatus() {
  const count = state.lifeList.displayNames.length || state.lifeList.species.size;
  if (!count) {
    els.lifeListStatus.textContent = "Import an eBird or iNaturalist CSV to boost likely lifers.";
    els.clearLifeListButton.disabled = true;
    return;
  }
  const source = state.lifeList.source ? `${state.lifeList.source} ` : "";
  const fileName = state.lifeList.fileName ? ` from ${state.lifeList.fileName}` : "";
  els.lifeListStatus.textContent = `${count} ${source}species imported${fileName}.`;
  els.clearLifeListButton.disabled = false;
}

function renderResultsIfPresent() {
  if (!state.results.length) {
    els.liferCount.textContent = state.lifeList.species.size ? "0" : "-";
    renderInsights();
    return;
  }
  renderResults();
  renderMarkers();
  renderReport();
  if (state.selectedId) {
    const candidate = state.results.find((item) => item.id === state.selectedId);
    if (candidate) renderDetails(candidate);
  }
}

function applyLifeListToCurrentResults() {
  if (!state.results.length) return;
  const params = {
    ...(state.params || {}),
    maxDetour: state.params?.maxDetour ?? clamp(Number(els.maxDetour.value || 60), 0, 240),
    lifeList: new Set(state.lifeList.species)
  };
  for (const candidate of state.results) {
    candidate.liferSpecies = params.lifeList.size
      ? Array.from(candidate.species.values()).filter((obs) => !isSeenObservation(obs, params.lifeList))
      : [];
  }
  scoreCandidates(state.results, params);
  state.results.sort((a, b) => b.score - a.score);
}

function parseLifeListText(text, fileName = "") {
  const rows = parseDelimitedRows(text);
  if (!rows.length) {
    return { source: sourceFromFileName(fileName), species: new Set(), displayNames: [] };
  }

  const header = rows[0].map(normalizeHeader);
  const hasHeader = hasLifeListHeader(header);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const source = detectLifeListSource(header, fileName);
  const indexes = {
    common: findHeaderIndex(header, ["commonname", "comname", "englishname", "taxoncommonname", "preferredcommonname", "common"]),
    scientific: findHeaderIndex(header, ["scientificname", "sciname", "taxonname", "taxonlatinname", "name", "latinname"]),
    speciesCode: findHeaderIndex(header, ["speciescode"]),
    iconic: findHeaderIndex(header, ["iconictaxonname", "iconictaxon"]),
    category: findHeaderIndex(header, ["category"])
  };
  const aliases = new Set();
  const displayNames = new Map();

  for (const row of dataRows) {
    if (!row.some((value) => String(value || "").trim())) continue;
    if (indexes.iconic >= 0 && !isBirdIconicTaxon(row[indexes.iconic])) continue;
    if (indexes.category >= 0 && row[indexes.category] && normalizeName(row[indexes.category]) !== "species") continue;

    const names = [];
    if (hasHeader) {
      names.push(row[indexes.common], row[indexes.scientific], row[indexes.speciesCode]);
    } else {
      names.push(row.find((value) => looksLikeSpeciesName(value)));
    }

    let display = cleanSpeciesName(row[indexes.common]) || cleanSpeciesName(row[indexes.scientific]);
    for (const name of names) {
      const cleaned = cleanSpeciesName(name);
      const normalized = normalizeName(cleaned);
      if (!normalized) continue;
      aliases.add(normalized);
      if (!display) display = cleaned;
    }
    if (display) displayNames.set(normalizeName(display), display);
  }

  return {
    source,
    species: aliases,
    displayNames: Array.from(displayNames.values()).sort((a, b) => a.localeCompare(b))
  };
}

function parseDelimitedRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const delimiter = detectDelimiter(text);

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows
    .map((items) => items.map((item) => item.trim()))
    .filter((items) => items.some(Boolean));
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const candidates = [",", "\t", ";"];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function hasLifeListHeader(header) {
  return header.some((name) => [
    "commonname",
    "comname",
    "scientificname",
    "sciname",
    "taxonname",
    "speciescode",
    "iconictaxonname",
    "observedon"
  ].includes(name));
}

function detectLifeListSource(header, fileName) {
  if (header.some((name) => ["iconictaxonname", "taxonid", "observedon", "qualitygrade"].includes(name))) return "iNaturalist";
  if (header.some((name) => ["speciescode", "subid", "checklistid", "locationid", "taxonomicorder"].includes(name))) return "eBird";
  return sourceFromFileName(fileName);
}

function sourceFromFileName(fileName) {
  const name = normalizeName(fileName);
  if (name.includes("inaturalist") || name.includes("inat")) return "iNaturalist";
  if (name.includes("ebird")) return "eBird";
  return "life-list";
}

function findHeaderIndex(header, options) {
  return header.findIndex((name) => options.includes(name));
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isBirdIconicTaxon(value) {
  const normalized = normalizeName(value);
  return !normalized || normalized === "aves" || normalized === "birds" || normalized === "bird";
}

function looksLikeSpeciesName(value) {
  const text = cleanSpeciesName(value);
  return text.length >= 3 && /[a-z]/i.test(text) && !/^\d+([./-]\d+)*$/.test(text);
}

function cleanSpeciesName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function clearSearchArtifacts() {
  state.results = [];
  state.selectedId = null;
  state.warnings = [];
  state.route = null;
  state.routeName = "";
  state.origin = null;
  state.destination = null;
  state.areaCenter = null;
  clearFieldErrors();
  clearWarning();
  els.report.innerHTML = "";
  els.detailsPanel.hidden = true;
  if (state.mapAdapter) state.mapAdapter.clear();
  els.resultsList.className = "results-list empty";
  els.resultsList.innerHTML = `<div class="empty-state"><i data-lucide="loader"></i><p>${state.mode === "area" ? "Searching area..." : "Searching route corridor..."}</p></div>`;
  els.notableCount.textContent = "-";
  els.hotspotCount.textContent = "-";
  els.candidateCount.textContent = "-";
  els.liferCount.textContent = state.lifeList.species.size ? "0" : "-";
  renderInsights();
  if (window.lucide) window.lucide.createIcons();
}

function setBusy(isBusy) {
  const controls = [
    ...els.form.querySelectorAll("button, input, select, textarea"),
    els.quickStartButton,
    els.downloadReportButton,
    els.settingsButton,
    els.modalSampleButton,
    els.modalExploreButton,
    els.tripName,
    els.savedTripSelect,
    els.saveTripButton,
    els.loadTripButton,
    els.deleteTripButton
  ];

  controls.forEach((control) => {
    if (control === els.maxDetour && state.mode === "area") {
      control.disabled = true;
      return;
    }
    control.disabled = isBusy;
  });
  if (!isBusy) updateSavedTripControls();
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

async function geocodeField(field, query, provider) {
  let matches;
  try {
    matches = await apiJson(`/api/geocode?q=${encodeURIComponent(query)}&provider=${provider}`);
  } catch (error) {
    setFieldError(field, `Lookup failed: ${error.message}`);
    throw new Error(`${fieldLabel(field)} lookup failed`);
  }
  if (!matches.length) {
    setFieldError(field, `No match for "${query}". Try a more specific place or "City, ST".`);
    throw new Error(`Could not geocode ${field}: ${query}`);
  }
  return matches[0];
}

function fieldLabel(field) {
  if (field === "origin" && state.mode === "area") return "Location";
  return field === "origin" ? "Origin" : "Destination";
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

function routeUrl(path, origin, destination, via, provider) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("origin", `${origin.lng},${origin.lat}`);
  url.searchParams.set("destination", `${destination.lng},${destination.lat}`);
  if (via) url.searchParams.set("via", `${via.lng},${via.lat}`);
  url.searchParams.set("provider", provider);
  return `${url.pathname}${url.search}`;
}

function renderRoute(coordinates) {
  if (state.mapAdapter) state.mapAdapter.setRoute(coordinates);
}

function renderArea(center, radiusKm) {
  if (state.mapAdapter) state.mapAdapter.setArea(center, radiusKm);
}

function updateRouteSummary(route) {
  els.routeDistance.textContent = miles(route.distanceMeters).toFixed(0);
  renderInsights();
}

function updateAreaSummary(radiusKm) {
  els.routeDistance.textContent = `${radiusKm} km`;
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
    setStatus(params.mode === "area" ? "Scanning area" : "Scanning route", `Requesting recent observations ${i * 4 + 1}-${Math.min((i + 1) * 4, samples.length)} of ${samples.length}.`);
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
          targetMatches: [],
          liferSpecies: []
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
    candidate.liferSpecies = params.lifeList?.size
      ? Array.from(candidate.species.values()).filter((obs) => !isSeenObservation(obs, params.lifeList))
      : [];
  }

  return candidates
    .filter((candidate) => candidate.species.size > 0)
    .sort((a, b) => preliminaryScore(b) - preliminaryScore(a))
    .slice(0, Math.max(params.maxStops * 3, params.maxStops));
}

function preliminaryScore(candidate) {
  return candidate.species.size * 4
    + candidate.observations.length
    + candidate.targetMatches.length * 8
    + candidate.liferSpecies.length * 6
    + Math.max(0, 20 - candidate.routeDistanceKm);
}

async function evaluateDetours(candidates, origin, destination, baseDurationSeconds, params) {
  const practical = [];
  let failed = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    setStatus("Checking detours", `Evaluating ${i + 1} of ${candidates.length}: ${candidate.name}`);
    try {
      const viaRoute = await apiJson(routeUrl("/api/route-via", origin, destination, candidate, params.mapProvider));
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
    const weightedSpecies = weightedUniqueSpecies(candidate.observations, params.recentDays);
    const weightedActivity = weightedObservationTotal(candidate.observations, params.recentDays);
    const weightedNotable = weightedUniqueSpecies(candidate.notable, params.recentDays);
    const weightedTargets = weightedTargetTotal(candidate.observations, params.targets, params.recentDays);
    const speciesScore = Math.min(weightedSpecies, 90) / 90 * 45;
    const activityScore = Math.min(weightedActivity, 250) / 250 * 15;
    const notableScore = Math.min(weightedNotable, 8) / 8 * 20;
    const targetScore = Math.min(weightedTargets, 5) / 5 * 15;
    const liferScore = params.lifeList?.size
      ? Math.min(candidate.liferSpecies.length, 8) / 8 * 18
      : 0;
    const practicalityScore = params.mode === "area"
      ? Math.max(0, 20 * (1 - candidate.routeDistanceKm / Math.max(params.radiusKm, 1)))
      : params.maxDetour === 0
        ? 20
        : Math.max(0, 20 * (1 - candidate.addedMinutes / Math.max(params.maxDetour, 1)));
    candidate.scoreParts = {
      species: speciesScore,
      activity: activityScore,
      notable: notableScore,
      targets: targetScore,
      lifers: liferScore,
      practicality: practicalityScore
    };
    candidate.score = Math.round(speciesScore + activityScore + notableScore + targetScore + liferScore + practicalityScore);
  }
}

function weightedUniqueSpecies(observations, recentDays) {
  const bySpecies = new Map();
  for (const obs of observations) {
    const species = normalizeName(obs.comName || obs.sciName);
    if (!species) continue;
    const weight = observationFreshnessWeight(obs.obsDt, recentDays);
    bySpecies.set(species, Math.max(bySpecies.get(species) || 0, weight));
  }
  return Array.from(bySpecies.values()).reduce((sum, weight) => sum + weight, 0);
}

function weightedObservationTotal(observations, recentDays) {
  return observations.reduce((sum, obs) => sum + observationFreshnessWeight(obs.obsDt, recentDays), 0);
}

function weightedTargetTotal(observations, targets, recentDays) {
  if (!targets.length) return 0;
  const targetSet = new Set(targets);
  const byTarget = new Map();
  for (const obs of observations) {
    const species = normalizeName(obs.comName || obs.sciName);
    if (!targetSet.has(species)) continue;
    const weight = observationFreshnessWeight(obs.obsDt, recentDays);
    byTarget.set(species, Math.max(byTarget.get(species) || 0, weight));
  }
  return Array.from(byTarget.values()).reduce((sum, weight) => sum + weight, 0);
}

function observationFreshnessWeight(obsDt, recentDays) {
  const observedAt = parseObservationDate(obsDt);
  if (!observedAt) return 0.5;
  const today = new Date();
  const observedDay = new Date(observedAt);
  const todayUtcMidnight = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const observedUtcMidnight = Date.UTC(
    observedDay.getFullYear(),
    observedDay.getMonth(),
    observedDay.getDate()
  );
  const ageDays = Math.max(0, Math.floor((todayUtcMidnight - observedUtcMidnight) / 86400000));
  if (ageDays <= 1) return 1;
  const searchWindow = Math.max(1, Number(recentDays) || 1);
  const staleRatio = Math.min(ageDays, searchWindow) / searchWindow;
  return clamp(1 - staleRatio * 0.75, 0.25, 1);
}

function parseObservationDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour = "0", minute = "0"] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function renderResults() {
  const isArea = state.params?.mode === "area";
  els.candidateCount.textContent = String(state.results.length);
  els.hotspotCount.textContent = String(state.results.filter(isHotspot).length);
  els.notableCount.textContent = String(state.results.reduce((sum, candidate) => sum + uniqueNotableCount(candidate), 0));
  els.liferCount.textContent = state.lifeList.species.size
    ? String(uniqueLiferCount(state.results))
    : "-";
  els.resultContext.textContent = isArea
    ? `${state.routeName}; ${state.results.length} stops within ${state.params.radiusKm} km.`
    : `${state.routeName}; ${state.results.length} stops within budget.`;
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
    const detourWrap = node.querySelector(".metric-detour-wrap");
    const offrouteWrap = node.querySelector(".metric-offroute-wrap");
    if (isArea) {
      detourWrap.title = "Distance from search center";
      offrouteWrap.title = "Search radius";
      node.querySelector(".metric-detour").textContent = `${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi`;
      node.querySelector(".metric-offroute").textContent = `${state.params.radiusKm} km`;
    } else {
      detourWrap.title = "Added drive time";
      offrouteWrap.title = "Approx. distance off route";
      node.querySelector(".metric-detour").textContent = `+${Math.round(candidate.addedMinutes)}m`;
      node.querySelector(".metric-offroute").textContent = `${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi`;
    }
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
  if (!state.mapAdapter) return;
  state.mapAdapter.setMarkers(state.results, state.selectedId, selectCandidate);
}

function selectCandidate(id) {
  const candidate = state.results.find((item) => item.id === id);
  if (!candidate) return;
  state.selectedId = id;
  renderDetails(candidate);
  els.detailsPanel.hidden = false;
  updateSelectedCard();
  renderMarkers();
  if (state.mapAdapter) state.mapAdapter.flyTo(candidate, 11);
}

function renderDetails(candidate) {
  const isArea = state.params?.mode === "area";
  const species = groupSpecies(candidate).slice(0, 80);
  const notable = candidate.notable.slice(0, 20);
  const lifers = candidate.liferSpecies.slice(0, 30);
  const links = candidateLinks(candidate);
  const offRouteMi = formatMiles(kmToMiles(candidate.routeDistanceKm));

  els.detailsContent.innerHTML = `
    <h3>${escapeHtml(candidate.name)}</h3>
    <p class="detail-subtitle">${candidate.score} score; ${isArea ? `${offRouteMi} mi from ${escapeHtml(state.routeName)}.` : `+${Math.round(candidate.addedMinutes)} min and +${candidate.addedMiles.toFixed(1)} mi detour.`}</p>
    <div class="detail-grid">
      <div><b>${candidate.species.size}</b><small>recent species</small></div>
      <div><b>${candidate.observations.length}</b><small>records</small></div>
      <div><b>${uniqueNotableCount(candidate)}</b><small>notable species</small></div>
      <div><b>${candidate.targetMatches.length}</b><small>target matches</small></div>
      <div><b>${candidate.liferSpecies.length}</b><small>likely lifers</small></div>
    </div>
    <section class="score-line">
      <h4>${isArea ? "Area position" : "Route impact"}</h4>
      <div class="impact-list">
        ${isArea ? `
          <div class="impact-row"><span>Distance from center</span><b>~${offRouteMi} mi</b></div>
          <div class="impact-row"><span>Search radius</span><b>${state.params.radiusKm} km</b></div>
        ` : `
          <div class="impact-row"><span>Added time</span><b>+${Math.round(candidate.addedMinutes)} min</b></div>
          <div class="impact-row"><span>Added distance</span><b>+${candidate.addedMiles.toFixed(1)} mi</b></div>
          <div class="impact-row"><span>Off route (approx.)</span><b>~${offRouteMi} mi</b></div>
        `}
      </div>
    </section>
    <section class="score-line">
      <h4>Score</h4>
      <div class="score-bars">
        ${scoreRow("Species", candidate.scoreParts.species, 45)}
        ${scoreRow("Activity", candidate.scoreParts.activity, 15)}
        ${scoreRow("Notable", candidate.scoreParts.notable, 20)}
        ${scoreRow("Targets", candidate.scoreParts.targets, 15)}
        ${scoreRow("Lifers", candidate.scoreParts.lifers, 18)}
        ${scoreRow(isArea ? "Proximity" : "Route", candidate.scoreParts.practicality, 20)}
      </div>
    </section>
    ${lifers.length ? `
      <section class="species-list">
        <h4>Likely Lifers</h4>
        <ul>${lifers.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")} <small>${escapeHtml(obs.obsDt || "")}</small></li>`).join("")}</ul>
      </section>
    ` : ""}
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
  if (candidate.liferSpecies.length) return "marker-lifer";
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
  if (candidate.liferSpecies.length) chips.push(`<span class="stop-chip chip-lifer">${candidate.liferSpecies.length} lifer</span>`);
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

function isSeenObservation(obs, lifeList) {
  return observationAliases(obs).some((alias) => lifeList.has(alias));
}

function observationAliases(obs) {
  return [
    obs.comName,
    obs.sciName,
    obs.speciesCode
  ].map((value) => normalizeName(value)).filter(Boolean);
}

function renderInsights() {
  const liveDetour = clamp(Number(els.maxDetour.value || 60), 0, 240);
  const liveTargets = parseTargetsInput();
  const hasToken = Boolean(els.apiToken.value.trim());
  const lifeListCount = state.lifeList.displayNames.length || state.lifeList.species.size;
  if (state.mode === "area") {
    els.tripPlanSummary.textContent = state.areaCenter
      ? `${state.routeName}: searching hotspots within ${state.params?.radiusKm || els.radiusKm.value || 25} km.`
      : "Set a city, park, or lodging location to rank nearby birding stops.";
  } else {
    els.tripPlanSummary.textContent = state.route
      ? `${state.routeName}: ${miles(state.route.distanceMeters).toFixed(0)} miles, ${formatMinutes(state.route.durationSeconds / 60)} drive time, ${liveDetour} min detour budget.`
      : "Set a route to compare drive time, detour budget, and ranked birding stops.";
  }

  if (liveTargets.length || lifeListCount) {
    const targetText = liveTargets.length
      ? `${liveTargets.length} target species queued`
      : "No target species queued";
    const lifeText = lifeListCount
      ? `${lifeListCount} imported life-list species will be treated as already seen`
      : "no life list imported";
    els.targetSpeciesSummary.textContent = `${targetText}; ${lifeText}.`;
  } else {
    els.targetSpeciesSummary.textContent = `Add targets or import a life list to highlight matching reports ${state.mode === "area" ? "nearby" : "along the corridor"}.`;
  }

  if (state.results.length) {
    const speciesCount = state.results.reduce((sum, candidate) => sum + candidate.species.size, 0);
    const notableCount = state.results.reduce((sum, candidate) => sum + uniqueNotableCount(candidate), 0);
    const liferCount = uniqueLiferCount(state.results);
    els.sightingSummary.textContent = `${speciesCount} recent species across ${state.results.length} ranked stops, including ${notableCount} notable species${state.lifeList.species.size ? ` and ${liferCount} likely lifers` : ""}.`;
  } else {
    const searchedWithoutToken = state.mode === "area" ? state.areaCenter && !hasToken : state.route && !hasToken;
    els.sightingSummary.textContent = searchedWithoutToken
      ? `${state.mode === "area" ? "Area" : "Route"} is ready. Add an eBird token to load recent sightings and notable reports.`
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
  const provider = state.params?.mapProvider || state.provider;
  const mapsUrl = provider === "google"
    ? `https://www.google.com/maps/dir/?api=1&destination=${candidate.lat},${candidate.lng}`
    : osmDirectionsUrl(candidate);
  return {
    ebirdUrl: candidate.locId
      ? `https://ebird.org/hotspot/${encodeURIComponent(candidate.locId)}`
      : `https://ebird.org/map?lat=${candidate.lat}&lng=${candidate.lng}`,
    mapsUrl
  };
}

function osmDirectionsUrl(candidate) {
  const url = new URL("https://www.openstreetmap.org/directions");
  if (state.origin) {
    url.searchParams.set("route", `${state.origin.lat},${state.origin.lng};${candidate.lat},${candidate.lng}`);
  } else {
    url.searchParams.set("to", `${candidate.lat},${candidate.lng}`);
  }
  return url.toString();
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

function uniqueLiferCount(candidates) {
  const seen = new Set();
  for (const candidate of candidates) {
    for (const obs of candidate.liferSpecies || []) {
      const key = normalizeName(obs.comName || obs.sciName || obs.speciesCode);
      if (key) seen.add(key);
    }
  }
  return seen.size;
}

function renderReport() {
  if (!els.report) return;
  if (!hasReportableSearch()) {
    els.report.innerHTML = "";
    return;
  }
  els.report.innerHTML = buildReportMarkup();
}

function buildReportMarkup() {
  const p = state.params;
  const route = state.route;
  const isArea = p.mode === "area";
  const generated = new Date().toLocaleString();
  const param = (label, value, options = {}) => {
    const renderedValue = options.raw ? String(value) : escapeHtml(String(value));
    return `<div><dt>${escapeHtml(label)}</dt><dd>${renderedValue}</dd></div>`;
  };

  const paramsBlock = `
    <h2>Search parameters</h2>
    <dl class="report-params">
      ${param(isArea ? "Location" : "Origin", p.origin)}
      ${isArea ? "" : param("Destination", p.destination)}
      ${param("Map service", providerLabel(p.mapProvider))}
      ${isArea ? "" : param("Max added", `${p.maxDetour} min`)}
      ${param(isArea ? "Area radius" : "Corridor radius", `${p.radiusKm} km`)}
      ${param("Recent window", `${p.recentDays} days`)}
      ${param("Max stops", p.maxStops)}
      ${param("Targets", p.targets.length ? p.targets.join(", ") : "none")}
      ${param("Life list", state.lifeList.species.size ? `${state.lifeList.displayNames.length || state.lifeList.species.size} species from ${state.lifeList.fileName || state.lifeList.source || "import"}` : "none")}
    </dl>`;

  const summaryBlock = isArea ? `
    <h2>Area summary</h2>
    <dl class="report-route">
      ${param("Location", state.routeName || p.origin)}
      ${param("Radius", `${p.radiusKm} km`)}
      ${param("Ranked stops", state.results.length)}
    </dl>` : `
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
        const links = candidateLinks(candidate);
        return `
          <div class="report-stop">
            <h3>${index + 1}. ${escapeHtml(candidate.name)}</h3>
            <p class="report-stop-meta">
              Score ${candidate.score} ·
              ${isArea
                ? `~${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi from center ·`
                : `+${Math.round(candidate.addedMinutes)} min · +${candidate.addedMiles.toFixed(1)} mi detour · ~${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi off route ·`}
              ${candidate.species.size} species ·
              ${uniqueNotableCount(candidate)} notable ·
              ${candidate.targetMatches.length} targets ·
              ${candidate.liferSpecies.length} likely lifers
            </p>
            <dl class="report-stop-route">
              ${param("Coordinates", `${candidate.lat.toFixed(5)}, ${candidate.lng.toFixed(5)}`)}
              ${param("Directions", `<a href="${escapeHtml(links.mapsUrl)}">${escapeHtml(links.mapsUrl)}</a>`, { raw: true })}
              ${param("eBird", `<a href="${escapeHtml(links.ebirdUrl)}">${escapeHtml(links.ebirdUrl)}</a>`, { raw: true })}
            </dl>
            ${candidate.liferSpecies.length ? `<h4>Likely lifers</h4><ul>${candidate.liferSpecies.slice(0, 20).map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")}</li>`).join("")}</ul>` : ""}
            ${candidate.targetMatches.length ? `<h4>Target matches</h4><ul>${candidate.targetMatches.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")}</li>`).join("")}</ul>` : ""}
            ${notable.length ? `<h4>Notable</h4><ul>${notable.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")} <small>${escapeHtml(obs.obsDt || "")}</small></li>`).join("")}</ul>` : ""}
            <h4>Recent species</h4>
            <ul>${species.map((sp) => `<li>${escapeHtml(sp.name)} <small>×${sp.count}</small></li>`).join("")}</ul>
          </div>`;
      }).join("")}`
    : `<h2>Ranked stops</h2><p>No stops matched the current ${isArea ? "area settings" : "detour budget"}.</p>`;

  return `
    <h1>Birdtrip ${isArea ? "Area" : "Trip"} Report</h1>
    <p class="report-sub">${escapeHtml(state.routeName || "")} · Generated ${escapeHtml(generated)}</p>
    ${paramsBlock}
    ${summaryBlock}
    ${stopsBlock}
  `;
}

function downloadHtmlReport() {
  if (!hasReportableSearch()) {
    setStatus("Nothing to export", `Run a ${state.mode === "area" ? "area" : "route"} search before downloading a report.`);
    return;
  }

  renderReport();
  const documentHtml = buildStandaloneReportDocument(buildReportMarkup());
  const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = reportFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Report downloaded", "Saved a standalone HTML trip report for offline reference.");
}

function buildStandaloneReportDocument(reportMarkup) {
  const title = state.routeName
    ? `Birdtrip - ${state.routeName}`
    : `Birdtrip ${state.params?.mode === "area" ? "Area" : "Trip"} Report`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${reportDocumentCss()}
  </style>
</head>
<body>
  <main class="report">
${reportMarkup}
  </main>
</body>
</html>
`;
}

function reportDocumentCss() {
  return `
:root {
  --line: #d9e2ec;
  --line-strong: #b8c4d2;
  --text: #10201a;
  --muted: #64748b;
  --muted-strong: #405569;
  --panel-soft: #f8fafc;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--text);
  background: #f8fafc;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.45;
}

a {
  color: #065f46;
  overflow-wrap: anywhere;
}

.report {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 22px 48px;
  background: white;
}

.report h1 {
  font-size: 1.5rem;
  margin: 0 0 4px;
}

.report .report-sub {
  color: var(--muted);
  margin: 0 0 18px;
}

.report h2 {
  font-size: 1.05rem;
  margin: 22px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line-strong);
}

.report .report-params,
.report .report-route,
.report .report-stop-route {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 18px;
  margin: 0;
}

.report .report-stop-route {
  grid-template-columns: minmax(120px, 0.6fr) repeat(2, minmax(0, 1fr));
  padding: 8px;
  border-radius: 8px;
  background: var(--panel-soft);
}

.report dt {
  color: var(--muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 800;
}

.report dd {
  margin: 1px 0 0;
  font-weight: 700;
}

.report .report-stop {
  break-inside: avoid;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 10px 0;
}

.report .report-stop h3 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.report .report-stop .report-stop-meta {
  color: var(--muted-strong);
  font-size: 0.85rem;
  margin: 0 0 8px;
}

.report .report-stop ul {
  margin: 4px 0 0;
  padding-left: 18px;
  font-size: 0.85rem;
  columns: 2;
}

.report .report-stop h4 {
  margin: 10px 0 2px;
  font-size: 0.82rem;
  text-transform: uppercase;
  color: var(--muted);
}

@media (max-width: 720px) {
  .report .report-params,
  .report .report-route,
  .report .report-stop-route {
    grid-template-columns: 1fr;
  }

  .report .report-stop ul {
    columns: 1;
  }
}

@media print {
  body {
    background: white;
  }

  .report {
    max-width: none;
    padding: 0;
  }
}
`;
}

function reportFileName() {
  const fallback = state.params?.mode === "area"
    ? state.params.origin
    : `${state.params.origin} to ${state.params.destination}`;
  const base = slugify(state.routeName || fallback) || `${state.params?.mode === "area" ? "area" : "trip"}-report`;
  const date = new Date().toISOString().slice(0, 10);
  return `birdtrip-${base}-${date}.html`;
}

function hasReportableSearch() {
  if (!state.params) return false;
  return state.params.mode === "area" ? Boolean(state.areaCenter) : Boolean(state.route);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

class LeafletMapAdapter {
  constructor(container) {
    this.provider = "osm";
    this.container = container;
    this.map = null;
    this.routeLayer = null;
    this.areaLayer = null;
    this.markerLayer = null;
  }

  init() {
    this.map = L.map(this.container, { zoomControl: true }).setView([33.45, -112.07], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);
  }

  setRoute(coordinates) {
    if (this.areaLayer) {
      this.map.removeLayer(this.areaLayer);
      this.areaLayer = null;
    }
    if (this.routeLayer) this.map.removeLayer(this.routeLayer);
    const latLngs = coordinates.map(([lng, lat]) => [lat, lng]);
    this.routeLayer = L.polyline(latLngs, {
      color: "#3b82f6",
      weight: 5,
      opacity: 0.86
    }).addTo(this.map);
    this.map.fitBounds(this.routeLayer.getBounds(), { padding: [34, 34] });
  }

  setArea(center, radiusKm) {
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    if (this.areaLayer) this.map.removeLayer(this.areaLayer);
    const circle = L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: "#3b82f6",
      weight: 2,
      opacity: 0.75,
      fillColor: "#3b82f6",
      fillOpacity: 0.08
    });
    const centerMarker = L.circleMarker([center.lat, center.lng], {
      radius: 6,
      color: "#065f46",
      weight: 3,
      fillColor: "#10b981",
      fillOpacity: 0.95
    }).bindPopup(`<strong>${escapeHtml(shortName(center.name) || "Search center")}</strong>`);
    this.areaLayer = L.featureGroup([circle, centerMarker]).addTo(this.map);
    this.map.fitBounds(circle.getBounds(), { padding: [34, 34] });
  }

  setMarkers(results, selectedId, onSelect) {
    this.markerLayer.clearLayers();
    results.forEach((candidate, index) => {
      const marker = L.marker([candidate.lat, candidate.lng], {
        icon: L.divIcon({
          className: "",
          html: markerHtml(candidate, index, selectedId),
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      });
      marker.bindPopup(markerPopup(candidate));
      marker.on("click", () => onSelect(candidate.id));
      marker.addTo(this.markerLayer);
    });
  }

  flyTo(candidate, minZoom) {
    this.map.flyTo([candidate.lat, candidate.lng], Math.max(this.map.getZoom(), minZoom), { duration: 0.6 });
  }

  clear() {
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    if (this.areaLayer) {
      this.map.removeLayer(this.areaLayer);
      this.areaLayer = null;
    }
    if (this.markerLayer) this.markerLayer.clearLayers();
  }

  destroy() {
    this.clear();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}

class GoogleMapAdapter {
  constructor(container) {
    this.provider = "google";
    this.container = container;
    this.map = null;
    this.routeLayer = null;
    this.areaCircle = null;
    this.areaMarker = null;
    this.markers = [];
    this.infoWindow = null;
  }

  init() {
    const maps = window.google.maps;
    this.map = new maps.Map(this.container, {
      center: { lat: 33.45, lng: -112.07 },
      zoom: 7,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false
    });
    this.infoWindow = new maps.InfoWindow();
  }

  setRoute(coordinates) {
    if (this.areaCircle) {
      this.areaCircle.setMap(null);
      this.areaCircle = null;
    }
    if (this.areaMarker) {
      this.areaMarker.setMap(null);
      this.areaMarker = null;
    }
    if (this.routeLayer) this.routeLayer.setMap(null);
    const path = coordinates.map(([lng, lat]) => ({ lat, lng }));
    const maps = window.google.maps;
    this.routeLayer = new maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.86,
      strokeWeight: 5,
      map: this.map
    });
    const bounds = new maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    this.map.fitBounds(bounds, 34);
  }

  setArea(center, radiusKm) {
    if (this.routeLayer) {
      this.routeLayer.setMap(null);
      this.routeLayer = null;
    }
    if (this.areaCircle) this.areaCircle.setMap(null);
    if (this.areaMarker) this.areaMarker.setMap(null);
    const maps = window.google.maps;
    this.areaCircle = new maps.Circle({
      strokeColor: "#3b82f6",
      strokeOpacity: 0.75,
      strokeWeight: 2,
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
      map: this.map,
      center: { lat: center.lat, lng: center.lng },
      radius: radiusKm * 1000
    });
    this.areaMarker = new maps.Marker({
      position: { lat: center.lat, lng: center.lng },
      map: this.map,
      title: shortName(center.name) || "Search center"
    });
    this.map.fitBounds(this.areaCircle.getBounds(), 34);
  }

  setMarkers(results, selectedId, onSelect) {
    this.markers.forEach((marker) => marker.setMap(null));
    const HtmlMarker = ensureGoogleHtmlMarkerClass();
    this.markers = results.map((candidate, index) => {
      const marker = new HtmlMarker({
        position: { lat: candidate.lat, lng: candidate.lng },
        html: markerHtml(candidate, index, selectedId),
        onClick: () => {
          this.infoWindow.setContent(markerPopup(candidate));
          this.infoWindow.setPosition({ lat: candidate.lat, lng: candidate.lng });
          this.infoWindow.open({ map: this.map });
          onSelect(candidate.id);
        }
      });
      marker.setMap(this.map);
      return marker;
    });
  }

  flyTo(candidate, minZoom) {
    this.map.panTo({ lat: candidate.lat, lng: candidate.lng });
    if (this.map.getZoom() < minZoom) this.map.setZoom(minZoom);
  }

  clear() {
    if (this.routeLayer) {
      this.routeLayer.setMap(null);
      this.routeLayer = null;
    }
    if (this.areaCircle) {
      this.areaCircle.setMap(null);
      this.areaCircle = null;
    }
    if (this.areaMarker) {
      this.areaMarker.setMap(null);
      this.areaMarker = null;
    }
    this.markers.forEach((marker) => marker.setMap(null));
    this.markers = [];
    if (this.infoWindow) this.infoWindow.close();
  }

  destroy() {
    this.clear();
    this.map = null;
    this.container.innerHTML = "";
  }
}

let GoogleHtmlMarkerClass = null;

function ensureGoogleHtmlMarkerClass() {
  if (GoogleHtmlMarkerClass) return GoogleHtmlMarkerClass;
  GoogleHtmlMarkerClass = class extends window.google.maps.OverlayView {
    constructor({ position, html, onClick }) {
      super();
      this.position = position;
      this.html = html;
      this.onClick = onClick;
      this.el = null;
    }

    onAdd() {
      this.el = document.createElement("button");
      this.el.type = "button";
      this.el.className = "google-html-marker";
      this.el.innerHTML = this.html;
      this.el.addEventListener("click", this.onClick);
      this.getPanes().overlayMouseTarget.appendChild(this.el);
    }

    draw() {
      if (!this.el) return;
      const position = new window.google.maps.LatLng(this.position.lat, this.position.lng);
      const point = this.getProjection().fromLatLngToDivPixel(position);
      if (!point) return;
      this.el.style.left = `${point.x}px`;
      this.el.style.top = `${point.y}px`;
    }

    onRemove() {
      if (!this.el) return;
      this.el.removeEventListener("click", this.onClick);
      this.el.remove();
      this.el = null;
    }
  };
  return GoogleHtmlMarkerClass;
}

function markerHtml(candidate, index, selectedId) {
  return `<div class="bird-marker ${markerClass(candidate)} ${candidate.id === selectedId ? "marker-selected" : ""}">${index + 1}</div>`;
}

function markerPopup(candidate) {
  const impact = state.params?.mode === "area"
    ? `${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi from center`
    : `+${Math.round(candidate.addedMinutes)} min`;
  return `<strong>${escapeHtml(candidate.name)}</strong><br>${candidate.score} score; ${impact}<br>${candidate.species.size} recent species`;
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

init();
