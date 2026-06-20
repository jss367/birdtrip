const state = {
  mode: "route",
  mapAdapter: null,
  route: null,
  routeName: "",
  results: [],
  selectedId: null,
  savedTrips: [],
  comparisonIds: [],
  pinnedIds: [],
  pendingPinnedIds: [],
  itinerary: null,
  itineraryRequestId: 0,
  warnings: [],
  params: null,
  origin: null,
  destination: null,
  areaCenter: null,
  species: null,
  sightings: [],
  sightingLocations: [],
  selectedSightingId: null,
  provider: "osm",
  userSelectedProvider: false,
  lifeList: {
    source: "",
    fileName: "",
    importedAt: "",
    species: new Set(),
    displayNames: []
  },
  config: {
    defaultMapProvider: "osm",
    ebirdConfigured: null,
    providers: {
      osm: { enabled: true },
      google: { enabled: false, browserKey: "", serverConfigured: false }
    },
    ebird: {
      serverConfigured: false
    }
  },
  configReady: null
};

const els = {
  quickStartButton: document.querySelector("#quickStartButton"),
  shareTripButton: document.querySelector("#shareTripButton"),
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
  speciesField: document.querySelector("#speciesField"),
  speciesQuery: document.querySelector("#speciesQuery"),
  speciesSuggestions: document.querySelector("#speciesSuggestions"),
  speciesHint: document.querySelector("#speciesHint"),
  speciesError: document.querySelector("#speciesError"),
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
  routeTradeoffPanel: document.querySelector("#routeTradeoffPanel"),
  routeTradeoffTitle: document.querySelector("#routeTradeoffTitle"),
  routeTradeoffSummary: document.querySelector("#routeTradeoffSummary"),
  fastestRouteTime: document.querySelector("#fastestRouteTime"),
  fastestRouteMeta: document.querySelector("#fastestRouteMeta"),
  birdingRouteTime: document.querySelector("#birdingRouteTime"),
  birdingRouteMeta: document.querySelector("#birdingRouteMeta"),
  birdingRouteExtra: document.querySelector("#birdingRouteExtra"),
  birdingValuePerMinute: document.querySelector("#birdingValuePerMinute"),
  budgetUnlocks: document.querySelector("#budgetUnlocks"),
  previewBirdingRouteButton: document.querySelector("#previewBirdingRouteButton"),
  pinBirdingRouteButton: document.querySelector("#pinBirdingRouteButton"),
  compareBirdingRouteButton: document.querySelector("#compareBirdingRouteButton"),
  comparisonPanel: document.querySelector("#comparisonPanel"),
  comparisonSummary: document.querySelector("#comparisonSummary"),
  comparisonContent: document.querySelector("#comparisonContent"),
  clearComparisonButton: document.querySelector("#clearComparisonButton"),
  itineraryBuilder: document.querySelector("#itineraryBuilder"),
  itinerarySummary: document.querySelector("#itinerarySummary"),
  itineraryList: document.querySelector("#itineraryList"),
  itineraryStopCount: document.querySelector("#itineraryStopCount"),
  itineraryAddedTime: document.querySelector("#itineraryAddedTime"),
  itineraryTotalDrive: document.querySelector("#itineraryTotalDrive"),
  clearItinerary: document.querySelector("#clearItinerary"),
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
  mapAreaLegend: document.querySelector("#mapAreaLegend"),
  originSuggestions: document.querySelector("#originSuggestions"),
  destinationSuggestions: document.querySelector("#destinationSuggestions"),
  useCurrentLocationButton: document.querySelector("#useCurrentLocationButton"),
  useCurrentLocationLabel: document.querySelector("#useCurrentLocationLabel")
};

const autocomplete = {
  origin: { listEl: null, timer: 0, controller: null, items: [], activeIndex: -1, resolved: null, lastQuery: "" },
  destination: { listEl: null, timer: 0, controller: null, items: [], activeIndex: -1, resolved: null, lastQuery: "" }
};

const speciesAutocomplete = { timer: 0, controller: null, items: [], activeIndex: -1, lastQuery: "" };

const PREF_FIELDS = ["origin", "destination", "mapProvider", "maxDetour", "recentDays", "radiusKm", "maxStops", "targets", "speciesQuery"];

function normalizeMode(mode) {
  return mode === "area" || mode === "species" ? mode : "route";
}
const SAVED_TRIPS_KEY = "birdtripSavedTrips";
const CONFIG_WAIT_TIMEOUT_MS = 6000;
const SHARE_URL_VERSION = "1";

function init() {
  const sharedSearch = readSharedSearchFromUrl();
  const saved = restorePreferences();
  state.savedTrips = readSavedTrips();
  state.mode = normalizeMode(sharedSearch?.mode || saved.searchMode);
  const preferredProvider = sharedSearch?.mapProvider || (typeof saved.mapProvider === "string" ? providerFromInput() : null);
  state.provider = preferredProvider || "osm";
  setupProviderControl();
  setSearchMode(state.mode, { persist: false });
  if (sharedSearch) applySharedSearch(sharedSearch);
  updateSetupStatus();
  updateInputSummaries();
  renderSavedTrips();
  const configReady = loadAppConfig();
  state.configReady = configReady;
  configReady.then(() => {
    if (!state.configReady) reapplyStartupProvider(preferredProvider);
  });
  initializeStartupMap(preferredProvider, sharedSearch);

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
  els.mapProvider.addEventListener("change", () => {
    state.userSelectedProvider = true;
    setMapProvider(providerFromInput());
  });
  els.targets.addEventListener("input", updateInputSummaries);
  els.lifeListInput.addEventListener("change", handleLifeListFile);
  els.clearLifeListButton.addEventListener("click", clearLifeList);
  els.maxDetour.addEventListener("input", updateInputSummaries);
  els.quickStartButton.addEventListener("click", openQuickStart);
  els.shareTripButton.addEventListener("click", shareCurrentTrip);
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
    const needsToken = !shouldAttemptEbirdSearch();
    setStatus(
      needsToken ? "Explore without setup" : "Ready",
      needsToken
        ? "Enter a route to preview distance and drive time. Add an eBird token when you want live bird rankings."
        : "Enter a route to load recent sightings and notable reports."
    );
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
  els.clearComparisonButton.addEventListener("click", clearComparison);
  els.clearItinerary.addEventListener("click", clearPinnedStops);
  els.previewBirdingRouteButton.addEventListener("click", previewBestBirdingRoute);
  els.pinBirdingRouteButton.addEventListener("click", pinBestBirdingRoute);
  els.compareBirdingRouteButton.addEventListener("click", compareBestBirdingRoute);
  window.addEventListener("beforeprint", renderReport);
  els.closeDetails.addEventListener("click", () => {
    els.detailsPanel.hidden = true;
    state.selectedId = null;
    updateSelectedCard();
    renderMarkers();
  });

  setupLocationAutocomplete("origin");
  setupLocationAutocomplete("destination");
  setupSpeciesAutocomplete();
  document.addEventListener("click", handleAutocompleteOutsideClick);
  els.useCurrentLocationButton.addEventListener("click", useCurrentLocationForOrigin);

  renderItineraryBuilder();
  renderComparison();
  if (window.lucide) window.lucide.createIcons();
}

async function initializeStartupMap(preferredProvider, sharedSearch) {
  try {
    await setMapProvider("osm", { persist: false, preserveData: false });
  } catch (error) {
    setStatus("Map setup failed", error.message || "The map could not be initialized.");
    console.error(error);
  }

  await waitForAppConfig();
  try {
    await setMapProvider(resolveProvider(preferredProvider || state.config.defaultMapProvider || providerFromInput()), { persist: false });
  } catch (error) {
    addWarning(`Map could not be initialized: ${error.message}. Searches can continue with the current setup.`);
    renderWarnings();
  }
  if (sharedSearch?.autoRun && hasRunnableSearchInputs()) {
    setStatus("Refreshing shared trip", "Loading the route and latest birding stops from this link.");
    await runSearch({ persistPreferences: false });
  }
}

async function reapplyStartupProvider(preferredProvider) {
  if (state.userSelectedProvider) return;
  const nextProvider = resolveProvider(preferredProvider || state.config.defaultMapProvider || providerFromInput());
  if (state.provider === nextProvider) return;
  try {
    await setMapProvider(nextProvider, { persist: false });
  } catch (error) {
    addWarning(`Map could not be initialized: ${error.message}. Searches can continue with the current setup.`);
    renderWarnings();
  }
}

function readSharedSearchFromUrl() {
  const search = new URLSearchParams(window.location.search);
  if (search.get("bt") !== SHARE_URL_VERSION) return null;

  const mode = normalizeMode(search.get("mode"));
  const shared = {
    mode,
    origin: cleanSharedText(search.get("origin"), 160),
    destination: cleanSharedText(search.get("destination"), 160),
    species: cleanSharedText(search.get("species"), 80),
    mapProvider: search.get("mapProvider") === "google" ? "google" : "osm",
    maxDetour: cleanSharedNumber(search.get("maxDetour"), 0, 240),
    recentDays: cleanSharedNumber(search.get("recentDays"), 1, 30),
    radiusKm: cleanSharedNumber(search.get("radiusKm"), 1, 50),
    maxStops: cleanSharedNumber(search.get("maxStops"), 3, 20),
    targets: cleanSharedTargets(search.get("targets"), 1200),
    pins: cleanSharedIdList(search.getAll("pin"), 5),
    autoRun: search.get("run") === "1"
  };
  return shared.origin ? shared : null;
}

function applySharedSearch(shared) {
  setSearchMode(shared.mode, { persist: false });
  if (shared.origin) els.origin.value = shared.origin;
  if (shared.mode !== "route") {
    els.destination.value = "";
  } else if (shared.destination) {
    els.destination.value = shared.destination;
  }
  if (shared.mode === "species" && shared.species) {
    els.speciesQuery.value = shared.species;
    state.species = null;
  }
  if (shared.mapProvider) els.mapProvider.value = shared.mapProvider;
  if (shared.maxDetour) els.maxDetour.value = shared.maxDetour;
  if (shared.recentDays) els.recentDays.value = shared.recentDays;
  if (shared.radiusKm) els.radiusKm.value = shared.radiusKm;
  if (shared.maxStops) els.maxStops.value = shared.maxStops;
  if (shared.targets) els.targets.value = shared.targets;
  state.pendingPinnedIds = shared.pins || [];
  updateInputSummaries();
  setStatus(
    "Shared trip loaded",
    shared.autoRun ? "Refreshing this shared trip." : "Review the shared settings, then run a search."
  );
}

function cleanSharedText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanSharedTargets(value, maxLength) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, maxLength);
}

function cleanSharedIdList(values, maxItems) {
  return values
    .map((item) => item.trim())
    .filter((item) => /^[\w:.,-]{1,80}$/.test(item))
    .slice(0, maxItems);
}

function cleanSharedNumber(value, min, max) {
  if (value === null) return "";
  const number = clamp(Number(value), min, max);
  return Number.isFinite(number) ? String(number) : "";
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
  state.mode = normalizeMode(mode);
  const isArea = state.mode === "area";
  const isSpecies = state.mode === "species";
  const isAreaLike = isArea || isSpecies;
  els.form.dataset.mode = state.mode;

  els.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  els.locationGroupTitle.textContent = isSpecies ? "Species" : isArea ? "Area" : "Route";
  els.originLabelText.textContent = isAreaLike ? "Location" : "Origin";
  els.origin.placeholder = isAreaLike ? "City, park, hotel, or address" : "";
  els.speciesField.hidden = !isSpecies;
  els.destinationField.hidden = isAreaLike;
  els.destination.required = !isAreaLike;
  els.maxDetourLabel.textContent = isAreaLike ? "Area limit" : "Max added";
  els.maxDetourUnit.textContent = isAreaLike ? "off" : "min";
  els.maxDetour.disabled = isAreaLike;
  els.submitLabel.textContent = isSpecies ? "Map Sightings" : isArea ? "Search Area" : "Find Stops";
  els.routeDistanceLabel.textContent = isSpecies ? "Search Radius" : isArea ? "Area Radius" : "Route Miles";
  els.maxAddedLabel.textContent = isSpecies ? "Species Mode" : isArea ? "Area Mode" : "Added Time Budget";
  els.mapAreaLegend.textContent = isAreaLike ? "Search area" : "Route corridor";
  els.sampleButton.title = isSpecies ? "Use sample species search" : isArea ? "Use sample area" : "Use sample route";
  if (els.progressTitle.textContent === "Ready") {
    if (isSpecies) {
      els.progressMessage.textContent = "Pick a species and a location, then map every recent sighting.";
    } else if (isArea) {
      els.progressMessage.textContent = "Enter a city, park, or lodging location and run a search.";
    }
  }

  clearFieldErrors();
  if (persist && previousMode !== state.mode && (state.route || state.areaCenter || state.results.length || state.sightings.length)) {
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
    state: serializeTripState()
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
  if (isObjectRecord(state.params)) {
    return {
      origin: typeof state.params.origin === "string" ? state.params.origin : els.origin.value,
      destination: typeof state.params.destination === "string" ? state.params.destination : els.destination.value,
      mapProvider: typeof state.params.mapProvider === "string" ? state.params.mapProvider : state.provider,
      maxDetour: Number.isFinite(state.params.maxDetour) ? String(state.params.maxDetour) : els.maxDetour.value,
      recentDays: Number.isFinite(state.params.recentDays) ? String(state.params.recentDays) : els.recentDays.value,
      radiusKm: Number.isFinite(state.params.radiusKm) ? String(state.params.radiusKm) : els.radiusKm.value,
      maxStops: Number.isFinite(state.params.maxStops) ? String(state.params.maxStops) : els.maxStops.value,
      targets: Array.isArray(state.params.targets) ? state.params.targets.join("\n") : els.targets.value,
      searchMode: typeof state.params.mode === "string" ? state.params.mode : state.mode
    };
  }

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
    liferSpecies: candidate.liferSpecies,
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
  state.comparisonIds = [];
  state.pinnedIds = [];
  state.pendingPinnedIds = [];
  state.itinerary = null;
  state.itineraryRequestId += 1;

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
    els.liferCount.textContent = state.lifeList.species.size ? "0" : "-";
    els.resultContext.textContent = state.routeName ? `${state.routeName}; no saved stops.` : "No route searched yet.";
  }

  renderRouteTradeoff();
  renderComparison();
  renderItineraryBuilder();
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
    liferSpecies: Array.isArray(candidate.liferSpecies)
      ? candidate.liferSpecies.filter(isObjectRecord)
      : [],
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

async function loadAppConfig() {
  try {
    const config = await apiJson("/api/config");
    const ebirdServerConfigured = Boolean(config.ebirdConfigured || config.ebird?.serverConfigured);
    state.config = {
      ...state.config,
      ...config,
      ebirdConfigured: ebirdServerConfigured,
      providers: {
        ...state.config.providers,
        ...(config.providers || {})
      },
      ebird: {
        ...state.config.ebird,
        ...(config.ebird || {}),
        serverConfigured: ebirdServerConfigured
      }
    };
  } catch (error) {
    state.config = {
      ...state.config,
      ebirdConfigured: false,
      ebird: {
        ...state.config.ebird,
        serverConfigured: false
      }
    };
    addWarning(`Map service setup could not be checked: ${error.message}`);
    renderWarnings();
  }
  setupProviderControl();
  updateSetupStatus();
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
  const itineraryCoordinates = preserveData ? state.itinerary?.route?.geometry?.coordinates : null;
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
  if (itineraryCoordinates) renderItineraryRoute(itineraryCoordinates);
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
  if (state.mode === "species") {
    els.origin.value = "Papago Park, Phoenix, AZ";
    els.speciesQuery.value = "Rosy-faced Lovebird";
    state.species = null;
    els.recentDays.value = "14";
    els.radiusKm.value = "25";
    resetAutocomplete("origin");
    updateInputSummaries();
    return;
  }
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
  resetAutocomplete("origin");
  resetAutocomplete("destination");
  updateInputSummaries();
}

function resetAutocomplete(field) {
  const ctx = autocomplete[field];
  if (!ctx) return;
  if (ctx.timer) {
    clearTimeout(ctx.timer);
    ctx.timer = 0;
  }
  ctx.resolved = null;
  ctx.items = [];
  ctx.activeIndex = -1;
  ctx.lastQuery = "";
  if (ctx.controller) {
    ctx.controller.abort();
    ctx.controller = null;
  }
  hideAutocomplete(field);
}

function clearResults() {
  state.results = [];
  state.route = null;
  state.areaCenter = null;
  state.sightings = [];
  state.sightingLocations = [];
  state.selectedSightingId = null;
  state.selectedId = null;
  state.comparisonIds = [];
  state.pinnedIds = [];
  state.pendingPinnedIds = [];
  state.itinerary = null;
  state.itineraryRequestId += 1;
  state.params = null;
  state.warnings = [];
  if (state.mapAdapter) state.mapAdapter.clear();
  clearFieldErrors();
  clearWarning();
  els.report.innerHTML = "";
  els.resultsList.className = "results-list empty";
  els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="binoculars"></i><p>Results will appear here after the first search.</p></div>';
  els.resultContext.textContent = state.mode === "species"
    ? "No species mapped yet."
    : state.mode === "area" ? "No area searched yet." : "No route searched yet.";
  els.routeDistance.textContent = "-";
  els.notableCount.textContent = "-";
  els.hotspotCount.textContent = "-";
  els.candidateCount.textContent = "-";
  els.liferCount.textContent = "-";
  updateInputSummaries();
  renderInsights();
  renderRouteTradeoff();
  renderComparison();
  renderItineraryBuilder();
  els.detailsPanel.hidden = true;
  setStatus("Ready", state.mode === "species"
    ? "Pick a species and a location, then map every recent sighting."
    : state.mode === "area"
      ? "Enter a city, park, or lodging location and run a search."
      : "Enter a route and run a search.");
  clearSharedUrl();
  if (window.lucide) window.lucide.createIcons();
}

async function runSearch(options = {}) {
  const { persistPreferences = true } = options;
  if (persistPreferences) savePreferences();
  setBusy(true);

  try {
    await waitForAppConfig();
    const params = readParams();
    clearSearchArtifacts();
    state.params = params;
    if (params.mode === "species") {
      await runSpeciesSearch(params);
    } else if (params.mode === "area") {
      await runAreaSearch(params);
    } else {
      await runRouteSearch(params);
    }
    applyPendingSharedPins();
    updateSharedUrlFromCurrentInputs({ autoRun: true });
  } catch (error) {
    setStatus("Search failed", error.message || "Something went wrong.");
    console.error(error);
  } finally {
    setBusy(false);
  }
}

async function waitForAppConfig(timeoutMs = CONFIG_WAIT_TIMEOUT_MS) {
  if (!state.configReady) return;

  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  const result = await Promise.race([
    state.configReady.then(() => "ready", (error) => ({ error })),
    timeout
  ]);
  if (timeoutId) clearTimeout(timeoutId);

  if (result === "timeout") {
    state.configReady = null;
    state.config = {
      ...state.config,
      ebirdConfigured: false,
      ebird: {
        ...state.config.ebird,
        serverConfigured: false
      }
    };
    updateSetupStatus();
    addWarning("Setup check is taking longer than expected. Continuing with the current setup state.");
    renderWarnings();
  } else if (result?.error) {
    state.configReady = null;
    state.config = {
      ...state.config,
      ebirdConfigured: false,
      ebird: {
        ...state.config.ebird,
        serverConfigured: false
      }
    };
    updateSetupStatus();
    addWarning(`Setup check failed: ${result.error.message}. Continuing with the current setup state.`);
    renderWarnings();
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

  if (!shouldAttemptEbirdSearch()) {
    setStatus("Token needed", "Route loaded. Add an eBird token or configure EBIRD_API_KEY to rank live birding stops.");
    els.resultContext.textContent = "Route loaded, but live bird data needs eBird access.";
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="feather"></i><p>Add an eBird token or configure EBIRD_API_KEY to rank live birding stops.</p></div>';
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

  if (!shouldAttemptEbirdSearch()) {
    setStatus("Token needed", "Area loaded. Add an eBird token or configure EBIRD_API_KEY to rank live birding stops.");
    els.resultContext.textContent = "Area loaded, but live bird data needs eBird access.";
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="feather"></i><p>Add an eBird token or configure EBIRD_API_KEY to rank live birding stops.</p></div>';
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

async function runSpeciesSearch(params) {
  if (!params.speciesQuery) {
    setSpeciesError("Enter a species to map its recent sightings.");
    setStatus("Species needed", "Type a species name (for example, Vermilion Flycatcher).");
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="bird"></i><p>Choose a species to map its recent sightings.</p></div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }
  clearSpeciesError();

  setStatus("Geocoding", "Resolving search location.");
  const center = await geocodeField("origin", params.origin, params.mapProvider);
  state.origin = center;
  state.areaCenter = center;
  const speciesLabel = params.species?.comName || params.speciesQuery;
  state.routeName = `${speciesLabel} near ${shortName(center.name) || params.origin}`;
  if (!els.tripName.value.trim()) els.tripName.value = state.routeName;
  renderArea(center, params.radiusKm);
  updateAreaSummary(params.radiusKm);

  if (!shouldAttemptEbirdSearch()) {
    setStatus("Token needed", "Location loaded. Add an eBird token or configure EBIRD_API_KEY to map species sightings.");
    els.resultContext.textContent = "Location loaded, but live bird data needs eBird access.";
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="feather"></i><p>Add an eBird token or configure EBIRD_API_KEY to map species sightings.</p></div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  setStatus("Mapping sightings", `Requesting recent ${speciesLabel} sightings within ${params.radiusKm} km.`);
  const url = new URL("/api/ebird/species", window.location.origin);
  url.searchParams.set("lat", String(center.lat));
  url.searchParams.set("lng", String(center.lng));
  url.searchParams.set("dist", String(params.radiusKm));
  url.searchParams.set("back", String(params.recentDays));
  url.searchParams.set("maxResults", "1000");
  if (params.species?.speciesCode) {
    url.searchParams.set("speciesCode", params.species.speciesCode);
  } else {
    url.searchParams.set("name", params.speciesQuery);
  }

  let payload;
  try {
    payload = await apiJson(`${url.pathname}${url.search}`, { token: params.token });
  } catch (error) {
    const suggestions = error.details?.suggestions;
    if (error.status === 404 && Array.isArray(suggestions) && suggestions.length) {
      const names = suggestions.map((item) => item.comName).slice(0, 5).join(", ");
      setSpeciesError(`No exact match. Try: ${names}`);
      setStatus("Species not found", `No eBird species matched "${params.speciesQuery}". Did you mean: ${names}?`);
      els.resultsList.className = "results-list empty";
      els.resultsList.innerHTML = `<div class="empty-state"><i data-lucide="search-x"></i><p>No species matched "${escapeHtml(params.speciesQuery)}". Did you mean ${escapeHtml(names)}?</p></div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }
    throw error;
  }

  const resolvedSpecies = payload.species || params.species || null;
  if (resolvedSpecies) {
    state.species = resolvedSpecies;
    els.speciesQuery.value = resolvedSpecies.comName;
    state.routeName = `${resolvedSpecies.comName} near ${shortName(center.name) || params.origin}`;
    if (!els.tripName.value.trim()) els.tripName.value = state.routeName;
  }

  const observations = Array.isArray(payload.observations) ? payload.observations : [];
  state.sightings = observations;
  state.sightingLocations = groupSightings(observations);
  state.selectedSightingId = null;

  renderSightings(resolvedSpecies, center, params);
  renderWarnings();
  const label = resolvedSpecies?.comName || params.speciesQuery;
  setStatus(
    "Complete",
    observations.length
      ? `Mapped ${observations.length} ${label} ${pluralize("sighting", observations.length)} across ${state.sightingLocations.length} ${pluralize("location", state.sightingLocations.length)}.`
      : `No recent ${label} sightings within ${params.radiusKm} km. Try a wider radius or longer recent window.`
  );
}

function groupSightings(observations) {
  const byKey = new Map();
  observations.forEach((obs) => {
    const lat = Number(obs.lat);
    const lng = Number(obs.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const key = obs.locId || `${lat.toFixed(4)},${lng.toFixed(4)}`;
    let loc = byKey.get(key);
    if (!loc) {
      loc = {
        id: key,
        locId: obs.locId || "",
        lat,
        lng,
        name: obs.locName || "Unnamed location",
        observations: [],
        count: 0,
        maxCount: 0,
        latest: "",
        __sighting: true
      };
      byKey.set(key, loc);
    }
    loc.observations.push(obs);
    loc.count += 1;
    const howMany = Number(obs.howMany);
    if (Number.isFinite(howMany)) loc.maxCount = Math.max(loc.maxCount, howMany);
    const obsDt = String(obs.obsDt || "");
    if (!loc.latest || obsDt > loc.latest) loc.latest = obsDt;
  });
  return Array.from(byKey.values()).sort((a, b) => {
    if (a.latest !== b.latest) return a.latest > b.latest ? -1 : 1;
    return b.count - a.count;
  });
}

function renderSightings(species, center, params) {
  const locations = state.sightingLocations;
  const totalSightings = state.sightings.length;
  const speciesLabel = species?.comName || params.speciesQuery;

  els.candidateCount.textContent = String(locations.length);
  els.notableCount.textContent = "-";
  els.hotspotCount.textContent = "-";
  els.liferCount.textContent = "-";
  els.targetCount.textContent = String(totalSightings);
  els.resultContext.textContent = totalSightings
    ? `${speciesLabel}: ${totalSightings} recent ${pluralize("sighting", totalSightings)} at ${locations.length} ${pluralize("location", locations.length)} within ${params.radiusKm} km.`
    : `No recent ${speciesLabel} sightings within ${params.radiusKm} km.`;

  renderInsights();
  renderRouteTradeoff();
  renderComparison();
  renderItineraryBuilder();
  renderSightingMarkers();

  els.resultsList.className = "results-list";
  els.resultsList.innerHTML = "";
  if (!locations.length) {
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = `<div class="empty-state"><i data-lucide="search-x"></i><p>No recent ${escapeHtml(speciesLabel)} sightings here. Try a wider radius or longer recent window.</p></div>`;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  locations.forEach((loc, index) => {
    const card = document.createElement("div");
    card.className = "sighting-card";
    card.dataset.id = loc.id;
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    if (loc.id === state.selectedSightingId) card.classList.add("is-selected");
    const countText = `${loc.count} ${pluralize("report", loc.count)}`;
    const howManyText = loc.maxCount ? ` · up to ${loc.maxCount} seen` : "";
    card.innerHTML = `
      <span class="sighting-rank">${index + 1}</span>
      <span class="sighting-copy">
        <strong class="sighting-loc"></strong>
        <small class="sighting-meta"></small>
      </span>
      <span class="sighting-when">
        <b></b>
        <small></small>
      </span>`;
    card.querySelector(".sighting-loc").textContent = loc.name;
    card.querySelector(".sighting-meta").textContent = `${countText}${howManyText}`;
    card.querySelector(".sighting-when b").textContent = formatFreshness(loc.latest);
    card.querySelector(".sighting-when small").textContent = loc.latest || "";
    card.addEventListener("click", () => selectSighting(loc.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectSighting(loc.id);
      }
    });
    els.resultsList.appendChild(card);
  });
  if (window.lucide) window.lucide.createIcons();
}

function renderSightingMarkers() {
  if (!state.mapAdapter) return;
  state.mapAdapter.setMarkers(state.sightingLocations, state.selectedSightingId, selectSighting);
}

function selectSighting(id) {
  const loc = state.sightingLocations.find((item) => item.id === id);
  if (!loc) return;
  state.selectedSightingId = id;
  let selectedCard = null;
  els.resultsList.querySelectorAll(".sighting-card").forEach((card) => {
    const isSelected = card.dataset.id === id;
    card.classList.toggle("is-selected", isSelected);
    if (isSelected) selectedCard = card;
  });
  renderSightingMarkers();
  if (state.mapAdapter) state.mapAdapter.flyTo(loc, 12);
  if (selectedCard) selectedCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function setSpeciesError(message) {
  if (!els.speciesError) return;
  els.speciesError.textContent = message;
  els.speciesError.hidden = false;
  els.speciesError.setAttribute("role", "alert");
  els.speciesQuery.setAttribute("aria-invalid", "true");
}

function clearSpeciesError() {
  if (!els.speciesError) return;
  els.speciesError.textContent = "";
  els.speciesError.hidden = true;
  els.speciesQuery.removeAttribute("aria-invalid");
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
    speciesQuery: els.speciesQuery.value.trim(),
    species: state.species && normalizeName(state.species.comName) === normalizeName(els.speciesQuery.value)
      ? state.species
      : null,
    targets: els.targets.value
      .split(/\n|,/)
      .map((target) => normalizeName(target))
      .filter(Boolean),
    lifeList: new Set(state.lifeList.species)
  };
}

function applyPendingSharedPins() {
  if (!state.pendingPinnedIds.length || !state.results.length) return;
  const resultIds = new Set(state.results.map((candidate) => candidate.id));
  const pinnedIds = state.pendingPinnedIds.filter((id) => resultIds.has(id)).slice(0, 5);
  state.pendingPinnedIds = [];
  if (!pinnedIds.length || state.mode === "area") return;
  state.pinnedIds = pinnedIds;
  renderResults();
  renderItineraryBuilder();
  renderMarkers();
  recalculateItinerary();
}

async function shareCurrentTrip() {
  if (!hasRunnableSearchInputs()) {
    setStatus("Nothing to share", "Add a route or area before creating a share link.");
    return;
  }

  const shareUrl = updateSharedUrlFromCurrentInputs({ autoRun: true });
  // Intentionally omit `text` — share targets that don't fully support Web Share
  // concatenate text + url into one blob, which auto-linkers then fold back into
  // the URL and corrupt the query string (e.g. run=1 becomes run=1 Birdtrip…).
  const shareData = {
    title: "Birdtrip",
    url: shareUrl
  };

  try {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setStatus("Share link ready", "Shared a link that refreshes this trip when opened.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error(error);
      }
    }
    await copyTextToClipboard(shareUrl);
    setStatus("Link copied", "Copied a share link that refreshes this trip when opened.");
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.error(error);
    setStatus("Share failed", "The share link could not be copied.");
  }
}

function updateSharedUrlFromCurrentInputs(options = {}) {
  const url = buildShareUrl(options);
  window.history.replaceState(null, "", url);
  return url;
}

function clearSharedUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("bt") !== SHARE_URL_VERSION) return;
  url.search = "";
  url.hash = "";
  window.history.replaceState(null, "", url);
}

function refreshSharedUrlIfPresent() {
  if (new URLSearchParams(window.location.search).get("bt") !== SHARE_URL_VERSION) return;
  updateSharedUrlFromCurrentInputs({ autoRun: Boolean(state.params) });
}

function buildShareUrl(options = {}) {
  const { autoRun = false } = options;
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("bt", SHARE_URL_VERSION);
  url.searchParams.set("mode", state.mode);
  url.searchParams.set("origin", els.origin.value.trim());
  if (state.mode === "route") url.searchParams.set("destination", els.destination.value.trim());
  if (state.mode === "species" && els.speciesQuery.value.trim()) {
    url.searchParams.set("species", els.speciesQuery.value.trim());
  }
  url.searchParams.set("mapProvider", providerFromInput());
  url.searchParams.set("maxDetour", String(clamp(Number(els.maxDetour.value || 60), 0, 240)));
  url.searchParams.set("recentDays", String(clamp(Number(els.recentDays.value || 14), 1, 30)));
  url.searchParams.set("radiusKm", String(clamp(Number(els.radiusKm.value || 25), 1, 50)));
  url.searchParams.set("maxStops", String(clamp(Number(els.maxStops.value || 10), 3, 20)));
  if (els.targets.value.trim()) url.searchParams.set("targets", els.targets.value.trim());
  for (const id of state.pinnedIds.slice(0, 5)) url.searchParams.append("pin", id);
  if (autoRun) url.searchParams.set("run", "1");
  return url.toString();
}

function hasRunnableSearchInputs() {
  if (els.origin.value.trim().length < 2) return false;
  if (state.mode === "species") return els.speciesQuery.value.trim().length >= 2;
  if (state.mode === "area") return true;
  return els.destination.value.trim().length >= 2;
}

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
  const hasAccess = hasEbirdAccess();
  const isChecking = state.config.ebirdConfigured === null && !els.apiToken.value.trim();
  els.setupStatus.classList.toggle("setup-checking", isChecking);
  els.setupStatus.classList.toggle("setup-ready", hasAccess);
  els.setupStatus.classList.toggle("setup-needed", !isChecking && !hasAccess);
  els.setupStatus.innerHTML = isChecking
    ? '<i data-lucide="loader-circle"></i>Checking Setup'
    : hasAccess
      ? '<i data-lucide="check-circle-2"></i>Ready to Search'
      : '<i data-lucide="circle-alert"></i>Setup Required';
  renderInsights();
  if (window.lucide) window.lucide.createIcons();
}

function hasEbirdAccess() {
  return Boolean(
    els.apiToken.value.trim() ||
    state.config.ebirdConfigured === true ||
    state.config.ebird?.serverConfigured === true
  );
}

function shouldAttemptEbirdSearch() {
  return hasEbirdAccess();
}

function updateInputSummaries() {
  const targets = parseTargetsInput();
  els.targetCount.textContent = String(targets.length);
  els.maxAdded.textContent = state.mode === "species"
    ? "Species"
    : state.mode === "area"
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
  state.comparisonIds = [];
  state.pinnedIds = [];
  state.itinerary = null;
  state.itineraryRequestId += 1;
  state.warnings = [];
  state.route = null;
  state.routeName = "";
  state.origin = null;
  state.destination = null;
  state.areaCenter = null;
  state.sightings = [];
  state.sightingLocations = [];
  state.selectedSightingId = null;
  clearFieldErrors();
  clearWarning();
  els.report.innerHTML = "";
  els.detailsPanel.hidden = true;
  if (state.mapAdapter) state.mapAdapter.clear();
  els.resultsList.className = "results-list empty";
  els.resultsList.innerHTML = `<div class="empty-state"><i data-lucide="loader"></i><p>${state.mode === "species" ? "Mapping sightings..." : state.mode === "area" ? "Searching area..." : "Searching route corridor..."}</p></div>`;
  els.notableCount.textContent = "-";
  els.hotspotCount.textContent = "-";
  els.candidateCount.textContent = "-";
  els.liferCount.textContent = state.lifeList.species.size ? "0" : "-";
  renderInsights();
  renderRouteTradeoff();
  renderComparison();
  renderItineraryBuilder();
  if (window.lucide) window.lucide.createIcons();
}

function setBusy(isBusy) {
  const controls = [
    ...els.form.querySelectorAll("button, input, select, textarea"),
    els.quickStartButton,
    els.shareTripButton,
    els.downloadReportButton,
    els.settingsButton,
    els.modalSampleButton,
    els.modalExploreButton,
    els.tripName,
    els.savedTripSelect,
    els.saveTripButton,
    els.loadTripButton,
    els.deleteTripButton,
    els.clearComparisonButton,
    els.clearItinerary
  ];

  controls.forEach((control) => {
    if (control === els.maxDetour && state.mode !== "route") {
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
    },
    signal: options.signal
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
  const currentLocation = parseCurrentLocationFallback(query, provider);
  if (currentLocation) return currentLocation;

  const cached = autocomplete[field]?.resolved;
  if (cached && cached.name === query && (cached.userLocation || cached.provider === provider)) {
    return cached;
  }
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

function formatCurrentLocationFallback(lat, lng) {
  return `Current location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

function parseCurrentLocationFallback(query, provider) {
  const match = String(query || "").trim().match(/^Current location \((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return {
    name: formatCurrentLocationFallback(lat, lng),
    lat,
    lng,
    provider,
    userLocation: true
  };
}

async function useCurrentLocationForOrigin() {
  if (!("geolocation" in navigator)) {
    setFieldError("origin", "This browser does not support location access.");
    return;
  }
  const button = els.useCurrentLocationButton;
  const label = els.useCurrentLocationLabel;
  const originalLabel = label.textContent;
  button.disabled = true;
  label.textContent = "Locating…";
  clearFieldErrors();
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      });
    });
    const lat = Number(position.coords.latitude);
    const lng = Number(position.coords.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("Location coordinates were unavailable.");
    }
    const provider = providerFromInput();
    label.textContent = "Resolving…";
    let displayName = "";
    try {
      const reverse = await apiJson(
        `/api/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&provider=${provider}`
      );
      displayName = reverse && typeof reverse.name === "string" ? reverse.name.trim() : "";
    } catch {
      displayName = "";
    }
    if (!displayName) {
      displayName = formatCurrentLocationFallback(lat, lng);
    }
    els.origin.value = displayName;
    autocomplete.origin.resolved = {
      name: displayName,
      lat,
      lng,
      provider,
      userLocation: true
    };
    autocomplete.origin.items = [];
    autocomplete.origin.activeIndex = -1;
    autocomplete.origin.lastQuery = displayName;
    hideAutocomplete("origin");
    updateInputSummaries();
    savePreferences();
  } catch (error) {
    const message = describeGeolocationError(error);
    setFieldError("origin", message);
  } finally {
    button.disabled = false;
    label.textContent = originalLabel;
  }
}

function describeGeolocationError(error) {
  if (!error) return "Could not get current location.";
  if (typeof error.code === "number") {
    if (error.code === 1) return "Location permission was denied. Enable it in your browser settings to use this option.";
    if (error.code === 2) return "Could not determine your location right now. Try again or enter it manually.";
    if (error.code === 3) return "Location request timed out. Try again or enter your origin manually.";
  }
  return error.message || "Could not get current location.";
}

function setupLocationAutocomplete(field) {
  const inputEl = els[field];
  const listEl = els[`${field}Suggestions`];
  if (!inputEl || !listEl) return;
  const ctx = autocomplete[field];
  ctx.listEl = listEl;

  inputEl.addEventListener("input", () => {
    ctx.resolved = null;
    const value = inputEl.value.trim();
    if (ctx.timer) clearTimeout(ctx.timer);
    if (ctx.controller) {
      ctx.controller.abort();
      ctx.controller = null;
    }
    if (value.length < 3) {
      hideAutocomplete(field);
      return;
    }
    if (value === ctx.lastQuery && ctx.items.length) {
      openAutocomplete(field);
      return;
    }
    ctx.timer = setTimeout(() => fetchAutocomplete(field, value), 250);
  });

  inputEl.addEventListener("keydown", (event) => {
    if (listEl.hidden || !ctx.items.length) {
      if (event.key === "ArrowDown" && inputEl.value.trim().length >= 3) {
        event.preventDefault();
        fetchAutocomplete(field, inputEl.value.trim());
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveAutocompleteSelection(field, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveAutocompleteSelection(field, -1);
    } else if (event.key === "Enter") {
      if (ctx.activeIndex >= 0) {
        event.preventDefault();
        selectAutocompleteItem(field, ctx.activeIndex);
      }
    } else if (event.key === "Escape") {
      hideAutocomplete(field);
    }
  });

  inputEl.addEventListener("blur", () => {
    // Defer so a click on a suggestion can register before we hide.
    setTimeout(() => hideAutocomplete(field), 120);
  });

  inputEl.addEventListener("focus", () => {
    if (ctx.items.length && inputEl.value.trim() === ctx.lastQuery) {
      openAutocomplete(field);
    }
  });
}

async function fetchAutocomplete(field, query) {
  const ctx = autocomplete[field];
  const provider = providerFromInput();
  if (ctx.controller) ctx.controller.abort();
  const controller = new AbortController();
  ctx.controller = controller;
  renderAutocompleteStatus(field, "loading");
  try {
    const matches = await apiJson(
      `/api/geocode?q=${encodeURIComponent(query)}&provider=${provider}`,
      { signal: controller.signal }
    );
    if (ctx.controller !== controller) return;
    ctx.lastQuery = query;
    ctx.items = Array.isArray(matches) ? matches : [];
    ctx.activeIndex = -1;
    renderAutocompleteItems(field);
  } catch (error) {
    if (error.name === "AbortError") return;
    if (ctx.controller !== controller) return;
    ctx.items = [];
    ctx.activeIndex = -1;
    renderAutocompleteStatus(field, "empty");
  } finally {
    if (ctx.controller === controller) ctx.controller = null;
  }
}

function renderAutocompleteStatus(field, kind) {
  const ctx = autocomplete[field];
  const listEl = ctx.listEl;
  if (!listEl) return;
  listEl.innerHTML = "";
  const li = document.createElement("li");
  li.className = kind === "loading" ? "is-loading" : "is-empty";
  li.textContent = kind === "loading" ? "Searching…" : "No matches.";
  listEl.appendChild(li);
  openAutocomplete(field);
}

function renderAutocompleteItems(field) {
  const ctx = autocomplete[field];
  const listEl = ctx.listEl;
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!ctx.items.length) {
    renderAutocompleteStatus(field, "empty");
    return;
  }
  ctx.items.forEach((item, index) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.id = `${field}AutocompleteOption${index}`;
    li.setAttribute("aria-selected", "false");
    li.dataset.index = String(index);
    li.innerHTML = `<i data-lucide="map-pin"></i><span class="ac-name"></span>`;
    li.querySelector(".ac-name").textContent = item.name || "";
    li.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectAutocompleteItem(field, index);
    });
    li.addEventListener("mouseenter", () => setAutocompleteActive(field, index));
    listEl.appendChild(li);
  });
  if (window.lucide) window.lucide.createIcons();
  openAutocomplete(field);
}

function openAutocomplete(field) {
  const ctx = autocomplete[field];
  const inputEl = els[field];
  if (!ctx.listEl) return;
  ctx.listEl.hidden = false;
  if (inputEl) inputEl.setAttribute("aria-expanded", "true");
}

function hideAutocomplete(field) {
  const ctx = autocomplete[field];
  const inputEl = els[field];
  if (ctx.listEl) ctx.listEl.hidden = true;
  if (inputEl) {
    inputEl.setAttribute("aria-expanded", "false");
    inputEl.removeAttribute("aria-activedescendant");
  }
  ctx.activeIndex = -1;
}

function moveAutocompleteSelection(field, delta) {
  const ctx = autocomplete[field];
  if (!ctx.items.length) return;
  const next = ctx.activeIndex + delta;
  const wrapped = (next + ctx.items.length) % ctx.items.length;
  setAutocompleteActive(field, wrapped);
}

function setAutocompleteActive(field, index) {
  const ctx = autocomplete[field];
  const inputEl = els[field];
  if (!ctx.listEl) return;
  ctx.activeIndex = index;
  Array.from(ctx.listEl.children).forEach((li, i) => {
    const isActive = i === index;
    li.classList.toggle("is-active", isActive);
    li.setAttribute("aria-selected", String(isActive));
    if (isActive && inputEl && li.id) {
      inputEl.setAttribute("aria-activedescendant", li.id);
      li.scrollIntoView({ block: "nearest" });
    }
  });
}

function selectAutocompleteItem(field, index) {
  const ctx = autocomplete[field];
  const item = ctx.items[index];
  const inputEl = els[field];
  if (!item || !inputEl) return;
  inputEl.value = item.name || "";
  ctx.resolved = item;
  ctx.lastQuery = item.name || "";
  hideAutocomplete(field);
  clearFieldErrors();
  if (inputEl === els.origin || inputEl === els.destination) {
    savePreferences();
  }
}

function handleAutocompleteOutsideClick(event) {
  for (const field of ["origin", "destination"]) {
    const ctx = autocomplete[field];
    const inputEl = els[field];
    if (!ctx.listEl || ctx.listEl.hidden) continue;
    if (event.target === inputEl) continue;
    if (ctx.listEl.contains(event.target)) continue;
    hideAutocomplete(field);
  }
  if (els.speciesSuggestions && !els.speciesSuggestions.hidden
    && event.target !== els.speciesQuery
    && !els.speciesSuggestions.contains(event.target)) {
    hideSpeciesAutocomplete();
  }
}

function setupSpeciesAutocomplete() {
  const inputEl = els.speciesQuery;
  const listEl = els.speciesSuggestions;
  if (!inputEl || !listEl) return;
  const ctx = speciesAutocomplete;

  inputEl.addEventListener("input", () => {
    state.species = null;
    clearSpeciesError();
    const value = inputEl.value.trim();
    if (ctx.timer) clearTimeout(ctx.timer);
    if (ctx.controller) {
      ctx.controller.abort();
      ctx.controller = null;
    }
    if (value.length < 2) {
      hideSpeciesAutocomplete();
      return;
    }
    if (value === ctx.lastQuery && ctx.items.length) {
      listEl.hidden = false;
      inputEl.setAttribute("aria-expanded", "true");
      return;
    }
    ctx.timer = setTimeout(() => fetchSpeciesAutocomplete(value), 220);
  });

  inputEl.addEventListener("keydown", (event) => {
    if (listEl.hidden || !ctx.items.length) {
      if (event.key === "ArrowDown" && inputEl.value.trim().length >= 2) {
        event.preventDefault();
        fetchSpeciesAutocomplete(inputEl.value.trim());
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSpeciesSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSpeciesSelection(-1);
    } else if (event.key === "Enter") {
      if (ctx.activeIndex >= 0) {
        event.preventDefault();
        selectSpeciesItem(ctx.activeIndex);
      }
    } else if (event.key === "Escape") {
      hideSpeciesAutocomplete();
    }
  });

  inputEl.addEventListener("blur", () => {
    setTimeout(() => hideSpeciesAutocomplete(), 120);
  });

  inputEl.addEventListener("focus", () => {
    if (ctx.items.length && inputEl.value.trim() === ctx.lastQuery) {
      listEl.hidden = false;
      inputEl.setAttribute("aria-expanded", "true");
    }
  });
}

async function fetchSpeciesAutocomplete(query) {
  const ctx = speciesAutocomplete;
  const listEl = els.speciesSuggestions;
  if (ctx.controller) ctx.controller.abort();
  const controller = new AbortController();
  ctx.controller = controller;
  listEl.innerHTML = '<li class="is-loading">Searching…</li>';
  listEl.hidden = false;
  els.speciesQuery.setAttribute("aria-expanded", "true");
  try {
    const matches = await apiJson(
      `/api/ebird/taxonomy/search?q=${encodeURIComponent(query)}`,
      { signal: controller.signal, token: els.apiToken.value.trim() }
    );
    if (ctx.controller !== controller) return;
    ctx.lastQuery = query;
    ctx.items = Array.isArray(matches) ? matches : [];
    ctx.activeIndex = -1;
    renderSpeciesItems();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (ctx.controller !== controller) return;
    ctx.items = [];
    ctx.activeIndex = -1;
    listEl.innerHTML = '<li class="is-empty">No matches.</li>';
    listEl.hidden = false;
  } finally {
    if (ctx.controller === controller) ctx.controller = null;
  }
}

function renderSpeciesItems() {
  const ctx = speciesAutocomplete;
  const listEl = els.speciesSuggestions;
  listEl.innerHTML = "";
  if (!ctx.items.length) {
    listEl.innerHTML = '<li class="is-empty">No matches.</li>';
    listEl.hidden = false;
    return;
  }
  ctx.items.forEach((item, index) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.id = `speciesAutocompleteOption${index}`;
    li.setAttribute("aria-selected", "false");
    li.dataset.index = String(index);
    li.innerHTML = `<i data-lucide="bird"></i><span class="ac-name"></span>`;
    const text = item.sciName ? `${item.comName} · ${item.sciName}` : item.comName;
    li.querySelector(".ac-name").textContent = text;
    li.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectSpeciesItem(index);
    });
    li.addEventListener("mouseenter", () => setSpeciesActive(index));
    listEl.appendChild(li);
  });
  if (window.lucide) window.lucide.createIcons();
  listEl.hidden = false;
  els.speciesQuery.setAttribute("aria-expanded", "true");
}

function moveSpeciesSelection(delta) {
  const ctx = speciesAutocomplete;
  if (!ctx.items.length) return;
  const next = ctx.activeIndex + delta;
  setSpeciesActive((next + ctx.items.length) % ctx.items.length);
}

function setSpeciesActive(index) {
  const ctx = speciesAutocomplete;
  const listEl = els.speciesSuggestions;
  ctx.activeIndex = index;
  Array.from(listEl.children).forEach((li, i) => {
    const isActive = i === index;
    li.classList.toggle("is-active", isActive);
    li.setAttribute("aria-selected", String(isActive));
    if (isActive && li.id) {
      els.speciesQuery.setAttribute("aria-activedescendant", li.id);
      li.scrollIntoView({ block: "nearest" });
    }
  });
}

function selectSpeciesItem(index) {
  const ctx = speciesAutocomplete;
  const item = ctx.items[index];
  if (!item) return;
  els.speciesQuery.value = item.comName;
  state.species = { speciesCode: item.speciesCode, comName: item.comName, sciName: item.sciName };
  ctx.lastQuery = item.comName;
  clearSpeciesError();
  hideSpeciesAutocomplete();
  savePreferences();
}

function hideSpeciesAutocomplete() {
  const listEl = els.speciesSuggestions;
  if (listEl) listEl.hidden = true;
  if (els.speciesQuery) {
    els.speciesQuery.setAttribute("aria-expanded", "false");
    els.speciesQuery.removeAttribute("aria-activedescendant");
  }
  speciesAutocomplete.activeIndex = -1;
}

function fieldLabel(field) {
  if (field === "origin" && state.mode !== "route") return "Location";
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
  clearSpeciesError();
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

function itineraryRouteUrl(origin, destination, stops, provider) {
  const url = new URL("/api/route-itinerary", window.location.origin);
  url.searchParams.set("origin", `${origin.lng},${origin.lat}`);
  url.searchParams.set("destination", `${destination.lng},${destination.lat}`);
  stops.forEach((stop) => url.searchParams.append("via", `${stop.lng},${stop.lat}`));
  url.searchParams.set("provider", provider);
  return `${url.pathname}${url.search}`;
}

function renderRoute(coordinates) {
  if (state.mapAdapter) state.mapAdapter.setRoute(coordinates);
}

function renderItineraryRoute(coordinates) {
  if (state.mapAdapter) state.mapAdapter.setItineraryRoute(coordinates);
}

function clearItineraryRoute() {
  if (state.mapAdapter) state.mapAdapter.clearItineraryRoute();
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

function pinnedStops() {
  const byId = new Map(state.results.map((candidate) => [candidate.id, candidate]));
  const stops = state.pinnedIds.map((id) => byId.get(id)).filter(Boolean);
  if (stops.length !== state.pinnedIds.length) {
    state.pinnedIds = stops.map((stop) => stop.id);
  }
  return stops;
}

function isPinned(id) {
  return state.pinnedIds.includes(id);
}

function togglePinned(id) {
  const candidate = state.results.find((item) => item.id === id);
  if (!candidate) return;
  if (isPinned(id)) {
    state.pinnedIds = state.pinnedIds.filter((pinnedId) => pinnedId !== id);
  } else {
    if (state.pinnedIds.length >= 5) {
      setStatus("Itinerary full", "Remove a pinned stop before adding another.");
      return;
    }
    state.pinnedIds.push(id);
  }
  state.itinerary = null;
  renderResults();
  renderItineraryBuilder();
  renderMarkers();
  updateVisibleDetails();
  recalculateItinerary();
  refreshSharedUrlIfPresent();
}

function clearPinnedStops() {
  state.pinnedIds = [];
  state.itinerary = null;
  state.itineraryRequestId += 1;
  clearItineraryRoute();
  renderResults();
  renderItineraryBuilder();
  renderMarkers();
  updateVisibleDetails();
  renderInsights();
  renderReport();
  refreshSharedUrlIfPresent();
}

function movePinnedStop(id, direction) {
  const index = state.pinnedIds.indexOf(id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= state.pinnedIds.length) return;
  const next = [...state.pinnedIds];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  state.pinnedIds = next;
  state.itinerary = null;
  renderItineraryBuilder();
  renderResults();
  renderMarkers();
  updateVisibleDetails();
  recalculateItinerary();
  refreshSharedUrlIfPresent();
}

function removePinnedStop(id) {
  if (!isPinned(id)) return;
  state.pinnedIds = state.pinnedIds.filter((pinnedId) => pinnedId !== id);
  state.itinerary = null;
  renderItineraryBuilder();
  renderResults();
  renderMarkers();
  updateVisibleDetails();
  recalculateItinerary();
  refreshSharedUrlIfPresent();
}

async function recalculateItinerary() {
  const stops = pinnedStops();
  const requestId = state.itineraryRequestId + 1;
  state.itineraryRequestId = requestId;

  if (!state.route || !state.origin || !state.destination || stops.length < 2) {
    state.itinerary = null;
    clearItineraryRoute();
    renderItineraryBuilder();
    renderInsights();
    renderReport();
    return;
  }

  clearItineraryRoute();
  state.itinerary = { status: "loading" };
  renderItineraryBuilder();
  renderInsights();

  try {
    const routeProvider = state.route.provider || state.params?.mapProvider || state.provider;
    const route = await apiJson(itineraryRouteUrl(state.origin, state.destination, stops, routeProvider));
    if (requestId !== state.itineraryRequestId) return;
    const addedMinutes = Math.max(0, (route.durationSeconds - state.route.durationSeconds) / 60);
    const addedMiles = Math.max(0, miles(route.distanceMeters - state.route.distanceMeters));
    state.itinerary = {
      status: "ready",
      route,
      addedMinutes,
      addedMiles
    };
    renderItineraryRoute(route.geometry.coordinates);
  } catch (error) {
    if (requestId !== state.itineraryRequestId) return;
    state.itinerary = { status: "error", error: error.message || "Could not calculate the multi-stop route." };
    clearItineraryRoute();
  }

  renderItineraryBuilder();
  renderInsights();
  renderReport();
}

function renderRouteTradeoff() {
  const mode = state.params?.mode || state.mode;
  const isArea = mode === "area";
  const maxDetour = currentRouteTradeoffMaxDetour();
  if (!els.routeTradeoffPanel || isArea || !state.route || !state.results.length) {
    if (els.routeTradeoffPanel) els.routeTradeoffPanel.hidden = true;
    if (els.budgetUnlocks) els.budgetUnlocks.innerHTML = "";
    return;
  }

  const best = bestBirdingRouteCandidate();
  if (!best) {
    els.routeTradeoffPanel.hidden = true;
    return;
  }

  const directMinutes = state.route.durationSeconds / 60;
  const birdingMinutes = best.viaRoute?.durationSeconds
    ? best.viaRoute.durationSeconds / 60
    : directMinutes + best.addedMinutes;
  const stats = tradeoffStats(state.results);
  const notableText = stats.notableCount ? `, ${stats.notableCount} notable` : "";
  const targetText = stats.targetCount ? `, ${stats.targetCount} target` : "";
  const liferText = state.lifeList.species.size ? `, ${stats.liferCount} likely lifers` : "";
  const tenMinute = bestWithinBudget(10);
  const tenMinuteText = tenMinute
    ? ` At +10m, ${tenMinute.name} is already on the table.`
    : "";

  els.routeTradeoffPanel.hidden = false;
  els.routeTradeoffTitle.textContent = `+${Math.round(best.addedMinutes)}m can route you through ${best.name}`;
  els.routeTradeoffSummary.textContent = `${maxDetour}m of flexibility unlocks ${state.results.length} ranked stops with ${stats.speciesCount} recent species${notableText}${targetText}${liferText}.${tenMinuteText}`;
  els.fastestRouteTime.textContent = formatMinutes(directMinutes);
  els.fastestRouteMeta.textContent = `${miles(state.route.distanceMeters).toFixed(0)} mi direct drive`;
  els.birdingRouteTime.textContent = formatMinutes(birdingMinutes);
  els.birdingRouteMeta.textContent = `${best.name}; ${best.species.size} species, ${uniqueNotableCount(best)} notable`;
  els.birdingRouteExtra.textContent = `+${formatMinutes(best.addedMinutes)}`;
  els.birdingValuePerMinute.textContent = `${birdingValuePerMinute(best).toFixed(1)} score/min`;

  setTradeoffButtonState(best);
  renderBudgetUnlocks();
  if (window.lucide) window.lucide.createIcons();
}

function setTradeoffButtonState(best) {
  const buttons = [
    els.previewBirdingRouteButton,
    els.pinBirdingRouteButton,
    els.compareBirdingRouteButton
  ];
  buttons.forEach((button) => {
    button.dataset.bestId = best.id;
  });

  els.previewBirdingRouteButton.disabled = !best.viaRoute?.geometry?.coordinates?.length;
  els.previewBirdingRouteButton.title = els.previewBirdingRouteButton.disabled
    ? "No route preview geometry is available for this stop"
    : `Preview the route through ${best.name}`;

  const pinned = isPinned(best.id);
  els.pinBirdingRouteButton.disabled = !pinned && state.pinnedIds.length >= 5;
  els.pinBirdingRouteButton.setAttribute("aria-pressed", String(pinned));
  els.pinBirdingRouteButton.title = pinned
    ? `${best.name} is already pinned`
    : "Pin the best birding option to the itinerary";
  els.pinBirdingRouteButton.innerHTML = pinned
    ? '<i data-lucide="pin"></i>Pinned'
    : '<i data-lucide="pin"></i>Pin Best';

  const compared = state.comparisonIds.includes(best.id);
  els.compareBirdingRouteButton.setAttribute("aria-pressed", String(compared));
  els.compareBirdingRouteButton.innerHTML = compared
    ? '<i data-lucide="columns-3"></i>Compared'
    : '<i data-lucide="columns-3"></i>Compare';
}

function renderBudgetUnlocks() {
  const steps = tradeoffBudgetSteps();
  if (!steps.length) {
    els.budgetUnlocks.innerHTML = "";
    return;
  }

  els.budgetUnlocks.innerHTML = steps.map((minutes) => {
    const candidate = bestWithinBudget(minutes);
    const isCurrent = Math.round(minutes) === currentRouteTradeoffMaxDetour();
    if (!candidate) {
      return `
        <div class="budget-unlock is-empty">
          <span>+${Math.round(minutes)}m</span>
          <b>No ranked stop</b>
          <small>Try a wider corridor or longer recent window</small>
        </div>
      `;
    }
    const notableCount = uniqueNotableCount(candidate);
    return `
      <button type="button" class="budget-unlock${isCurrent ? " is-current" : ""}" data-select-id="${escapeHtml(candidate.id)}">
        <span>+${Math.round(minutes)}m</span>
        <b>${escapeHtml(candidate.name)}</b>
        <small>${candidate.species.size} species${notableCount ? `, ${notableCount} notable` : ""}; score ${candidate.score}</small>
      </button>
    `;
  }).join("");

  els.budgetUnlocks.querySelectorAll("[data-select-id]").forEach((button) => {
    button.addEventListener("click", () => selectCandidate(button.dataset.selectId));
  });
}

function tradeoffBudgetSteps() {
  const max = currentRouteTradeoffMaxDetour();
  if (max <= 0) return [];
  const presets = [10, 20, 30, 45, 60, 90, 120]
    .filter((minutes) => minutes < max);
  const sorted = [...new Set([...presets, max])].sort((a, b) => a - b);
  if (sorted.length <= 6) return sorted;
  return [...sorted.filter((minutes) => minutes !== max).slice(0, 5), max];
}

function currentRouteTradeoffMaxDetour() {
  return Math.round(Number.isFinite(state.params?.maxDetour)
    ? state.params.maxDetour
    : clamp(Number(els.maxDetour?.value || 60), 0, 240));
}

function bestBirdingRouteCandidate() {
  return [...state.results]
    .filter((candidate) => Number.isFinite(candidate.addedMinutes))
    .sort(compareBirdingRouteValue)[0] || null;
}

function bestWithinBudget(minutes) {
  return [...state.results]
    .filter((candidate) => Number.isFinite(candidate.addedMinutes) && candidate.addedMinutes <= minutes)
    .sort(compareBirdingRouteValue)[0] || null;
}

function compareBirdingRouteValue(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  const bValue = birdingValuePerMinute(b);
  const aValue = birdingValuePerMinute(a);
  if (bValue !== aValue) return bValue - aValue;
  return a.addedMinutes - b.addedMinutes;
}

function birdingValuePerMinute(candidate) {
  return candidate.score / Math.max(candidate.addedMinutes, 1);
}

function tradeoffStats(candidates) {
  const species = new Set();
  const notable = new Set();
  const targets = new Set();
  const lifers = new Set();
  for (const candidate of candidates) {
    for (const speciesKey of candidate.species.keys()) species.add(speciesKey);
    for (const obs of candidate.notable || []) {
      const key = normalizeName(obs.comName || obs.sciName);
      if (key) notable.add(key);
    }
    for (const obs of candidate.targetMatches || []) {
      const key = normalizeName(obs.comName || obs.sciName);
      if (key) targets.add(key);
    }
    for (const obs of candidate.liferSpecies || []) {
      const key = normalizeName(obs.comName || obs.sciName || obs.speciesCode);
      if (key) lifers.add(key);
    }
  }
  return {
    speciesCount: species.size,
    notableCount: notable.size,
    targetCount: targets.size,
    liferCount: lifers.size
  };
}

function tradeoffBestCandidateFromButton(button) {
  const id = button?.dataset?.bestId;
  return state.results.find((candidate) => candidate.id === id) || bestBirdingRouteCandidate();
}

function previewBestBirdingRoute() {
  const best = tradeoffBestCandidateFromButton(els.previewBirdingRouteButton);
  if (!best?.viaRoute?.geometry?.coordinates?.length) {
    setStatus("No preview available", "This stop does not have route geometry to preview.");
    return;
  }
  selectCandidate(best.id);
  renderItineraryRoute(best.viaRoute.geometry.coordinates);
  setStatus("Previewing birding route", `${best.name} adds ${formatMinutes(best.addedMinutes)} to the direct drive.`);
}

function pinBestBirdingRoute() {
  const best = tradeoffBestCandidateFromButton(els.pinBirdingRouteButton);
  if (!best) return;
  if (isPinned(best.id)) {
    selectCandidate(best.id);
    setStatus("Already pinned", `${best.name} is already in the itinerary.`);
    return;
  }
  togglePinned(best.id);
}

function compareBestBirdingRoute() {
  const best = tradeoffBestCandidateFromButton(els.compareBirdingRouteButton);
  if (!best) return;
  if (!state.comparisonIds.includes(best.id)) {
    toggleComparison(best.id);
  } else {
    setStatus("Already compared", `${best.name} is already in the stop comparison.`);
  }
}

function renderItineraryBuilder() {
  const stops = pinnedStops();
  els.itineraryStopCount.textContent = `${stops.length}/5`;
  els.clearItinerary.hidden = stops.length === 0;

  if (state.itinerary?.status === "ready") {
    els.itineraryAddedTime.textContent = `+${formatMinutes(state.itinerary.addedMinutes)}`;
    els.itineraryTotalDrive.textContent = formatMinutes(state.itinerary.route.durationSeconds / 60);
    els.itinerarySummary.textContent = `${stops.length} stops pinned; full route adds ${formatMinutes(state.itinerary.addedMinutes)} and ${state.itinerary.addedMiles.toFixed(1)} mi.`;
  } else if (state.itinerary?.status === "loading") {
    els.itineraryAddedTime.textContent = "...";
    els.itineraryTotalDrive.textContent = "...";
    els.itinerarySummary.textContent = "Calculating the full ordered route.";
  } else if (state.itinerary?.status === "error") {
    els.itineraryAddedTime.textContent = "-";
    els.itineraryTotalDrive.textContent = "-";
    els.itinerarySummary.textContent = state.itinerary.error;
  } else {
    els.itineraryAddedTime.textContent = "-";
    els.itineraryTotalDrive.textContent = "-";
    els.itinerarySummary.textContent = stops.length === 1
      ? "Pin one more stop to calculate the full multi-stop route."
      : "Pin 2-5 ranked stops to build a full multi-stop route.";
  }

  if (!stops.length) {
    els.itineraryList.innerHTML = '<div class="itinerary-empty">Pinned stops appear here in route order.</div>';
  } else {
    els.itineraryList.innerHTML = stops.map((stop, index) => `
      <article class="itinerary-stop">
        <span class="itinerary-rank">${index + 1}</span>
        <button type="button" class="itinerary-name" data-select-id="${escapeHtml(stop.id)}">${escapeHtml(stop.name)}</button>
        <span class="itinerary-stop-meta">single +${Math.round(stop.addedMinutes)}m</span>
        <div class="itinerary-controls">
          <button type="button" title="Move earlier" data-move-id="${escapeHtml(stop.id)}" data-direction="-1" ${index === 0 ? "disabled" : ""}><i data-lucide="arrow-up"></i></button>
          <button type="button" title="Move later" data-move-id="${escapeHtml(stop.id)}" data-direction="1" ${index === stops.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down"></i></button>
          <button type="button" title="Remove stop" data-remove-id="${escapeHtml(stop.id)}"><i data-lucide="x"></i></button>
        </div>
      </article>
    `).join("");
  }

  els.itineraryList.querySelectorAll("[data-select-id]").forEach((button) => {
    button.addEventListener("click", () => selectCandidate(button.dataset.selectId));
  });
  els.itineraryList.querySelectorAll("[data-move-id]").forEach((button) => {
    button.addEventListener("click", () => movePinnedStop(button.dataset.moveId, Number(button.dataset.direction)));
  });
  els.itineraryList.querySelectorAll("[data-remove-id]").forEach((button) => {
    button.addEventListener("click", () => removePinnedStop(button.dataset.removeId));
  });
  if (window.lucide) window.lucide.createIcons();
}

function renderResults() {
  pinnedStops();
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
  renderRouteTradeoff();
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
    if (isPinned(candidate.id)) card.classList.add("is-pinned");
    node.querySelector(".rank").textContent = String(index + 1);
    node.querySelector(".stop-name").textContent = candidate.name;
    node.querySelector(".stop-preview").textContent = speciesPreview(candidate);
    node.querySelector(".stop-chips").innerHTML = candidateChips(candidate);
    node.querySelector(".score-pill").textContent = candidate.score;
    node.querySelector(".stop-reason p").textContent = candidateReasonText(candidate, isArea);
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
    const pin = node.querySelector(".stop-pin");
    const compareButton = node.querySelector(".compare-toggle");
    const dir = node.querySelector(".stop-dir");
    const ebird = node.querySelector(".stop-ebird");
    const pinned = isPinned(candidate.id);
    const compared = state.comparisonIds.includes(candidate.id);
    pin.classList.toggle("is-active", pinned);
    pin.hidden = isArea;
    pin.disabled = isArea || (!pinned && state.pinnedIds.length >= 5);
    pin.title = pinned ? "Remove from itinerary" : "Pin stop to itinerary";
    pin.setAttribute("aria-pressed", String(pinned));
    pin.querySelector("span").textContent = pinned ? "Pinned" : "Pin";
    pin.addEventListener("click", () => togglePinned(candidate.id));
    compareButton.classList.toggle("is-active", compared);
    compareButton.setAttribute("aria-pressed", String(compared));
    compareButton.setAttribute("aria-label", `${compared ? "Remove" : "Add"} ${candidate.name} ${compared ? "from" : "to"} comparison`);
    compareButton.querySelector("span").textContent = compared ? "Compared" : "Compare";
    compareButton.addEventListener("click", () => toggleComparison(candidate.id));
    dir.href = links.mapsUrl;
    ebird.href = links.ebirdUrl;
    dir.setAttribute("aria-label", `Directions to ${candidate.name}`);
    ebird.setAttribute("aria-label", `${candidate.name} on eBird`);
    const mainButton = node.querySelector(".stop-main");
    mainButton.setAttribute("aria-label", `View ${candidate.name}`);
    mainButton.addEventListener("click", () => selectCandidate(candidate.id));
    els.resultsList.appendChild(node);
  });

  renderComparison();
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
  const pinned = isPinned(candidate.id);
  const pinDisabled = isArea || (!pinned && state.pinnedIds.length >= 5);

  els.detailsContent.innerHTML = `
    <h3>${escapeHtml(candidate.name)}</h3>
    <p class="detail-subtitle">${candidate.score} score; ${isArea ? `${offRouteMi} mi from ${escapeHtml(state.routeName)}.` : `+${Math.round(candidate.addedMinutes)} min and +${candidate.addedMiles.toFixed(1)} mi detour.`}</p>
    <section class="reason-line">
      <h4>Why This Stop?</h4>
      <p>${escapeHtml(candidateReasonText(candidate, isArea))}</p>
    </section>
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
      ${isArea ? "" : `<button type="button" class="detail-pin" aria-pressed="${pinned}" ${pinDisabled ? "disabled" : ""}>${pinned ? "Remove from itinerary" : pinDisabled ? "Itinerary full" : "Pin to itinerary"}</button>`}
      <a href="${links.mapsUrl}" target="_blank" rel="noreferrer">Directions</a>
      <a href="${links.ebirdUrl}" target="_blank" rel="noreferrer">eBird</a>
    </div>
  `;
  const pinButton = els.detailsContent.querySelector(".detail-pin");
  if (pinButton && !pinButton.disabled) pinButton.addEventListener("click", () => togglePinned(candidate.id));
  if (window.lucide) window.lucide.createIcons();
}

function updateSelectedCard() {
  els.resultsList.querySelectorAll(".stop-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.id === state.selectedId);
  });
}

function toggleComparison(id) {
  const candidate = state.results.find((item) => item.id === id);
  if (!candidate) return;
  if (state.comparisonIds.includes(id)) {
    state.comparisonIds = state.comparisonIds.filter((item) => item !== id);
  } else {
    state.comparisonIds = [...state.comparisonIds, id].slice(-4);
  }
  syncComparisonButtons();
  renderComparison();
  renderRouteTradeoff();
  if (window.lucide) window.lucide.createIcons();
}

function clearComparison() {
  state.comparisonIds = [];
  syncComparisonButtons();
  renderComparison();
  renderRouteTradeoff();
  if (window.lucide) window.lucide.createIcons();
}

function syncComparisonButtons() {
  els.resultsList.querySelectorAll(".stop-card").forEach((card) => {
    const candidate = state.results.find((item) => item.id === card.dataset.id);
    const button = card.querySelector(".compare-toggle");
    if (!candidate || !button) return;
    const isCompared = state.comparisonIds.includes(candidate.id);
    button.classList.toggle("is-active", isCompared);
    button.setAttribute("aria-pressed", String(isCompared));
    button.setAttribute("aria-label", `${isCompared ? "Remove" : "Add"} ${candidate.name} ${isCompared ? "from" : "to"} comparison`);
    const label = button.querySelector("span");
    if (label) label.textContent = isCompared ? "Compared" : "Compare";
  });
}

function renderComparison() {
  state.comparisonIds = state.comparisonIds.filter((id) => state.results.some((candidate) => candidate.id === id));
  if (!state.results.length) {
    els.comparisonPanel.hidden = true;
    els.comparisonContent.innerHTML = "";
    return;
  }

  els.comparisonPanel.hidden = false;
  const compared = state.comparisonIds
    .map((id) => state.results.find((candidate) => candidate.id === id))
    .filter(Boolean);

  els.comparisonSummary.textContent = compared.length
    ? `${compared.length} selected; add up to ${Math.max(0, 4 - compared.length)} more.`
    : "Select stops from the ranked list to compare route cost and birding value.";

  if (!compared.length) {
    els.comparisonContent.innerHTML = `
      <div class="comparison-empty">
        <i data-lucide="columns-3"></i>
        <p>Choose Compare on any ranked stop to build a side-by-side view.</p>
      </div>
    `;
    return;
  }

  const gridTemplate = `minmax(128px, 0.72fr) repeat(${compared.length}, minmax(190px, 1fr))`;
  els.comparisonContent.innerHTML = `
    <div class="comparison-table" style="grid-template-columns: ${gridTemplate}">
      <div class="comparison-label comparison-sticky">Metric</div>
      ${compared.map((candidate) => `
        <div class="comparison-stop comparison-sticky">
          <b>${escapeHtml(candidate.name)}</b>
          <button type="button" class="comparison-remove" data-id="${escapeHtml(candidate.id)}" title="Remove ${escapeHtml(candidate.name)} from comparison" aria-label="Remove ${escapeHtml(candidate.name)} from comparison">
            <i data-lucide="x"></i>
          </button>
        </div>
      `).join("")}
      ${comparisonRow("Detour", compared.map(compareDetourCell))}
      ${comparisonRow("Species Count", compared.map((candidate) => `${candidate.species.size} species<br><small>${candidate.observations.length} records</small>`))}
      ${comparisonRow("Notables", compared.map(compareNotablesCell))}
      ${comparisonRow("Targets", compared.map(compareTargetsCell))}
      ${comparisonRow("Observation Freshness", compared.map(compareFreshnessCell))}
      ${comparisonRow("Score Breakdown", compared.map(compareScoreCell))}
    </div>
  `;

  els.comparisonContent.querySelectorAll(".comparison-remove").forEach((button) => {
    button.addEventListener("click", () => toggleComparison(button.dataset.id));
  });
}

function comparisonRow(label, cells) {
  return `
    <div class="comparison-label">${escapeHtml(label)}</div>
    ${cells.map((cell) => `<div class="comparison-cell">${cell}</div>`).join("")}
  `;
}

function compareDetourCell(candidate) {
  const isArea = state.params?.mode === "area";
  return isArea
    ? `
      <b>${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi</b>
      <small>from search center</small>
      <small>${state.params.radiusKm} km radius</small>
    `
    : `
      <b>+${Math.round(candidate.addedMinutes)} min</b>
      <small>+${candidate.addedMiles.toFixed(1)} mi detour</small>
      <small>~${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi off route</small>
    `;
}

function compareNotablesCell(candidate) {
  const notableNames = uniqueObservationNames(candidate.notable).slice(0, 4);
  return `
    <b>${uniqueNotableCount(candidate)} notable</b>
    <small>${notableNames.length ? notableNames.map(escapeHtml).join(", ") : "No notable reports loaded"}</small>
  `;
}

function compareTargetsCell(candidate) {
  const targets = candidate.targetMatches
    .map((obs) => obs.comName || obs.sciName)
    .filter(Boolean)
    .slice(0, 4);
  return `
    <b>${candidate.targetMatches.length} targets</b>
    <small>${targets.length ? targets.map(escapeHtml).join(", ") : "No target matches"}</small>
  `;
}

function compareFreshnessCell(candidate) {
  const latest = latestObservationDate(candidate);
  return `
    <b>${escapeHtml(formatFreshness(latest))}</b>
    <small>${latest ? escapeHtml(latest) : "No dated observations"}</small>
  `;
}

function compareScoreCell(candidate) {
  const routeLabel = state.params?.mode === "area" ? "Proximity" : "Route";
  return `
    <b>${candidate.score} total</b>
    <div class="comparison-score">
      ${compactScorePart("Species", candidate.scoreParts.species, 45)}
      ${compactScorePart("Activity", candidate.scoreParts.activity, 15)}
      ${compactScorePart("Notable", candidate.scoreParts.notable, 20)}
      ${compactScorePart("Targets", candidate.scoreParts.targets, 15)}
      ${compactScorePart("Lifers", candidate.scoreParts.lifers, 18)}
      ${compactScorePart(routeLabel, candidate.scoreParts.practicality, 20)}
    </div>
  `;
}

function compactScorePart(label, value, max) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const width = Math.max(0, Math.min(100, safeValue / max * 100));
  return `
    <span>
      <small>${escapeHtml(label)} ${safeValue.toFixed(1)}/${max}</small>
      <i><i style="width: ${width.toFixed(0)}%"></i></i>
    </span>
  `;
}

function updateVisibleDetails() {
  if (els.detailsPanel.hidden || !state.selectedId) return;
  const candidate = state.results.find((item) => item.id === state.selectedId);
  if (candidate) renderDetails(candidate);
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
  if (isPinned(candidate.id)) return "marker-pinned";
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

function candidateReasonText(candidate, isArea = state.params?.mode === "area") {
  const reasons = [];
  const targetCount = candidate.targetMatches.length;
  const liferCount = candidate.liferSpecies.length;
  const notableCount = uniqueNotableCount(candidate);

  if (targetCount) reasons.push(`${targetCount} ${pluralize("target", targetCount)}`);
  if (liferCount) reasons.push(`${liferCount} likely ${pluralize("lifer", liferCount)}`);
  if (notableCount === 1) {
    reasons.push("recent rarity");
  } else if (notableCount > 1) {
    reasons.push(`${notableCount} recent rarities`);
  }

  if (!reasons.length) {
    reasons.push(`${candidate.species.size} recent ${pluralize("species", candidate.species.size)}`);
  }

  if (isArea) {
    reasons.push(`~${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi from center`);
  } else {
    const addedMinutes = Math.round(candidate.addedMinutes);
    const lowImpact = addedMinutes <= 20 || addedMinutes <= Math.round((state.params?.maxDetour || 0) / 2);
    reasons.push(`${lowImpact ? "only " : ""}+${addedMinutes} min`);
  }

  return `Best for: ${reasons.join(", ")}`;
}

function pluralize(noun, count) {
  if (noun === "species") return "species";
  return count === 1 ? noun : `${noun}s`;
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

function uniqueObservationNames(observations) {
  const names = new Map();
  for (const obs of observations) {
    const name = obs.comName || obs.sciName;
    const key = normalizeName(name);
    if (key && !names.has(key)) names.set(key, name);
  }
  return Array.from(names.values());
}

function latestObservationDate(candidate) {
  return candidate.observations
    .map((obs) => obs.obsDt || "")
    .filter(Boolean)
    .map((obsDt) => {
      const observedAt = parseObservationDate(obsDt);
      return { obsDt, time: observedAt ? observedAt.getTime() : NaN };
    })
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => a.time - b.time)
    .at(-1)?.obsDt || "";
}

function formatFreshness(obsDt) {
  const ageDays = observationAgeDays(obsDt);
  if (ageDays === null) return obsDt || "No date";
  if (ageDays === 0) return "Today";
  if (ageDays === 1) return "1 day ago";
  return `${ageDays} days ago`;
}

function observationAgeDays(obsDt) {
  const observedAt = parseObservationDate(obsDt);
  if (!observedAt) return null;
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const observedMidnight = new Date(
    observedAt.getFullYear(),
    observedAt.getMonth(),
    observedAt.getDate()
  ).getTime();
  return Math.max(0, Math.floor((todayMidnight - observedMidnight) / 86400000));
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
  const canAttemptSearch = shouldAttemptEbirdSearch();
  const lifeListCount = state.lifeList.displayNames.length || state.lifeList.species.size;
  if (state.mode === "species") {
    const radius = state.params?.radiusKm || els.radiusKm.value || 25;
    const recent = state.params?.recentDays || els.recentDays.value || 14;
    const speciesLabel = state.species?.comName || els.speciesQuery.value.trim();
    els.tripPlanSummary.textContent = speciesLabel
      ? `${speciesLabel}: mapping recent sightings within ${radius} km${state.areaCenter ? ` of ${shortName(state.areaCenter.name) || ""}` : ""}.`
      : "Pick a species and a location to map every recent sighting nearby.";
    els.targetSpeciesSummary.textContent = state.species?.sciName
      ? `${state.species.comName} (${state.species.sciName}).`
      : speciesLabel
        ? `Showing matches for "${speciesLabel}".`
        : "Choose a species to begin.";
    if (state.sightings.length) {
      els.sightingSummary.textContent = `${state.sightings.length} recent ${pluralize("sighting", state.sightings.length)} from the last ${recent} days across ${state.sightingLocations.length} ${pluralize("location", state.sightingLocations.length)}.`;
    } else {
      els.sightingSummary.textContent = canAttemptSearch
        ? "Recent sightings appear after you map a species."
        : "Add an eBird token to map recent species sightings.";
    }
    return;
  }
  if (state.mode === "area") {
    els.tripPlanSummary.textContent = state.areaCenter
      ? `${state.routeName}: searching hotspots within ${state.params?.radiusKm || els.radiusKm.value || 25} km.`
      : "Set a city, park, or lodging location to rank nearby birding stops.";
  } else {
    let routeText = state.route
      ? `${state.routeName}: ${miles(state.route.distanceMeters).toFixed(0)} miles, ${formatMinutes(state.route.durationSeconds / 60)} drive time, ${liveDetour} min detour budget.`
      : "Set a route to compare drive time, detour budget, and ranked birding stops.";
    if (state.itinerary?.status === "ready") {
      routeText = `${state.routeName}: ${state.pinnedIds.length} pinned stops add ${formatMinutes(state.itinerary.addedMinutes)}; total drive ${formatMinutes(state.itinerary.route.durationSeconds / 60)}.`;
    }
    els.tripPlanSummary.textContent = routeText;
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
    const searchedWithoutToken = state.mode === "area" ? state.areaCenter && !canAttemptSearch : state.route && !canAttemptSearch;
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
  return {
    ebirdUrl: candidate.locId
      ? `https://ebird.org/hotspot/${encodeURIComponent(candidate.locId)}`
      : `https://ebird.org/map?lat=${candidate.lat}&lng=${candidate.lng}`,
    mapsUrl: directionsUrlForPoints([state.origin, candidate].filter(Boolean), provider)
  };
}

function directionsUrlForPoints(points, provider = state.params?.mapProvider || state.provider) {
  const coords = points
    .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng))
    .map((point) => ({ lat: point.lat, lng: point.lng }));
  if (!coords.length) return "";
  if (provider === "google") {
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    if (coords.length > 1) {
      const [origin, ...rest] = coords;
      const destination = rest.at(-1);
      const waypoints = rest.slice(0, -1);
      url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
      url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
      if (waypoints.length) {
        url.searchParams.set("waypoints", waypoints.map((point) => `${point.lat},${point.lng}`).join("|"));
      }
    } else {
      url.searchParams.set("destination", `${coords[0].lat},${coords[0].lng}`);
    }
    return url.toString();
  }

  const url = new URL("https://www.openstreetmap.org/directions");
  if (coords.length > 1) {
    url.searchParams.set("route", coords.map((point) => `${point.lat},${point.lng}`).join(";"));
  } else {
    url.searchParams.set("to", `${coords[0].lat},${coords[0].lng}`);
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

function reportOrderedStops(isArea) {
  return isArea ? state.results : pinnedStops();
}

function reportDirectionsLink(points, label = "Open directions") {
  const url = directionsUrlForPoints(points);
  if (!url) return "";
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

function reportCoordinate(candidate) {
  return `${candidate.lat.toFixed(5)}, ${candidate.lng.toFixed(5)}`;
}

function reportRoutePoints(stops) {
  const points = [];
  if (state.origin) points.push(state.origin);
  points.push(...stops);
  if (state.destination) points.push(state.destination);
  return points;
}

function buildReportMapMarkup(isArea, orderedStops) {
  const width = 900;
  const height = 360;
  const routeCoordinates = !isArea
    ? (state.itinerary?.status === "ready" ? state.itinerary.route?.geometry?.coordinates : state.route?.geometry?.coordinates) || []
    : [];
  const mapStops = orderedStops.length ? orderedStops : state.results.slice(0, isArea ? 16 : 8);
  const stopPins = mapStops.slice(0, isArea ? 16 : Math.max(mapStops.length, 8)).map((candidate, index) => ({
    lat: candidate.lat,
    lng: candidate.lng,
    label: String(index + 1),
    name: candidate.name
  }));
  const endpointPins = [
    state.origin ? { ...state.origin, label: isArea ? "C" : "S", name: isArea ? "Search center" : "Start" } : null,
    !isArea && state.destination ? { ...state.destination, label: "E", name: "End" } : null
  ].filter(Boolean);
  const allPoints = [
    ...routeCoordinates.map(([lng, lat]) => ({ lat, lng })),
    ...stopPins,
    ...endpointPins
  ].filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (!allPoints.length) {
    return `
      <section class="report-map-card">
        <h2>Offline map</h2>
        <p>No coordinates were available for a schematic map.</p>
      </section>`;
  }

  let minLat = Math.min(...allPoints.map((point) => point.lat));
  let maxLat = Math.max(...allPoints.map((point) => point.lat));
  let minLng = Math.min(...allPoints.map((point) => point.lng));
  let maxLng = Math.max(...allPoints.map((point) => point.lng));
  if (minLat === maxLat) {
    minLat -= 0.05;
    maxLat += 0.05;
  }
  if (minLng === maxLng) {
    minLng -= 0.05;
    maxLng += 0.05;
  }

  const pad = 34;
  const project = (point) => {
    const x = pad + ((point.lng - minLng) / (maxLng - minLng)) * (width - pad * 2);
    const y = pad + ((maxLat - point.lat) / (maxLat - minLat)) * (height - pad * 2);
    return { x, y };
  };
  const routePath = routeCoordinates
    .map(([lng, lat]) => project({ lat, lng }))
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const centerPoint = isArea && state.areaCenter ? project(state.areaCenter) : null;
  const stopMarkers = stopPins.map((pin) => {
    const point = project(pin);
    return `
      <g class="report-map-stop">
        <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="12"></circle>
        <text x="${point.x.toFixed(1)}" y="${(point.y + 4).toFixed(1)}">${escapeHtml(pin.label)}</text>
        <title>${escapeHtml(pin.label)}. ${escapeHtml(pin.name)} (${reportCoordinate(pin)})</title>
      </g>`;
  }).join("");
  const endpointMarkers = endpointPins.map((pin) => {
    const point = project(pin);
    return `
      <g class="report-map-endpoint">
        <rect x="${(point.x - 11).toFixed(1)}" y="${(point.y - 11).toFixed(1)}" width="22" height="22" rx="5"></rect>
        <text x="${point.x.toFixed(1)}" y="${(point.y + 4).toFixed(1)}">${escapeHtml(pin.label)}</text>
        <title>${escapeHtml(pin.name)} (${reportCoordinate(pin)})</title>
      </g>`;
  }).join("");

  return `
    <section class="report-map-card">
      <div class="report-section-heading">
        <h2>Offline map</h2>
        ${!isArea ? reportDirectionsLink(reportRoutePoints(orderedStops), "Full route directions") : ""}
      </div>
      <svg class="report-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(isArea ? "Schematic area map" : "Schematic route map")}">
        <rect class="report-map-bg" x="0" y="0" width="${width}" height="${height}"></rect>
        ${isArea && centerPoint ? `<circle class="report-map-radius" cx="${centerPoint.x.toFixed(1)}" cy="${centerPoint.y.toFixed(1)}" r="${Math.min(width, height) * 0.34}"></circle>` : ""}
        ${routePath ? `<polyline class="report-map-route" points="${routePath}"></polyline>` : ""}
        ${endpointMarkers}
        ${stopMarkers}
      </svg>
      <p class="report-note">This schematic map is embedded in the packet for offline use. OpenStreetMap, Google Maps, and eBird links require signal when opened.</p>
    </section>`;
}

function buildStopOrderBlock(isArea, orderedStops) {
  if (isArea) {
    if (!orderedStops.length) return "";
    return `
      <h2>Ranked visit order</h2>
      <ol class="report-stop-order">
        ${orderedStops.map((candidate) => `
          <li>
            <b>${escapeHtml(candidate.name)}</b>
            <span>${reportCoordinate(candidate)} · ${candidate.score} score · ${candidate.species.size} species</span>
            ${reportDirectionsLink([candidate], "Map link")}
          </li>`).join("")}
      </ol>`;
  }

  if (!orderedStops.length) {
    return `
      <h2>Stop order</h2>
      <p class="report-note">No stops were pinned before export. Use the ranked stops below as the fallback priority order.</p>`;
  }

  const legs = [];
  if (state.origin) {
    legs.push({ label: "Start", name: state.origin.name || state.params.origin, point: state.origin, directionsFrom: null });
  }
  orderedStops.forEach((candidate, index) => {
    const previous = index === 0 ? state.origin : orderedStops[index - 1];
    legs.push({
      label: `Stop ${index + 1}`,
      name: candidate.name,
      point: candidate,
      directionsFrom: previous ? [previous, candidate] : [candidate],
      meta: `+${Math.round(candidate.addedMinutes)} min single-stop detour · ${candidate.species.size} species`
    });
  });
  if (state.destination) {
    const previous = orderedStops.at(-1) || state.origin;
    legs.push({
      label: "End",
      name: state.destination.name || state.params.destination,
      point: state.destination,
      directionsFrom: previous ? [previous, state.destination] : [state.destination]
    });
  }

  return `
    <h2>Stop order</h2>
    <ol class="report-stop-order">
      ${legs.map((leg) => `
        <li>
          <b>${escapeHtml(leg.label)}: ${escapeHtml(leg.name || "")}</b>
          <span>${reportCoordinate(leg.point)}${leg.meta ? ` · ${escapeHtml(leg.meta)}` : ""}</span>
          ${leg.directionsFrom ? reportDirectionsLink(leg.directionsFrom, "Leg directions") : ""}
        </li>`).join("")}
    </ol>`;
}

function buildTargetCoverageBlock() {
  const targets = state.params?.targets || [];
  if (!targets.length) {
    return `
      <h2>Species targets</h2>
      <p class="report-note">No target species were entered for this search. Use likely lifers, notable birds, and recent species lists as field priorities.</p>`;
  }

  const matchedTargets = targets.map((target) => {
    const matches = [];
    for (const [index, candidate] of state.results.entries()) {
      const obs = candidate.targetMatches.find((item) => normalizeName(item.comName || item.sciName) === target);
      if (obs) matches.push({ candidate, index, obs });
    }
    return {
      target,
      display: targetDisplayName(target, matches),
      matches
    };
  });

  return `
    <h2>Species targets</h2>
    <ul class="report-target-list">
      ${matchedTargets.map((entry) => `
        <li>
          <b>${escapeHtml(entry.display)}</b>
          ${entry.matches.length
            ? `<span>${entry.matches.slice(0, 4).map(({ candidate, index, obs }) => `#${index + 1} ${escapeHtml(candidate.name)}${obs.obsDt ? ` (${escapeHtml(obs.obsDt)})` : ""}`).join("; ")}</span>`
            : "<span>No match in ranked stops for the selected date window.</span>"}
        </li>`).join("")}
    </ul>`;
}

function targetDisplayName(target, matches) {
  const observedName = matches.find(({ obs }) => obs.comName || obs.sciName)?.obs;
  if (observedName) return observedName.comName || observedName.sciName;
  return target.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function buildFallbackNotesBlock(isArea, orderedStops) {
  const notes = [
    "Coordinates, stop order, species lists, and the schematic map are saved in this packet for no-signal use.",
    "External map, directions, and eBird links are included for reconnecting later; if they do not load, navigate by the listed coordinates.",
    "Recent sightings are a planning snapshot. Check access signs, closures, daylight, weather, and safety before birding a stop."
  ];
  if (!isArea && !orderedStops.length) {
    notes.push("No itinerary stops were pinned, so the ranked stop list is the fallback order.");
  }
  if (state.warnings.length) {
    notes.push(`Search warnings: ${state.warnings.join(" ")}`);
  }

  return `
    <h2>Fallback notes</h2>
    <ul class="report-fallback-list">
      ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
    </ul>`;
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
  const orderedStops = reportOrderedStops(isArea);
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

  const allRoutePoints = reportRoutePoints(orderedStops);
  const summaryBlock = isArea ? `
    <h2>Area summary</h2>
    <dl class="report-route">
      ${param("Location", state.routeName || p.origin)}
      ${param("Radius", `${p.radiusKm} km`)}
      ${param("Ranked stops", state.results.length)}
      ${state.areaCenter ? param("Center coordinates", `${state.areaCenter.lat.toFixed(5)}, ${state.areaCenter.lng.toFixed(5)}`) : ""}
    </dl>` : `
    <h2>Route summary</h2>
    <dl class="report-route">
      ${param("Route", state.routeName || `${p.origin} to ${p.destination}`)}
      ${param("Distance", `${miles(route.distanceMeters).toFixed(0)} mi`)}
      ${param("Drive time", formatMinutes(route.durationSeconds / 60))}
      ${param("Ranked stops", state.results.length)}
      ${param("Pinned stops", state.pinnedIds.length)}
      ${state.itinerary?.status === "ready" ? param("Pinned route added", `+${formatMinutes(state.itinerary.addedMinutes)} / +${state.itinerary.addedMiles.toFixed(1)} mi`) : ""}
      ${param("Full directions", reportDirectionsLink(allRoutePoints, "Open route"), { raw: true })}
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
            <p class="report-stop-reason">${escapeHtml(candidateReasonText(candidate, isArea))}</p>
            <dl class="report-stop-route">
              ${param("Coordinates", `${candidate.lat.toFixed(5)}, ${candidate.lng.toFixed(5)}`)}
              ${param("Directions", `<a href="${escapeHtml(links.mapsUrl)}">${escapeHtml(links.mapsUrl)}</a>`, { raw: true })}
              ${param("eBird", `<a href="${escapeHtml(links.ebirdUrl)}">${escapeHtml(links.ebirdUrl)}</a>`, { raw: true })}
            </dl>
            ${candidate.targetMatches.length ? `<h4>Species targets</h4><ul>${candidate.targetMatches.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")}${obs.obsDt ? ` <small>${escapeHtml(obs.obsDt)}</small>` : ""}</li>`).join("")}</ul>` : ""}
            ${candidate.liferSpecies.length ? `<h4>Likely lifers</h4><ul>${candidate.liferSpecies.slice(0, 20).map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")}</li>`).join("")}</ul>` : ""}
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
    ${buildReportMapMarkup(isArea, orderedStops)}
    ${buildStopOrderBlock(isArea, orderedStops)}
    ${buildTargetCoverageBlock()}
    ${buildFallbackNotesBlock(isArea, orderedStops)}
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

.report .report-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin: 22px 0 8px;
  border-bottom: 1px solid var(--line-strong);
}

.report .report-section-heading h2 {
  margin: 0;
  border-bottom: 0;
}

.report .report-section-heading a {
  color: #065f46;
  font-size: 0.85rem;
  font-weight: 800;
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

.report .report-map-card {
  break-inside: avoid;
}

.report .report-map {
  width: 100%;
  height: auto;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  overflow: hidden;
}

.report .report-map-bg {
  fill: #eef6f1;
}

.report .report-map-radius {
  fill: rgba(59, 130, 246, 0.11);
  stroke: #3b82f6;
  stroke-dasharray: 7 6;
  stroke-width: 2;
}

.report .report-map-route {
  fill: none;
  stroke: #2563eb;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5;
}

.report .report-map-stop circle {
  fill: #065f46;
  stroke: white;
  stroke-width: 3;
}

.report .report-map-endpoint rect {
  fill: #10201a;
  stroke: white;
  stroke-width: 3;
}

.report .report-map-stop text,
.report .report-map-endpoint text {
  fill: white;
  font-size: 11px;
  font-weight: 900;
  text-anchor: middle;
}

.report .report-note {
  color: var(--muted-strong);
  font-size: 0.88rem;
  margin: 6px 0 0;
}

.report .report-stop-order,
.report .report-target-list,
.report .report-fallback-list {
  margin: 6px 0 0;
  padding-left: 22px;
  font-size: 0.9rem;
}

.report .report-stop-order li,
.report .report-target-list li,
.report .report-fallback-list li {
  margin: 5px 0;
}

.report .report-stop-order span,
.report .report-target-list span {
  display: block;
  color: var(--muted-strong);
}

.report .report-stop-order a {
  color: #065f46;
  font-weight: 800;
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

  .report .report-section-heading {
    display: block;
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
    this.itineraryLayer = null;
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
    this.clearItineraryRoute();
    if (this.routeLayer) this.map.removeLayer(this.routeLayer);
    const latLngs = coordinates.map(([lng, lat]) => [lat, lng]);
    this.routeLayer = L.polyline(latLngs, {
      color: "#3b82f6",
      weight: 5,
      opacity: 0.86
    }).addTo(this.map);
    this.map.fitBounds(this.routeLayer.getBounds(), { padding: [34, 34] });
  }

  setItineraryRoute(coordinates) {
    if (this.itineraryLayer) this.map.removeLayer(this.itineraryLayer);
    const latLngs = coordinates.map(([lng, lat]) => [lat, lng]);
    this.itineraryLayer = L.polyline(latLngs, {
      color: "#f59e0b",
      weight: 5,
      opacity: 0.92,
      dashArray: "8 7"
    }).addTo(this.map);
    this.map.fitBounds(this.itineraryLayer.getBounds(), { padding: [42, 42] });
  }

  clearItineraryRoute() {
    if (this.itineraryLayer) {
      this.map.removeLayer(this.itineraryLayer);
      this.itineraryLayer = null;
    }
  }

  setArea(center, radiusKm) {
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    this.clearItineraryRoute();
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
    this.clearItineraryRoute();
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
    this.itineraryLayer = null;
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
    this.clearItineraryRoute();
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

  setItineraryRoute(coordinates) {
    if (this.itineraryLayer) this.itineraryLayer.setMap(null);
    const path = coordinates.map(([lng, lat]) => ({ lat, lng }));
    const maps = window.google.maps;
    this.itineraryLayer = new maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#f59e0b",
      strokeOpacity: 0.92,
      strokeWeight: 5,
      icons: [{
        icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
        offset: "0",
        repeat: "18px"
      }],
      map: this.map
    });
    const bounds = new maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    this.map.fitBounds(bounds, 42);
  }

  clearItineraryRoute() {
    if (this.itineraryLayer) {
      this.itineraryLayer.setMap(null);
      this.itineraryLayer = null;
    }
  }

  setArea(center, radiusKm) {
    if (this.routeLayer) {
      this.routeLayer.setMap(null);
      this.routeLayer = null;
    }
    this.clearItineraryRoute();
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
    this.clearItineraryRoute();
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
  if (candidate.__sighting) {
    const label = candidate.count > 1 ? candidate.count : "";
    return `<div class="bird-marker marker-sighting ${candidate.id === selectedId ? "marker-selected" : ""}">${label}</div>`;
  }
  const pinnedIndex = state.pinnedIds.indexOf(candidate.id);
  const label = pinnedIndex >= 0 ? `P${pinnedIndex + 1}` : index + 1;
  return `<div class="bird-marker ${markerClass(candidate)} ${candidate.id === selectedId ? "marker-selected" : ""}">${label}</div>`;
}

function markerPopup(candidate) {
  if (candidate.__sighting) {
    const when = candidate.latest ? formatFreshness(candidate.latest) : "recently";
    const howMany = candidate.maxCount ? `; up to ${candidate.maxCount} seen` : "";
    return `<strong>${escapeHtml(candidate.name)}</strong><br>${candidate.count} ${pluralize("report", candidate.count)} (${escapeHtml(when)})${howMany}`;
  }
  const pinnedIndex = state.pinnedIds.indexOf(candidate.id);
  const pinnedText = pinnedIndex >= 0 ? `<br>Pinned stop ${pinnedIndex + 1}` : "";
  const impact = state.params?.mode === "area"
    ? `${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi from center`
    : `+${Math.round(candidate.addedMinutes)} min`;
  return `<strong>${escapeHtml(candidate.name)}</strong><br>${candidate.score} score; ${impact}<br>${candidate.species.size} recent species${pinnedText}`;
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
