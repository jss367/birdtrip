const state = {
  mode: "route",
  mapAdapter: null,
  route: null,
  routeName: "",
  results: [],
  resultOrder: "score",
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
  ebirdAccessIssue: null,
  provider: "osm",
  userSelectedProvider: false,
  ebirdModalPrompted: false,
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

const ranking = window.BirdtripRanking;
const timing = window.BirdtripTiming;
const navigationExport = window.BirdtripNavigationExport;
const SCORING_VERSION = 2;
const DISCOVERY_QUERY_RADIUS_KM = 200;
const ACTIVITY_QUERY_RADIUS_KM = 50;
const MAX_DISCOVERY_SAMPLES = 16;
const MAX_ACTIVITY_SAMPLES = 14;
const ACTIVITY_MAX_RESULTS = 1000;
const MAX_EVIDENCE_HOTSPOTS = 40;
const MAX_INITIAL_DETOURS = 20;
const MAX_TOTAL_DETOURS = 40;
const MAX_ROUTE_TARGETS = 10;
const MAX_ROUTE_TARGET_LOOKUPS = 20;
const MAX_ROUTE_UNSEEN_PROBES = 10;
const SESSION_TOKEN_KEY = "birdtripEbirdApiToken";

const els = {
  resultsActions: document.querySelector("#resultsActions"),
  shareTripButton: document.querySelector("#shareTripButton"),
  downloadReportButton: document.querySelector("#downloadReportButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsModal: document.querySelector("#settingsModal"),
  closeSettingsButton: document.querySelector("#closeSettingsButton"),
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
  maxDetourField: document.querySelector("#maxDetourField"),
  maxDetour: document.querySelector("#maxDetour"),
  recentDays: document.querySelector("#recentDays"),
  radiusKm: document.querySelector("#radiusKm"),
  radiusKmLabel: document.querySelector("#radiusKmLabel"),
  maxStops: document.querySelector("#maxStops"),
  departTimeField: document.querySelector("#departTimeField"),
  departTime: document.querySelector("#departTime"),
  orderToggle: document.querySelector("#orderToggle"),
  orderByScore: document.querySelector("#orderByScore"),
  orderByArrival: document.querySelector("#orderByArrival"),
  ebirdAccessStatus: document.querySelector("#ebirdAccessStatus"),
  apiToken: document.querySelector("#apiToken"),
  rememberToken: document.querySelector("#rememberToken"),
  targets: document.querySelector("#targets"),
  targetRows: document.querySelector("#targetRows"),
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
  navigationExport: document.querySelector("#navigationExport"),
  navigationExportSummary: document.querySelector("#navigationExportSummary"),
  googleMapsRouteLink: document.querySelector("#googleMapsRouteLink"),
  downloadGpxButton: document.querySelector("#downloadGpxButton"),
  resultsList: document.querySelector("#resultsList"),
  resultTemplate: document.querySelector("#resultTemplate"),
  detailsPanel: document.querySelector("#detailsPanel"),
  detailsContent: document.querySelector("#detailsContent"),
  closeDetails: document.querySelector("#closeDetails"),
  submitLabel: document.querySelector("#submitLabel"),
  mapRegion: document.querySelector(".map-region"),
  mapAreaLegend: document.querySelector("#mapAreaLegend"),
  mapGlass: document.querySelector("#mapGlass"),
  resultsTitle: document.querySelector("#resultsTitle"),
  resultLegend: document.querySelector("#resultLegend"),
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

const PREF_FIELDS = [
  "origin",
  "destination",
  "mapProvider",
  "maxDetour",
  "recentDays",
  "radiusKm",
  "maxStops",
  "departTime",
  "targets",
  "speciesQuery"
];

function normalizeMode(mode) {
  return mode === "area" || mode === "species" ? mode : "route";
}
const SAVED_TRIPS_KEY = "birdtripSavedTrips";
const CONFIG_WAIT_TIMEOUT_MS = 6000;
const SHARE_URL_VERSION = "1";

const MIGRATION_PAGE_GROUPS = ["all", "warblers", "waterfowl", "shorebirds", "raptors", "hummingbirds"];

function redirectLegacyMigrationLink() {
  const search = new URLSearchParams(window.location.search);
  if (search.get("bt") !== SHARE_URL_VERSION || search.get("mode") !== "migration") return false;
  const url = new URL("./migration.html", window.location.href);
  const group = search.get("migrationGroup");
  if (MIGRATION_PAGE_GROUPS.includes(group)) url.searchParams.set("group", group);
  const month = legacyMigrationMonth(search);
  if (month !== "") url.searchParams.set("month", month);
  window.location.replace(url);
  return true;
}

function legacyMigrationMonth(search) {
  // Intentional copy of cleanSharedNumber: the redirect must stay self-contained.
  const num = (value, min, max) => {
    if (value === null) return "";
    const number = clamp(Number(value), min, max);
    return Number.isFinite(number) ? String(number) : "";
  };
  const month = num(search.get("migrationMonth"), 0, 11);
  if (month !== "") return month;
  const legacySeason = search.get("migrationSeason");
  const legacyWeek = num(search.get("migrationWeek"), 0, 8);
  if (legacySeason === "fall") return legacyWeek === "" ? "8" : String(clamp(7 + Math.round(Number(legacyWeek) / 4), 7, 10));
  if (legacySeason === "spring") return legacyWeek === "" ? "3" : String(clamp(1 + Math.round(Number(legacyWeek) / 3), 1, 4));
  return "";
}

function init() {
  if (redirectLegacyMigrationLink()) return;
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
  els.rememberToken.addEventListener("change", () => {
    savePreferences();
    saveSessionApiToken();
  });
  els.apiToken.addEventListener("change", () => {
    if (els.rememberToken.checked) savePreferences();
    saveSessionApiToken();
    clearPersonalEbirdAccessIssue();
    updateSetupStatus();
  });
  els.apiToken.addEventListener("input", () => {
    saveSessionApiToken();
    clearPersonalEbirdAccessIssue();
    updateSetupStatus();
  });
  els.mapProvider.addEventListener("change", () => {
    state.userSelectedProvider = true;
    setMapProvider(providerFromInput());
  });
  els.lifeListInput.addEventListener("change", handleLifeListFile);
  els.clearLifeListButton.addEventListener("click", clearLifeList);
  els.maxDetour.addEventListener("input", updateInputSummaries);
  els.shareTripButton.addEventListener("click", shareCurrentTrip);
  els.downloadReportButton.addEventListener("click", downloadHtmlReport);
  els.settingsButton.addEventListener("click", () => openSettingsModal());
  els.closeSettingsButton.addEventListener("click", () => els.settingsModal.close());
  els.settingsModal.addEventListener("click", (event) => {
    // Clicks on the dialog's own padding and grid gaps also target the dialog,
    // so only treat clicks outside its rectangle as backdrop clicks.
    if (event.target !== els.settingsModal) return;
    const rect = els.settingsModal.getBoundingClientRect();
    const insidePanel = event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!insidePanel) els.settingsModal.close();
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
  els.orderByScore.addEventListener("click", () => setResultOrder("score"));
  els.orderByArrival.addEventListener("click", () => setResultOrder("arrival"));
  els.departTime.addEventListener("change", handleDepartTimeChange);
  els.clearComparisonButton.addEventListener("click", clearComparison);
  els.clearItinerary.addEventListener("click", clearPinnedStops);
  els.downloadGpxButton.addEventListener("click", downloadGpxRoute);
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

function openSettingsModal(options = {}) {
  if (!els.settingsModal.open) els.settingsModal.showModal();
  if (options.focusToken) els.apiToken.focus();
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
    departTime: cleanTimeString(search.get("departTime")),
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
  // Applied unconditionally: a shared link that omits the optional departure
  // time should clear any restored preference so the recipient sees the trip
  // the sender shared, not arrival warnings from their own previous state.
  els.departTime.value = shared.departTime || "";
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

function cleanTimeString(value) {
  const text = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "";
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
  } else {
    try {
      els.apiToken.value = sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
    } catch {
      // Session storage unavailable; the token remains page-scoped.
    }
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

function saveSessionApiToken() {
  try {
    const token = els.apiToken.value.trim();
    if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    else sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Session storage unavailable; the token still works on this page.
  }
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
  els.maxDetourField.hidden = state.mode !== "route";
  els.maxDetour.disabled = isAreaLike;
  els.departTimeField.hidden = state.mode !== "route";
  els.departTime.disabled = isAreaLike;
  els.radiusKmLabel.textContent = isSpecies ? "Search radius" : isArea ? "Area radius" : "Corridor radius";
  els.submitLabel.textContent = isSpecies ? "Map Sightings" : isArea ? "Search Area" : "Find Stops";
  els.routeDistanceLabel.textContent = isSpecies ? "Search Radius" : isArea ? "Area Radius" : "Route Miles";
  els.maxAddedLabel.textContent = isSpecies ? "Species Mode" : isArea ? "Area Mode" : "Added Time Budget";
  els.mapAreaLegend.textContent = isAreaLike ? "Search area" : "Route corridor";
  els.sampleButton.title = isSpecies ? "Use sample species search" : isArea ? "Use sample area" : "Use sample route";
  els.resultsTitle.textContent = isSpecies ? "Recent Sightings" : "Ranked Stops";
  els.comparisonPanel.hidden = state.comparisonIds.length === 0;
  updateMapLegend();
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
      departTime: typeof state.params.departTime === "string" ? state.params.departTime : els.departTime.value,
      targets: Array.isArray(state.params.targets) ? state.params.targets.join("\n") : els.targets.value,
      speciesQuery: typeof state.params.speciesQuery === "string" ? state.params.speciesQuery : els.speciesQuery.value,
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
  // Trips saved before departTime existed carry no stored value; clear the
  // field so a stale visible time is not silently applied when rerunning.
  if (typeof settings.departTime !== "string") els.departTime.value = "";
  if (typeof settings.searchMode === "string") {
    setSearchMode(settings.searchMode, { persist: false });
  }
  updateInputSummaries();
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
    areaCenter: state.areaCenter,
    species: state.species,
    sightings: state.sightings,
    sightingLocations: state.sightingLocations,
    selectedSightingId: state.selectedSightingId
  };
}

function serializeCandidate(candidate) {
  const evidence = isObjectRecord(candidate.evidence)
    ? {
        ...candidate.evidence,
        recent: isObjectRecord(candidate.evidence.recent)
          ? { ...candidate.evidence.recent, observations: undefined }
          : candidate.evidence.recent
      }
    : candidate.evidence;
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
    routeProgress: candidate.routeProgress,
    targetMatches: candidate.targetMatches,
    viaRoute: candidate.viaRoute,
    addedMinutes: candidate.addedMinutes,
    addedMiles: candidate.addedMiles,
    allTimeSpeciesCount: candidate.allTimeSpeciesCount,
    latestObservationDate: candidate.latestObservationDate,
    activityPrior: candidate.activityPrior,
    activityObserved: candidate.activityObserved,
    discoverySources: candidate.discoverySources,
    evidence,
    scoreParts: candidate.scoreParts,
    scoringVersion: candidate.scoringVersion,
    enabledScoreParts: candidate.enabledScoreParts,
    scoredWithLifeList: candidate.scoredWithLifeList,
    score: candidate.score
  };
}

function restoreTripState(trip) {
  const savedState = trip.state || {};
  state.routeName = savedState.routeName || "";
  state.route = savedState.route || null;
  const savedResults = Array.isArray(savedState.results)
    ? savedState.results.filter(isObjectRecord)
    : [];
  // Trips saved before routeProgress was serialized restore without it, which
  // would hide arrival timing and drive-order sorting until a fresh search.
  // Rebuild the missing metrics from the saved route geometry.
  if (state.route?.geometry?.coordinates) {
    ranking.backfillRouteMetrics(savedResults, state.route.geometry.coordinates);
  }
  state.results = savedResults.map(hydrateCandidate);
  state.selectedId = savedState.selectedId || null;
  state.warnings = Array.isArray(savedState.warnings) ? savedState.warnings : [];
  state.params = isObjectRecord(savedState.params)
    ? { ...savedState.params, mapProvider: state.provider, token: els.apiToken.value.trim() }
    : null;
  state.origin = savedState.origin || state.route?.origin || null;
  state.destination = savedState.destination || state.route?.destination || null;
  state.areaCenter = savedState.areaCenter || null;
  state.species = isObjectRecord(savedState.species) ? savedState.species : null;
  state.sightings = Array.isArray(savedState.sightings) ? savedState.sightings.filter(isObjectRecord) : [];
  state.sightingLocations = Array.isArray(savedState.sightingLocations)
    ? savedState.sightingLocations.filter(isObjectRecord)
    : [];
  state.selectedSightingId = savedState.selectedSightingId || null;
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

  if (state.params?.mode === "species") {
    if (els.speciesQuery) els.speciesQuery.value = state.species?.comName || state.params.speciesQuery || els.speciesQuery.value;
    renderSightings(state.species, state.areaCenter, state.params);
  } else if (state.results.length) {
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

  const evidence = isObjectRecord(candidate.evidence)
    ? {
        ...candidate.evidence,
        recent: isObjectRecord(candidate.evidence.recent)
          ? {
              ...candidate.evidence.recent,
              observations: Array.isArray(candidate.evidence.recent.observations)
                ? candidate.evidence.recent.observations.filter(isObjectRecord)
                : observations
            }
          : { status: "legacy", observations }
      }
    : {
        recent: { status: "legacy", observations },
        seasonal: { status: "unavailable" },
        notableNearby: { status: "legacy", observations: notable }
      };

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
    // Left undefined for trips saved before this was recorded, so scoreScale can
    // tell "scored without a life list" apart from "we don't know".
    scoredWithLifeList: typeof candidate.scoredWithLifeList === "boolean" ? candidate.scoredWithLifeList : undefined,
    scoringVersion: Number.isFinite(candidate.scoringVersion) ? candidate.scoringVersion : 1,
    enabledScoreParts: Array.isArray(candidate.enabledScoreParts) ? candidate.enabledScoreParts : [],
    evidence,
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
  els.orderToggle.hidden = true;
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
    state.ebirdAccessIssue = null;
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
  const sightingLocations = preserveData && Array.isArray(state.sightingLocations) ? state.sightingLocations : [];

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
  if (sightingLocations.length) {
    renderSightingMarkers();
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
  els.orderToggle.hidden = true;
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
  state.ebirdModalPrompted = false;
  setBusy(true);

  try {
    await waitForAppConfig();
    if (state.ebirdAccessIssue && hasEbirdAccess()) {
      state.ebirdAccessIssue = null;
      updateSetupStatus();
    }
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
  renderNavigationExport();

  if (!shouldAttemptEbirdSearch()) {
    setStatus("eBird access needed", "Route loaded. Add a personal eBird token in Settings (the gear icon) to rank live birding stops.");
    els.resultContext.textContent = "Route loaded, but live bird data needs eBird access.";
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="feather"></i><p>Add a personal eBird token in Settings (the gear icon) to rank live birding stops.</p></div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  setStatus("Discovering stops", "Finding known eBird hotspots across the complete route corridor.");
  const discoveryPlan = ranking.sampleRouteForCoverage(route.geometry.coordinates, {
    corridorRadiusKm: params.radiusKm,
    queryRadiusKm: DISCOVERY_QUERY_RADIUS_KM,
    maxSamples: MAX_DISCOVERY_SAMPLES
  });
  const activityPlan = ranking.sampleRouteForCoverage(route.geometry.coordinates, {
    corridorRadiusKm: params.radiusKm,
    queryRadiusKm: ACTIVITY_QUERY_RADIUS_KM,
    maxSamples: MAX_ACTIVITY_SAMPLES
  });
  const routeIndex = ranking.createRouteIndex(route.geometry.coordinates);
  if (!discoveryPlan.coverageComplete) {
    addWarning(`This route needs ${discoveryPlan.requiredSamples} discovery samples for full coverage; Birdtrip checked ${discoveryPlan.samples.length}. Results cover only part of the requested corridor.`);
  }
  if (!activityPlan.coverageComplete) {
    const reason = activityPlan.coverageFeasible
      ? `${activityPlan.requiredSamples} samples are needed for full coverage; Birdtrip checked ${activityPlan.samples.length}`
      : `eBird's ${activityPlan.queryRadiusKm} km recent-report radius cannot geometrically cover the full ${params.radiusKm} km corridor between samples`;
    addWarning(`Current-activity coverage is partial: ${reason}. Hotspot discovery is unaffected, but activity and imported-list signals may be incomplete.`);
  }
  const [discoveredHotspots, activityBySample] = await Promise.all([
    fetchHotspotDirectoryForRoute(
      discoveryPlan.samples,
      routeIndex,
      params
    ),
    fetchRecentForSamples(activityPlan.samples, params, activityPlan.queryRadiusKm)
  ]);
  applyActivityPrior(discoveredHotspots, activityBySample, params);
  const initialShortlist = shortlistHotspots(discoveredHotspots, params, "route");
  const targetRescues = await rescueRouteTargetHotspots(
    discoveredHotspots,
    initialShortlist,
    activityPlan.samples,
    params
  );
  for (const hotspot of targetRescues) {
    hotspot.activityTargetCount = Math.max(1, hotspot.activityTargetCount || 0);
    hotspot.explicitTargetRescue = true;
  }
  const targetAwareShortlist = shortlistHotspots(discoveredHotspots, params, "route");
  const unseenProbes = reserveRouteUnseenEvidence(discoveredHotspots, targetAwareShortlist, params);
  for (const hotspot of unseenProbes) hotspot.importedListProbe = true;
  const shortlistedHotspots = shortlistHotspots(discoveredHotspots, params, "route");
  const hotspotEvidence = await fetchRecentForHotspots(shortlistedHotspots, params);
  const candidates = buildCandidatesFromHotspots(
    hotspotEvidence,
    params,
    routeIndex
  );

  if (!candidates.length) {
    setStatus("No candidates", "No known eBird hotspots were found in the covered route corridor. Try a wider radius.");
    els.resultContext.textContent = "No birding locations matched the current route settings.";
    renderWarnings();
    return;
  }

  setStatus("Checking detours", `Evaluating route impact for the strongest ${Math.min(candidates.length, Math.max(params.maxStops, 15))} candidates first.`);
  const practical = await evaluateDetours(candidates, origin, destination, route.durationSeconds, params);

  if (!practical.length) {
    setStatus("No stops within budget", "Try increasing the maximum added time or route radius.");
    els.resultContext.textContent = "Candidate birding locations were outside the detour budget.";
    renderWarnings();
    return;
  }

  scoreCandidates(practical, params);

  state.results = practical
    .filter((candidate) => candidate.addedMinutes <= params.maxDetour)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.maxStops);
  setStatus("Adding notable birds", "Checking nearby notable reports for the strongest practical candidates.");
  await addNotableObservations(state.results, params);

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
    setStatus("eBird access needed", "Area loaded. Add a personal eBird token in Settings (the gear icon) to rank live birding stops.");
    els.resultContext.textContent = "Area loaded, but live bird data needs eBird access.";
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="feather"></i><p>Add a personal eBird token in Settings (the gear icon) to rank live birding stops.</p></div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  setStatus("Discovering stops", "Finding known eBird hotspots near the selected location.");
  const samples = [{ lat: center.lat, lng: center.lng, index: 0 }];
  const [hotspots, activityBySample] = await Promise.all([
    apiJson(
      `/api/ebird/hotspots?lat=${center.lat}&lng=${center.lng}&dist=${params.radiusKm}`,
      { token: params.token }
    ),
    fetchRecentForSamples(samples, params)
  ]);
  applyActivityPrior(hotspots, activityBySample, params);
  const rankedHotspots = rankAreaHotspots(hotspots, center, params);
  const targetHotspots = await rescueTargetHotspots(hotspots, rankedHotspots, center, params);
  const liferHotspots = await rescueLiferHotspots(hotspots, rankedHotspots.concat(targetHotspots), center, params);
  targetHotspots.forEach((hotspot) => { hotspot.activityTargetCount = Math.max(1, hotspot.activityTargetCount || 0); });
  liferHotspots.forEach((hotspot) => { hotspot.activityUnseenCount = Math.max(1, hotspot.activityUnseenCount || 0); });
  const mergedAreaHotspots = mergeUniqueHotspots(rankedHotspots, targetHotspots, liferHotspots).map((hotspot) => ({
    ...hotspot,
    distanceKm: Number.isFinite(hotspot.distanceKm) ? hotspot.distanceKm : haversineKm(center, hotspot),
    routeDistanceKm: Number.isFinite(hotspot.routeDistanceKm) ? hotspot.routeDistanceKm : haversineKm(center, hotspot),
    areaAngle: Number.isFinite(hotspot.areaAngle)
      ? hotspot.areaAngle
      : Math.atan2(hotspot.lat - center.lat, hotspot.lng - center.lng)
  }));
  const selectedHotspots = shortlistHotspots(
    mergedAreaHotspots,
    params,
    "area"
  );
  const hotspotEvidence = await fetchRecentForHotspots(selectedHotspots, params);
  const candidates = buildCandidatesFromHotspots(hotspotEvidence, params, null, center);

  if (!candidates.length) {
    setStatus("No candidates", "No known eBird hotspots were found in this area. Try a wider radius.");
    els.resultContext.textContent = "No birding locations matched the current area settings.";
    renderWarnings();
    return;
  }

  const practical = candidates.map((candidate) => ({
    ...candidate,
    addedMinutes: 0,
    addedMiles: 0
  }));

  scoreCandidates(practical, params);

  state.results = practical
    .sort((a, b) => b.score - a.score)
    .slice(0, params.maxStops);
  setStatus("Adding notable birds", "Checking recent notable reports for the strongest area matches.");
  await addNotableObservations(state.results, params);

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
    setStatus("eBird access needed", "Location loaded. Add a personal eBird token in Settings (the gear icon) to map species sightings.");
    els.resultContext.textContent = "Location loaded, but live bird data needs eBird access.";
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="feather"></i><p>Add a personal eBird token in Settings (the gear icon) to map species sightings.</p></div>';
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
    state.sightingLocations.length
      ? `Mapped ${state.sightingLocations.length} ${pluralize("location", state.sightingLocations.length)} with recent ${label} sightings (latest observation per location).`
      : `No recent ${label} sightings within ${params.radiusKm} km. Try a wider radius or longer recent window.`
  );
}

function updateMapLegend() {
  if (!els.mapGlass) return;
  els.mapGlass.innerHTML = `
    <span><b class="legend-dot target"></b> Target species</span>
    <span><b class="legend-dot lifer"></b> Unseen recent report</span>
    <span><b class="legend-dot notable"></b> Notable birds</span>
    <span><b class="legend-dot hotspot"></b> Ranked hotspot</span>
    <span><b class="legend-dot pinned"></b> Pinned stop</span>
    <span><b class="legend-dot sighting"></b> Species sighting</span>
    <span><b class="legend-line route"></b> <span id="mapAreaLegend">${state.mode === "area" || state.mode === "species" ? "Search area" : "Route corridor"}</span></span>
  `;
  els.mapAreaLegend = document.querySelector("#mapAreaLegend");
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
  const speciesLabel = species?.comName || params.speciesQuery;

  els.candidateCount.textContent = String(locations.length);
  els.notableCount.textContent = "-";
  els.hotspotCount.textContent = "-";
  els.liferCount.textContent = "-";
  els.targetCount.textContent = String(locations.length);
  els.resultContext.textContent = locations.length
    ? `${speciesLabel}: ${locations.length} ${pluralize("location", locations.length)} with recent sightings within ${params.radiusKm} km (latest observation per location).`
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
    const metaText = loc.maxCount ? `Latest observation · ${loc.maxCount} ${pluralize("bird", loc.maxCount)} counted` : "Latest observation";
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
    card.querySelector(".sighting-meta").textContent = metaText;
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
    departTime: cleanTimeString(els.departTime.value),
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
  if (cleanTimeString(els.departTime.value)) url.searchParams.set("departTime", cleanTimeString(els.departTime.value));
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

function updateResultsActions() {
  els.resultsActions.hidden = !hasReportableSearch();
}

function updateSetupStatus() {
  const hasAccess = hasEbirdAccess();
  const hasPersonalToken = Boolean(els.apiToken.value.trim());
  const hasServerAccess = Boolean(
    state.config.ebirdConfigured === true || state.config.ebird?.serverConfigured === true
  );
  const isChecking = state.config.ebirdConfigured === null && !els.apiToken.value.trim();
  const activeAccessIssue = state.ebirdAccessIssue && (
    state.ebirdAccessIssue.source === "personal" || !hasPersonalToken
  )
    ? state.ebirdAccessIssue
    : null;
  const hasWorkingAccess = hasAccess && !activeAccessIssue;
  els.setupStatus.classList.toggle("setup-checking", isChecking);
  els.setupStatus.classList.toggle("setup-ready", hasWorkingAccess);
  els.setupStatus.classList.toggle("setup-needed", !isChecking && !hasWorkingAccess);
  els.setupStatus.innerHTML = isChecking
    ? '<i data-lucide="loader-circle"></i>Checking Setup'
    : hasWorkingAccess
      ? '<i data-lucide="check-circle-2"></i>Ready to Search'
      : '<i data-lucide="circle-alert"></i>Setup Required';
  if (els.ebirdAccessStatus) {
    const accessState = isChecking
      ? {
          className: "is-checking",
          icon: "loader-circle",
          title: "Checking eBird access",
          detail: "Confirming live bird data availability."
        }
      : activeAccessIssue
        ? ebirdAccessIssueStatus(activeAccessIssue.status, hasPersonalToken)
        : hasPersonalToken
          ? {
              className: "is-personal",
              icon: "key-round",
              title: "Using your personal eBird token",
              detail: hasServerAccess
                ? "Your token overrides Birdtrip's shared access."
                : "Your token enables live sightings in this browser."
            }
          : hasServerAccess
            ? {
                className: "is-ready",
                icon: "check-circle-2",
                title: "Live eBird data included",
                detail: "Birdtrip's shared access is ready—no token needed."
              }
            : {
                className: "is-needed",
                icon: "circle-alert",
                title: "Personal eBird token needed",
                detail: "Add a token below to load live sightings."
              };
    els.ebirdAccessStatus.className = `ebird-access-status ${accessState.className}`;
    els.ebirdAccessStatus.innerHTML = `
      <i data-lucide="${accessState.icon}"></i>
      <div>
        <strong>${accessState.title}</strong>
        <small>${accessState.detail}</small>
      </div>
    `;
  }
  renderInsights();
  if (window.lucide) window.lucide.createIcons();
}

function ebirdAccessIssueStatus(status, hasPersonalToken) {
  if (status === 429) {
    return {
      className: "is-needed",
      icon: "clock-3",
      title: "eBird access is temporarily limited",
      detail: hasPersonalToken
        ? "Retry later or check the token you supplied."
        : "Retry later or use a personal token."
    };
  }
  return {
    className: "is-needed",
    icon: "circle-alert",
    title: hasPersonalToken ? "Personal eBird token not accepted" : "Shared eBird access is unavailable",
    detail: hasPersonalToken
      ? "Check your token below and try again."
      : "Add a personal token below and try again."
  };
}

function clearPersonalEbirdAccessIssue() {
  if (state.ebirdAccessIssue?.source === "personal") {
    state.ebirdAccessIssue = null;
  }
}

// A single search fans out into many eBird requests that can all fail with the
// same auth error, so prompt with the modal once per run — repeat failures only
// refresh the status copy. Background lookups (taxonomy autocomplete) never
// prompt and never consume the search's one prompt.
function revealEbirdTokenForError(status, source, options = {}) {
  state.ebirdAccessIssue = { status, source };
  updateSetupStatus();
  if (options.prompt === false || state.ebirdModalPrompted) return;
  state.ebirdModalPrompted = true;
  openSettingsModal({ focusToken: true });
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
  renderTargetRows();
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
  setStatus("Life list cleared", "Imported-list matches will no longer affect ranking.");
}

function updateLifeListStatus() {
  const count = state.lifeList.displayNames.length || state.lifeList.species.size;
  if (!count) {
    els.lifeListStatus.textContent = "Import an eBird or iNaturalist CSV to highlight recently reported species not on your list.";
    els.clearLifeListButton.disabled = true;
    return;
  }
  const source = state.lifeList.source ? `${state.lifeList.source} ` : "";
  const fileName = state.lifeList.fileName ? ` from ${state.lifeList.fileName}` : "";
  els.lifeListStatus.textContent = `${count} ${source}species imported${fileName}.`;
  els.clearLifeListButton.disabled = false;
}

function handleDepartTimeChange() {
  if (state.params) state.params.departTime = cleanTimeString(els.departTime.value);
  savePreferences();
  refreshSharedUrlIfPresent();
  renderResultsIfPresent();
}

function setResultOrder(order) {
  if (state.resultOrder === order) return;
  state.resultOrder = order;
  const byArrival = order === "arrival";
  els.orderByScore.classList.toggle("is-active", !byArrival);
  els.orderByArrival.classList.toggle("is-active", byArrival);
  els.orderByScore.setAttribute("aria-pressed", String(!byArrival));
  els.orderByArrival.setAttribute("aria-pressed", String(byArrival));
  if (state.results.length) {
    renderResults();
    renderMarkers();
    if (window.lucide) window.lucide.createIcons();
  }
}

// The departure time means clock time at the route origin. Without a
// lat/lng-to-IANA-timezone database we approximate: when the browser's UTC
// offset is plausible for the origin longitude (the common case — planning a
// trip in your own region), the browser timezone IS the route timezone and is
// used exactly, DST included. When it clearly is not (viewing a shared route
// from another part of the world), fall back to a longitude-based offset so
// departure, arrivals, and sunrise/sunset all stay in route-local time
// instead of shifting by the viewer's offset.
function routeTimeContext() {
  const browserOffsetMinutes = -new Date().getTimezoneOffset();
  const approxOffsetMinutes = timing?.approximateUtcOffsetMinutes?.(state.route?.origin?.lng);
  if (!Number.isFinite(approxOffsetMinutes) || Math.abs(browserOffsetMinutes - approxOffsetMinutes) <= 90) {
    return { offsetMinutes: browserOffsetMinutes, approximate: false };
  }
  return { offsetMinutes: approxOffsetMinutes, approximate: true };
}

// Clock display context for a single stop. Routes can cross time zones, so a
// stop whose rounded solar zone differs from the origin's is displayed with
// the origin's display offset shifted by the solar difference (approximate),
// while stops in the origin's zone keep the route context unchanged.
function stopTimeContext(lng) {
  const routeContext = routeTimeContext();
  const stopOffset = timing?.stopClockOffsetMinutes?.({
    originDisplayOffsetMinutes: routeContext.offsetMinutes,
    originLng: state.route?.origin?.lng,
    stopLng: lng
  });
  if (!stopOffset?.shifted) return routeContext;
  return { offsetMinutes: stopOffset.offsetMinutes, approximate: true };
}

function departureTimestamp() {
  const value = cleanTimeString(state.params?.departTime);
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  const context = routeTimeContext();
  if (!context.approximate) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes).getTime();
  }
  const offsetMs = context.offsetMinutes * 60000;
  const routeNow = new Date(Date.now() + offsetMs);
  return Date.UTC(routeNow.getUTCFullYear(), routeNow.getUTCMonth(), routeNow.getUTCDate(), hours, minutes) - offsetMs;
}

function candidateTiming(candidate) {
  if (!timing || state.params?.mode !== "route") return null;
  const departureMs = departureTimestamp();
  const durationSeconds = state.route?.durationSeconds;
  if (!departureMs || !Number.isFinite(durationSeconds) || !Number.isFinite(candidate.routeProgress)) return null;
  const arrivalMs = timing.estimateArrivalMs({
    departureMs,
    routeProgress: candidate.routeProgress,
    routeDurationSeconds: durationSeconds,
    addedMinutes: candidate.addedMinutes
  });
  const sun = timing.sunTimes(arrivalMs, candidate.lat, candidate.lng);
  if (!Number.isFinite(arrivalMs) || !sun) return null;
  const habitat = timing.inferStopTiming(candidate.name);
  const assessment = timing.assessArrival({
    arrivalMs,
    sunriseMs: sun.sunriseMs,
    sunsetMs: sun.sunsetMs,
    polar: sun.polar,
    window: habitat.window
  });
  if (!assessment) return null;
  return { arrivalMs, sun, habitat, assessment, lng: candidate.lng };
}

function formatClock(ms, context = routeTimeContext()) {
  if (!context.approximate) {
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return new Date(ms + context.offsetMinutes * 60000)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

function timingChipLabel(stopTiming) {
  switch (stopTiming.assessment.quality) {
    case "prime": return "prime time";
    case "good": return "good timing";
    case "fair": return "ok timing";
    case "dark": return "in the dark";
    default: return stopTiming.habitat.bestLabel;
  }
}

function timingSentence(stopTiming) {
  const context = stopTimeContext(stopTiming.lng);
  const arrival = formatClock(stopTiming.arrivalMs, context);
  const habitatName = stopTiming.habitat.habitat === "general" ? "This stop" : `This ${stopTiming.habitat.habitat} stop`;
  const sunPart = stopTiming.sun.polar
    ? ""
    : ` Sunrise ${formatClock(stopTiming.sun.sunriseMs, context)}, sunset ${formatClock(stopTiming.sun.sunsetMs, context)}.`;
  const zonePart = context.approximate ? " Times are approximate local time at this stop." : "";
  return `You'd reach this stop around ${arrival} — ${stopTiming.assessment.note}. ${habitatName} is ${stopTiming.habitat.bestLabel}.${sunPart}${zonePart}`;
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
  const currentCandidates = state.results.filter((candidate) => candidate.scoringVersion === SCORING_VERSION);
  if (currentCandidates.length) scoreCandidates(currentCandidates, params);
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
    els.shareTripButton,
    els.downloadReportButton,
    els.settingsButton,
    els.tripName,
    els.savedTripSelect,
    els.saveTripButton,
    els.loadTripButton,
    els.deleteTripButton,
    els.clearComparisonButton,
    els.clearItinerary,
    els.downloadGpxButton
  ];

  controls.forEach((control) => {
    if (control === els.maxDetour && state.mode !== "route") {
      control.disabled = true;
      return;
    }
    control.disabled = isBusy;
  });
  if (!isBusy) {
    updateSavedTripControls();
    updateResultsActions();
  }
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
    if (String(url).startsWith("/api/ebird/") && [401, 403, 429].includes(response.status)) {
      revealEbirdTokenForError(response.status, options.token ? "personal" : "shared", { prompt: !options.background });
    }
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
      { signal: controller.signal, token: els.apiToken.value.trim(), background: true }
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

// --- Target species rows ---

const targetRowsState = {
  // Unbounded by design: one small server-capped array per distinct query.
  taxonomy: new Map(), // normalized name -> Promise<matches[]|null>
  contexts: new WeakMap() // row element -> { acTimer, valToken, items, activeIndex }
};

function targetRowContext(row) {
  let ctx = targetRowsState.contexts.get(row);
  if (!ctx) {
    ctx = { acTimer: 0, valToken: 0, items: [], activeIndex: -1 };
    targetRowsState.contexts.set(row, ctx);
  }
  return ctx;
}

function cleanTargetName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function targetRowInputs() {
  return Array.from(els.targetRows.querySelectorAll(".target-row input"));
}

function serializeTargetRows() {
  return targetRowInputs()
    .map((input) => cleanTargetName(input.value))
    .filter(Boolean)
    .join("\n");
}

function syncTargetsFromRows() {
  els.targets.value = serializeTargetRows();
  updateInputSummaries();
}

function renderTargetRows() {
  if (!els.targetRows || !els.targets) return;
  const names = els.targets.value.split(/\n|,/).map(cleanTargetName).filter(Boolean);
  if (els.targetRows.childElementCount && serializeTargetRows() === names.join("\n")) return;
  els.targetRows.innerHTML = "";
  for (const name of names) els.targetRows.appendChild(createTargetRow(name));
  els.targetRows.appendChild(createTargetRow(""));
  if (window.lucide) window.lucide.createIcons();
}

function createTargetRow(name) {
  const row = document.createElement("div");
  row.className = "target-row";
  row.dataset.state = "empty";

  const wrap = document.createElement("div");
  wrap.className = "autocomplete";
  const input = document.createElement("input");
  input.type = "text";
  input.value = name;
  input.placeholder = "Add a species";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-label", "Target species");
  const status = document.createElement("span");
  status.className = "target-status";
  status.setAttribute("aria-hidden", "true");
  status.hidden = true;
  const list = document.createElement("ul");
  list.className = "autocomplete-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  wrap.append(input, status, list);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "target-remove";
  remove.setAttribute("aria-label", "Remove target species");
  remove.innerHTML = '<i data-lucide="x"></i>';

  const hint = document.createElement("small");
  hint.className = "target-hint";
  hint.hidden = true;

  row.append(wrap, remove, hint);

  input.addEventListener("input", () => handleTargetRowInput(row));
  input.addEventListener("keydown", (event) => handleTargetRowKeydown(row, event));
  input.addEventListener("blur", () => handleTargetRowBlur(row));
  input.addEventListener("paste", (event) => handleTargetRowPaste(row, event));
  remove.addEventListener("click", () => removeTargetRow(row));

  if (name) scheduleTargetRowValidation(row);
  return row;
}

function ensureTargetAddRow() {
  const inputs = targetRowInputs();
  const last = inputs[inputs.length - 1];
  if (!last || cleanTargetName(last.value)) {
    const row = createTargetRow("");
    els.targetRows.appendChild(row);
    if (window.lucide) window.lucide.createIcons();
  }
}

function removeTargetRow(row) {
  row.remove();
  syncTargetsFromRows();
  ensureTargetAddRow();
}

function commitTargetRow(row) {
  const input = row.querySelector("input");
  if (!cleanTargetName(input.value)) return;
  hideTargetRowAutocomplete(row);
  ensureTargetAddRow();
  const inputs = targetRowInputs();
  const next = inputs[inputs.indexOf(input) + 1];
  if (next) next.focus();
}

function handleTargetRowInput(row) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  if (input.value.includes(",")) {
    hideTargetRowAutocomplete(row);
    splitTargetRowValue(row);
    return;
  }
  syncTargetsFromRows();
  scheduleTargetRowValidation(row);
  const value = cleanTargetName(input.value);
  if (ctx.acTimer) clearTimeout(ctx.acTimer);
  if (value.length < 2) {
    hideTargetRowAutocomplete(row);
    return;
  }
  ctx.acTimer = setTimeout(() => fetchTargetRowAutocomplete(row, value), 220);
}

function handleTargetRowKeydown(row, event) {
  const ctx = targetRowContext(row);
  const listEl = row.querySelector(".autocomplete-list");
  if (!listEl.hidden && ctx.items.length) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveTargetRowSelection(row, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveTargetRowSelection(row, -1);
      return;
    }
    if (event.key === "Escape") {
      hideTargetRowAutocomplete(row);
      return;
    }
    if (event.key === "Enter" && ctx.activeIndex >= 0) {
      event.preventDefault();
      selectTargetRowItem(row, ctx.activeIndex);
      commitTargetRow(row);
      return;
    }
  }
  if (event.key === "Enter") {
    event.preventDefault();
    commitTargetRow(row);
  }
}

function handleTargetRowBlur(row) {
  setTimeout(() => {
    hideTargetRowAutocomplete(row);
    const input = row.querySelector("input");
    if (!input || document.activeElement === input) return;
    if (!cleanTargetName(input.value) && row !== els.targetRows.lastElementChild) {
      removeTargetRow(row);
    } else {
      ensureTargetAddRow();
    }
  }, 120);
}

function handleTargetRowPaste(row, event) {
  const text = event.clipboardData?.getData("text") || "";
  if (!/[\n,]/.test(text)) return;
  event.preventDefault();
  const input = row.querySelector("input");
  // Newlines are stripped when assigned to an input's value; commas survive
  // and split identically.
  input.value = text.replace(/\r\n?|\n/g, ",");
  splitTargetRowValue(row);
}

function splitTargetRowValue(row) {
  const input = row.querySelector("input");
  const names = input.value.split(/\n|,/).map(cleanTargetName).filter(Boolean);
  input.value = names[0] || "";
  let anchor = row;
  for (const name of names.slice(1)) {
    const newRow = createTargetRow(name);
    anchor.after(newRow);
    anchor = newRow;
  }
  scheduleTargetRowValidation(row);
  syncTargetsFromRows();
  if (window.lucide) window.lucide.createIcons();
  if (cleanTargetName(anchor.querySelector("input").value)) {
    commitTargetRow(anchor);
  } else {
    ensureTargetAddRow();
  }
}

function hideTargetRowAutocomplete(row) {
  const ctx = targetRowContext(row);
  if (ctx.acTimer) {
    clearTimeout(ctx.acTimer);
    ctx.acTimer = 0;
  }
  const listEl = row.querySelector(".autocomplete-list");
  const input = row.querySelector("input");
  if (listEl) listEl.hidden = true;
  if (input) input.setAttribute("aria-expanded", "false");
  ctx.activeIndex = -1;
}

async function fetchTargetRowAutocomplete(row, query) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  const listEl = row.querySelector(".autocomplete-list");
  listEl.innerHTML = '<li class="is-loading">Searching…</li>';
  listEl.hidden = false;
  input.setAttribute("aria-expanded", "true");
  const items = await targetTaxonomyLookup(query);
  if (cleanTargetName(input.value) !== query || listEl.hidden) return;
  if (!items || !items.length) {
    ctx.items = [];
    // Hide rather than show "No matches." — the dropdown would cover the
    // did-you-mean hint rendered directly below the input.
    hideTargetRowAutocomplete(row);
    return;
  }
  ctx.items = items;
  ctx.activeIndex = -1;
  listEl.innerHTML = "";
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");
    li.dataset.index = String(index);
    li.innerHTML = '<i data-lucide="bird"></i><span class="ac-name"></span>';
    li.querySelector(".ac-name").textContent = item.sciName
      ? `${item.comName} · ${item.sciName}`
      : item.comName;
    li.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectTargetRowItem(row, index);
    });
    li.addEventListener("mouseenter", () => setTargetRowActive(row, index));
    listEl.appendChild(li);
  });
  if (window.lucide) window.lucide.createIcons();
}

function moveTargetRowSelection(row, delta) {
  const ctx = targetRowContext(row);
  if (!ctx.items.length) return;
  setTargetRowActive(row, (ctx.activeIndex + delta + ctx.items.length) % ctx.items.length);
}

function setTargetRowActive(row, index) {
  const ctx = targetRowContext(row);
  const listEl = row.querySelector(".autocomplete-list");
  ctx.activeIndex = index;
  Array.from(listEl.children).forEach((li, i) => {
    const isActive = i === index;
    li.classList.toggle("is-active", isActive);
    li.setAttribute("aria-selected", String(isActive));
    if (isActive) li.scrollIntoView({ block: "nearest" });
  });
}

function selectTargetRowItem(row, index) {
  const ctx = targetRowContext(row);
  const item = ctx.items[index];
  if (!item) return;
  const input = row.querySelector("input");
  input.value = item.comName;
  ctx.valToken += 1;
  hideTargetRowAutocomplete(row);
  syncTargetsFromRows();
  setTargetRowStatus(row, "valid", null);
}

function targetTaxonomyLookup(name) {
  const key = normalizeName(name);
  if (!key) return Promise.resolve([]);
  if (!targetRowsState.taxonomy.has(key)) {
    const promise = apiJson(
      `/api/ebird/taxonomy/search?q=${encodeURIComponent(name)}`,
      { token: els.apiToken.value.trim(), background: true }
    )
      .then((matches) => {
        if (!Array.isArray(matches)) {
          targetRowsState.taxonomy.delete(key);
          return null;
        }
        return matches;
      })
      .catch(() => {
        targetRowsState.taxonomy.delete(key);
        return null;
      });
    targetRowsState.taxonomy.set(key, promise);
  }
  return targetRowsState.taxonomy.get(key);
}

function scheduleTargetRowValidation(row) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  const name = cleanTargetName(input.value);
  const token = ++ctx.valToken;
  if (!name) {
    setTargetRowStatus(row, "empty", null);
    return;
  }
  setTargetRowStatus(row, "pending", null);
  setTimeout(() => {
    if (ctx.valToken !== token) return;
    validateTargetRow(row, name, token);
  }, 300);
}

async function validateTargetRow(row, name, token) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  const items = await targetTaxonomyLookup(name);
  if (ctx.valToken !== token || cleanTargetName(input.value) !== name) return;
  if (!items) {
    setTargetRowStatus(row, "unchecked", null);
    return;
  }
  const key = normalizeName(name);
  const exact = items.find((item) => normalizeName(item.comName) === key);
  let suggestion = exact ? null : items[0] || null;
  if (!exact && !suggestion) {
    suggestion = await findTargetSuggestion(name);
    if (ctx.valToken !== token || cleanTargetName(input.value) !== name) return;
  }
  setTargetRowStatus(row, exact ? "valid" : "unknown", suggestion);
}

// The server search is prefix/substring-only, so a typo near the end of a name
// ("Scarlet Tanger") returns nothing. Retry with shorter prefixes to find a
// did-you-mean candidate.
async function findTargetSuggestion(name) {
  for (let cut = name.length - 1; cut >= 3 && cut >= name.length - 6; cut -= 1) {
    const items = await targetTaxonomyLookup(name.slice(0, cut));
    if (items && items.length) return items[0];
  }
  return null;
}

function setTargetRowStatus(row, rowState, suggestion) {
  row.dataset.state = rowState;
  const status = row.querySelector(".target-status");
  const hint = row.querySelector(".target-hint");
  if (rowState === "valid") {
    status.innerHTML = '<i data-lucide="check"></i>';
    status.hidden = false;
  } else if (rowState === "unknown") {
    status.innerHTML = '<i data-lucide="triangle-alert"></i>';
    status.hidden = false;
  } else {
    status.innerHTML = "";
    status.hidden = true;
  }
  hint.textContent = "";
  if (rowState === "unknown" && suggestion?.comName) {
    hint.append("Not in the eBird taxonomy. Did you mean ");
    const fixButton = document.createElement("button");
    fixButton.type = "button";
    fixButton.className = "target-suggestion";
    fixButton.textContent = suggestion.comName;
    fixButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applyTargetSuggestion(row, suggestion);
    });
    // Keyboard activation; can't double-fire after mousedown because applying detaches the button.
    fixButton.addEventListener("click", () => applyTargetSuggestion(row, suggestion));
    hint.append(fixButton, "?");
    hint.hidden = false;
  } else if (rowState === "unknown") {
    hint.textContent = "Not found in the eBird taxonomy. It will still be searched as typed.";
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
  if (window.lucide) window.lucide.createIcons();
}

function applyTargetSuggestion(row, item) {
  const ctx = targetRowContext(row);
  const input = row.querySelector("input");
  input.value = item.comName;
  ctx.valToken += 1;
  hideTargetRowAutocomplete(row);
  syncTargetsFromRows();
  setTargetRowStatus(row, "valid", null);
  ensureTargetAddRow();
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

async function fetchRecentForSamples(samples, params, queryRadiusKm = params.radiusKm) {
  const chunks = [];
  for (let i = 0; i < samples.length; i += 4) chunks.push(samples.slice(i, i + 4));

  const all = [];
  for (let i = 0; i < chunks.length; i += 1) {
    setStatus(params.mode === "area" ? "Scanning area" : "Scanning route", `Requesting recent observations ${i * 4 + 1}-${Math.min((i + 1) * 4, samples.length)} of ${samples.length}.`);
    const batch = await Promise.all(chunks[i].map((sample) => {
      const url = `/api/ebird/recent?lat=${sample.lat}&lng=${sample.lng}&dist=${queryRadiusKm}&back=${params.recentDays}&maxResults=${ACTIVITY_MAX_RESULTS}`;
      return apiJson(url, { token: params.token })
        .then((observations) => ({
          sample,
          observations: Array.isArray(observations) ? observations : [],
          truncated: Array.isArray(observations) && observations.length >= ACTIVITY_MAX_RESULTS
        }))
        .catch((error) => ({ sample, observations: [], error }));
    }));
    all.push(...batch);
  }
  const failed = all.filter((entry) => entry.error).length;
  if (failed) {
    addWarning(`${failed} of ${all.length} recent-observation requests failed; ranking uses the data that loaded.`);
  }
  const truncated = all.filter((entry) => entry.truncated).length;
  if (truncated) {
    addWarning(`${truncated} recent-activity ${pluralize("sample", truncated)} reached eBird's ${ACTIVITY_MAX_RESULTS}-result limit; that activity prior was downweighted.`);
  }
  return all;
}

async function fetchHotspotDirectoryForRoute(samples, routeIndex, params) {
  const chunks = [];
  for (let i = 0; i < samples.length; i += 4) chunks.push(samples.slice(i, i + 4));
  const byId = new Map();
  let failed = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    setStatus("Discovering stops", `Checking corridor sections ${i * 4 + 1}-${Math.min((i + 1) * 4, samples.length)} of ${samples.length}.`);
    const batch = await Promise.all(chunks[i].map((sample) => (
      apiJson(
        `/api/ebird/hotspots?lat=${sample.lat}&lng=${sample.lng}&dist=${DISCOVERY_QUERY_RADIUS_KM}`,
        { token: params.token }
      ).catch(() => {
        failed += 1;
        return [];
      })
    )));
    for (const hotspots of batch) {
      for (const hotspot of Array.isArray(hotspots) ? hotspots : []) {
        if (!hotspot.locId || !Number.isFinite(hotspot.lat) || !Number.isFinite(hotspot.lng)) continue;
        byId.set(hotspot.locId, hotspot);
      }
    }
  }

  if (failed) {
    addWarning(`${failed} of ${samples.length} hotspot-directory requests failed; corridor discovery is partial.`);
  }

  return ranking.filterHotspotsByCorridor(byId.values(), routeIndex, params.radiusKm);
}

function applyActivityPrior(hotspots, observationsBySample, params) {
  const byLocation = new Map();
  for (const entry of observationsBySample) {
    const sampleFactor = entry.truncated ? 0.5 : 1;
    for (const obs of entry.observations || []) {
      if (!obs.locId) continue;
      if (!byLocation.has(obs.locId)) {
        byLocation.set(obs.locId, { species: new Map(), targets: new Set(), unseen: new Set() });
      }
      const activity = byLocation.get(obs.locId);
      const speciesName = normalizeName(obs.comName || obs.sciName);
      if (!speciesName) continue;
      const weight = observationFreshnessWeight(obs.obsDt) * sampleFactor;
      activity.species.set(speciesName, Math.max(activity.species.get(speciesName) || 0, weight));
      if (params.targets.includes(speciesName)) activity.targets.add(speciesName);
      if (params.lifeList?.size && !isSeenObservation(obs, params.lifeList)) activity.unseen.add(speciesName);
    }
  }

  const observedPriors = Array.from(byLocation.values())
    .map((activity) => Array.from(activity.species.values()).reduce((sum, weight) => sum + weight, 0))
    .sort((a, b) => a - b);
  const middle = Math.floor(observedPriors.length / 2);
  const neutralActivityPrior = observedPriors.length % 2
    ? observedPriors[middle]
    : (observedPriors[middle - 1] + observedPriors[middle]) / 2 || 0;

  for (const hotspot of Array.isArray(hotspots) ? hotspots : []) {
    const activity = byLocation.get(hotspot.locId);
    hotspot.activityObserved = Boolean(activity);
    hotspot.activityPrior = activity
      ? Array.from(activity.species.values()).reduce((sum, weight) => sum + weight, 0)
      : neutralActivityPrior;
    hotspot.activityTargetCount = activity?.targets.size || 0;
    hotspot.activityUnseenCount = activity?.unseen.size || 0;
  }
}

function rankAreaHotspots(hotspots, center, params) {
  if (!Array.isArray(hotspots)) return [];
  const limit = clamp(params.maxStops * 3, 30, 40);
  const prepared = hotspots
    .filter((hotspot) => hotspot.locId && Number.isFinite(hotspot.lat) && Number.isFinite(hotspot.lng))
    .map((hotspot) => ({
      ...hotspot,
      distanceKm: haversineKm(center, hotspot),
      routeDistanceKm: haversineKm(center, hotspot),
      areaAngle: Math.atan2(hotspot.lat - center.lat, hotspot.lng - center.lng)
    }));
  return shortlistHotspots(prepared, { ...params, shortlistLimit: limit }, "area");
}

function hotspotFetchPriority(hotspot, params) {
  const richness = ranking.richnessPrior(hotspot.numSpeciesAllTime);
  const distance = Number.isFinite(hotspot.routeDistanceKm) ? hotspot.routeDistanceKm : hotspot.distanceKm;
  const proximity = Math.max(0, 1 - distance / Math.max(params.radiusKm, 1));
  const activity = Math.min(Math.max(0, hotspot.activityPrior || 0), 40) / 40;
  const targetRescue = hotspot.activityTargetCount ? 0.3 : 0;
  const unseenRescue = hotspot.activityUnseenCount ? 0.15 : 0;
  return richness * 0.4 + proximity * 0.25 + activity * 0.35 + targetRescue + unseenRescue;
}

function shortlistHotspots(hotspots, params, mode) {
  const limit = Math.min(MAX_EVIDENCE_HOTSPOTS, params.shortlistLimit || MAX_EVIDENCE_HOTSPOTS);
  const ranked = Array.from(hotspots || [])
    .filter((hotspot) => hotspot.locId)
    .map((hotspot) => ({ ...hotspot, fetchPriority: hotspotFetchPriority(hotspot, params) }))
    .sort((a, b) => b.fetchPriority - a.fetchPriority);
  const selected = [];
  const selectedIds = new Set();
  const add = (hotspot) => {
    if (!hotspot || selectedIds.has(hotspot.locId) || selected.length >= limit) return;
    selectedIds.add(hotspot.locId);
    selected.push(hotspot);
  };

  ranked.filter((hotspot) => hotspot.explicitTargetRescue).forEach(add);
  ranked.filter((hotspot) => hotspot.activityTargetCount && !hotspot.explicitTargetRescue).forEach(add);
  ranked.filter((hotspot) => hotspot.activityUnseenCount).slice(0, params.maxStops).forEach(add);
  ranked.filter((hotspot) => hotspot.importedListProbe).slice(0, params.maxStops).forEach(add);

  const bandCount = Math.min(10, Math.max(4, params.maxStops));
  for (let band = 0; band < bandCount; band += 1) {
    const inBand = ranked.find((hotspot) => {
      if (selectedIds.has(hotspot.locId)) return false;
      const normalized = mode === "area"
        ? (hotspot.areaAngle + Math.PI) / (2 * Math.PI)
        : hotspot.routeProgress;
      return normalized >= band / bandCount && normalized <= (band + 1) / bandCount;
    });
    if (inBand) inBand.geographicRepresentative = true;
    add(inBand);
  }

  ranked.forEach(add);
  return selected;
}

function mergeUniqueHotspots(...groups) {
  const byId = new Map();
  for (const group of groups) {
    for (const hotspot of Array.isArray(group) ? group : []) {
      if (hotspot?.locId && !byId.has(hotspot.locId)) byId.set(hotspot.locId, hotspot);
    }
  }
  return Array.from(byId.values());
}

async function rescueTargetHotspots(hotspots, ranked, center, params) {
  if (!params.targets.length || !Array.isArray(hotspots)) return [];
  const rankedIds = new Set(ranked.map((hotspot) => hotspot.locId));
  const droppedByLocId = new Map();
  for (const hotspot of hotspots) {
    if (!hotspot.locId || !Number.isFinite(hotspot.lat) || !Number.isFinite(hotspot.lng)) continue;
    if (rankedIds.has(hotspot.locId) || droppedByLocId.has(hotspot.locId)) continue;
    droppedByLocId.set(hotspot.locId, hotspot);
  }
  if (!droppedByLocId.size) return [];

  const rescued = new Map();
  const feedMaxResults = 10000;
  let failed = 0;
  for (const target of params.targets) {
    setStatus("Scanning area", `Checking locations reporting target species: ${target}.`);
    try {
      const payload = await apiJson(
        `/api/ebird/species?lat=${center.lat}&lng=${center.lng}&dist=${params.radiusKm}&back=${params.recentDays}&maxResults=${feedMaxResults}&name=${encodeURIComponent(target)}`,
        { token: params.token }
      );
      const observations = Array.isArray(payload.observations) ? payload.observations : [];
      if (observations.length >= feedMaxResults) {
        addWarning(`"${target}" has more reports than eBird returns in one request; some of its locations may be missing from the ranking.`);
      }
      for (const obs of observations) {
        const hotspot = obs.locId ? droppedByLocId.get(obs.locId) : null;
        if (hotspot) rescued.set(hotspot.locId, hotspot);
      }
    } catch (error) {
      if (error.status !== 404) failed += 1;
    }
  }
  if (failed) {
    addWarning(`${failed} target-species lookups failed; some target locations may be missing from the ranking.`);
  }
  const limit = 40;
  if (rescued.size > limit) {
    addWarning(`Target species were reported at ${rescued.size} additional hotspots; only the ${limit} closest were checked.`);
  }
  return Array.from(rescued.values())
    .sort((a, b) => haversineKm(center, a) - haversineKm(center, b))
    .slice(0, limit);
}

async function rescueRouteTargetHotspots(hotspots, ranked, samples, params) {
  if (!params.targets.length || !Array.isArray(hotspots) || !samples.length) return [];
  const rankedIds = new Set(ranked.map((hotspot) => hotspot.locId));
  const droppedByLocId = new Map();
  for (const hotspot of hotspots) {
    if (!hotspot.locId || rankedIds.has(hotspot.locId)) continue;
    droppedByLocId.set(hotspot.locId, hotspot);
  }
  if (!droppedByLocId.size) return [];

  const uniqueTargets = Array.from(new Set(params.targets));
  const targets = uniqueTargets.slice(0, MAX_ROUTE_TARGETS);
  if (uniqueTargets.length > targets.length) {
    addWarning(`Route target rescue is limited to ${MAX_ROUTE_TARGETS} species; ${uniqueTargets.length - targets.length} additional targets use the general activity prior only.`);
  }
  const samplesPerTarget = Math.max(1, Math.floor(MAX_ROUTE_TARGET_LOOKUPS / targets.length));
  const targetSamples = evenlySpacedItems(samples, samplesPerTarget);
  const jobs = targets.flatMap((target) => targetSamples.map((sample) => ({ target, sample })));
  const fullJobCount = targets.length * samples.length;
  if (jobs.length < fullJobCount) {
    addWarning(`Target rescue checked ${jobs.length} of ${fullJobCount} target corridor sections because of the ${MAX_ROUTE_TARGET_LOOKUPS}-request ceiling.`);
  }

  const rescued = new Map();
  let failed = 0;
  for (let index = 0; index < jobs.length; index += 2) {
    const batch = jobs.slice(index, index + 2);
    setStatus("Checking route targets", `Checking target reports ${index + 1}-${index + batch.length} of ${jobs.length}.`);
    const results = await Promise.all(batch.map(async ({ target, sample }) => {
      try {
        return await apiJson(
          `/api/ebird/species?lat=${sample.lat}&lng=${sample.lng}&dist=${ACTIVITY_QUERY_RADIUS_KM}&back=${params.recentDays}&maxResults=10000&name=${encodeURIComponent(target)}`,
          { token: params.token }
        );
      } catch (error) {
        if (error.status !== 404) failed += 1;
        return null;
      }
    }));
    for (const payload of results) {
      const observations = Array.isArray(payload?.observations) ? payload.observations : [];
      if (observations.length >= 10000) {
        addWarning("A route target lookup reached eBird's 10,000-result limit; some target locations may be missing.");
      }
      for (const obs of observations) {
        const hotspot = obs.locId ? droppedByLocId.get(obs.locId) : null;
        if (hotspot) rescued.set(hotspot.locId, hotspot);
      }
    }
  }
  if (failed) {
    addWarning(`${failed} route target lookups failed; some target locations may be missing from the shortlist.`);
  }
  if (rescued.size > MAX_EVIDENCE_HOTSPOTS) {
    addWarning(`Targets were reported at ${rescued.size} additional route hotspots; only ${MAX_EVIDENCE_HOTSPOTS} can receive detailed evidence.`);
  }
  return Array.from(rescued.values())
    .sort((a, b) => a.routeProgress - b.routeProgress)
    .slice(0, MAX_EVIDENCE_HOTSPOTS);
}

function evenlySpacedItems(items, limit) {
  if (limit <= 0) return [];
  if (items.length <= limit) return Array.from(items);
  if (limit <= 1) return [items[Math.floor((items.length - 1) / 2)]];
  return Array.from({ length: limit }, (_, index) => (
    items[Math.round(index * (items.length - 1) / (limit - 1))]
  ));
}

function reserveRouteUnseenEvidence(hotspots, alreadySelected, params) {
  if (!params.lifeList?.size || hotspots.length <= alreadySelected.length) return [];
  const selectedIds = new Set(alreadySelected.map((hotspot) => hotspot.locId));
  const dropped = hotspots
    .filter((hotspot) => hotspot.locId && !selectedIds.has(hotspot.locId))
    .sort((a, b) => hotspotFetchPriority(b, params) - hotspotFetchPriority(a, params));
  const limit = Math.min(MAX_ROUTE_UNSEEN_PROBES, params.maxStops, dropped.length);
  if (!limit) return [];

  const probes = [];
  const probeIds = new Set();
  const add = (hotspot) => {
    if (!hotspot || probeIds.has(hotspot.locId) || probes.length >= limit) return;
    probeIds.add(hotspot.locId);
    probes.push(hotspot);
  };
  for (let band = 0; band < limit; band += 1) {
    add(dropped.find((hotspot) => (
      hotspot.routeProgress >= band / limit
      && hotspot.routeProgress <= (band + 1) / limit
    )));
  }
  dropped.forEach(add);
  addWarning(`Imported-list matching reserved ${probes.length} additional route hotspots for per-location evidence. Other corridor hotspots may also report species not on your list.`);
  return probes;
}

async function rescueLiferHotspots(hotspots, alreadyChosen, center, params) {
  if (!params.lifeList?.size || !Array.isArray(hotspots)) return [];
  const chosenIds = new Set(alreadyChosen.map((hotspot) => hotspot.locId));
  const droppedByLocId = new Map();
  for (const hotspot of hotspots) {
    if (!hotspot.locId || !Number.isFinite(hotspot.lat) || !Number.isFinite(hotspot.lng)) continue;
    if (chosenIds.has(hotspot.locId) || droppedByLocId.has(hotspot.locId)) continue;
    droppedByLocId.set(hotspot.locId, hotspot);
  }
  if (!droppedByLocId.size) return [];

  setStatus("Scanning area", "Checking for unseen species at additional hotspots.");
  const feedMaxResults = 10000;
  let feed;
  try {
    feed = await apiJson(
      `/api/ebird/recent?lat=${center.lat}&lng=${center.lng}&dist=${params.radiusKm}&back=${params.recentDays}&maxResults=${feedMaxResults}`,
      { token: params.token }
    );
  } catch {
    addWarning("Could not check the remaining hotspots for unseen species; imported-list coverage may be incomplete.");
    return [];
  }
  if (Array.isArray(feed) && feed.length >= feedMaxResults) {
    addWarning("The area has more recently reported species than eBird returns in one request; imported-list coverage may be incomplete.");
  }

  const rescued = new Map();
  for (const obs of Array.isArray(feed) ? feed : []) {
    const hotspot = obs.locId ? droppedByLocId.get(obs.locId) : null;
    if (!hotspot || rescued.has(obs.locId)) continue;
    if (!isSeenObservation(obs, params.lifeList)) rescued.set(obs.locId, hotspot);
  }
  const limit = 20;
  if (rescued.size > limit) {
    addWarning(`Unseen species were reported at ${rescued.size} additional hotspots; only the ${limit} closest were checked.`);
  }
  return Array.from(rescued.values())
    .sort((a, b) => haversineKm(center, a) - haversineKm(center, b))
    .slice(0, limit);
}

async function fetchRecentForHotspots(hotspots, params) {
  const chunks = [];
  for (let i = 0; i < hotspots.length; i += 4) chunks.push(hotspots.slice(i, i + 4));

  const evidence = [];
  let failed = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    setStatus("Checking current reports", `Checking hotspots ${i * 4 + 1}-${Math.min((i + 1) * 4, hotspots.length)} of ${hotspots.length}.`);
    const batch = await Promise.all(chunks[i].map((hotspot) => {
      const url = `/api/ebird/hotspot-recent?locId=${encodeURIComponent(hotspot.locId)}&back=${params.recentDays}`;
      return apiJson(url, { token: params.token })
        .then((results) => ({
          hotspot,
          observations: (Array.isArray(results) ? results : []).map((obs) => ({
            ...obs,
            locId: obs.locId || hotspot.locId,
            locName: obs.locName || hotspot.locName,
            lat: Number.isFinite(obs.lat) ? obs.lat : hotspot.lat,
            lng: Number.isFinite(obs.lng) ? obs.lng : hotspot.lng
          })),
          status: "complete"
        }))
        .catch((error) => {
          failed += 1;
          return { hotspot, observations: [], status: "failed", error };
        });
    }));
    evidence.push(...batch);
  }
  if (failed) {
    addWarning(`${failed} of ${hotspots.length} hotspot lookups failed; affected locations are ranked with lower confidence.`);
  }
  return evidence;
}

function buildCandidatesFromHotspots(evidence, params, routeIndex, areaCenter = null) {
  return evidence.map((entry) => {
    const hotspot = entry.hotspot;
    const observations = entry.observations.filter(isObjectRecord);
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
    const routeMatch = routeIndex
      ? Number.isFinite(hotspot.routeDistanceKm) && Number.isFinite(hotspot.routeProgress)
        ? { distanceKm: hotspot.routeDistanceKm, progress: hotspot.routeProgress }
        : routeIndex.distanceTo(hotspot)
      : { distanceKm: haversineKm(areaCenter, hotspot), progress: 0 };
    const targetMatches = params.targets.map((target) => species.get(target)).filter(Boolean);
    const liferSpecies = params.lifeList?.size
      ? Array.from(species.values()).filter((obs) => !isSeenObservation(obs, params.lifeList))
      : [];
    const candidate = {
      id: hotspot.locId,
      locId: hotspot.locId,
      name: hotspot.locName || "Unnamed birding location",
      lat: hotspot.lat,
      lng: hotspot.lng,
      observations,
      seen,
      species,
      notable: [],
      routeDistanceKm: routeMatch.distanceKm,
      routeProgress: routeMatch.progress,
      targetMatches,
      liferSpecies,
      allTimeSpeciesCount: Number(hotspot.numSpeciesAllTime) || 0,
      latestObservationDate: hotspot.latestObsDt || "",
      activityPrior: hotspot.activityPrior || 0,
      activityObserved: Boolean(hotspot.activityObserved),
      explicitTargetRescue: Boolean(hotspot.explicitTargetRescue),
      geographicRepresentative: Boolean(hotspot.geographicRepresentative),
      discoverySources: ["ebird-hotspot"],
      evidence: {
        recent: {
          status: entry.status,
          windowDays: params.recentDays,
          fetchedAt: new Date().toISOString(),
          observations
        },
        seasonal: { status: "unavailable" },
        notableNearby: { status: "pending", observations: [] }
      }
    };
    candidate.preliminaryScore = preliminaryScore(candidate, params);
    return candidate;
  }).sort((a, b) => b.preliminaryScore - a.preliminaryScore);
}

function preliminaryScore(candidate, params) {
  const weightedSpecies = weightedUniqueSpecies(candidate.observations);
  const current = Math.min(weightedSpecies, 90) / 90;
  const stable = ranking.richnessPrior(candidate.allTimeSpeciesCount);
  const proximity = Math.max(0, 1 - candidate.routeDistanceKm / Math.max(params.radiusKm, 1));
  const personal = Math.min(1, candidate.targetMatches.length / 3 + candidate.liferSpecies.length / 10);
  return current * 0.45 + stable * 0.25 + proximity * 0.15 + personal * 0.15;
}

async function evaluateDetours(candidates, origin, destination, baseDurationSeconds, params) {
  const practical = [];
  const ordered = orderRoutingCandidates(candidates, params);
  const initialCount = Math.min(ordered.length, Math.max(params.maxStops, 15), MAX_INITIAL_DETOURS);
  let attempted = 0;
  let failed = 0;

  const evaluateRange = async (start, end) => {
    for (let index = start; index < end; index += 3) {
      const batch = ordered.slice(index, Math.min(index + 3, end));
      setStatus("Checking detours", `Evaluating route impact ${index + 1}-${index + batch.length} of up to ${Math.min(ordered.length, MAX_TOTAL_DETOURS)}.`);
      const results = await Promise.all(batch.map(async (candidate) => {
        try {
          const viaRoute = await apiJson(routeUrl("/api/route-via", origin, destination, candidate, params.mapProvider));
          candidate.viaRoute = viaRoute;
          const impact = ranking.detourImpact(viaRoute, {
            durationSeconds: baseDurationSeconds,
            distanceMeters: state.route.distanceMeters
          });
          candidate.addedMinutes = impact.addedMinutes;
          candidate.addedMiles = impact.addedMiles;
          return candidate;
        } catch (error) {
          candidate.routeError = error.message;
          failed += 1;
          return null;
        }
      }));
      attempted += batch.length;
      practical.push(...results.filter((candidate) => candidate && candidate.addedMinutes <= params.maxDetour));
    }
  };

  await evaluateRange(0, initialCount);
  if (practical.length < params.maxStops && attempted < Math.min(ordered.length, MAX_TOTAL_DETOURS)) {
    const refillEnd = Math.min(ordered.length, MAX_TOTAL_DETOURS);
    setStatus("Checking more detours", `The first round found ${practical.length} stops within budget; checking additional candidates.`);
    await evaluateRange(attempted, refillEnd);
  }
  if (failed) {
    addWarning(`${failed} of ${attempted} detour estimates failed and those stops were skipped.`);
  }
  return practical;
}

function orderRoutingCandidates(candidates, params) {
  const sorted = Array.from(candidates).sort((a, b) => b.preliminaryScore - a.preliminaryScore);
  const targetCount = Math.min(sorted.length, Math.max(params.maxStops, 15), MAX_INITIAL_DETOURS);
  const mainLimit = Math.ceil(targetCount * 0.6);
  const quietLimit = Math.ceil(targetCount * 0.2);
  const rescueLimit = Math.max(0, targetCount - mainLimit - quietLimit);
  const ordered = [];
  const ids = new Set();
  const addMany = (items, limit) => {
    if (limit <= 0) return;
    let added = 0;
    for (const candidate of items) {
      if (ids.has(candidate.id)) continue;
      ids.add(candidate.id);
      ordered.push(candidate);
      added += 1;
      if (added >= limit) break;
    }
  };
  addMany(sorted, mainLimit);
  addMany(
    sorted.filter((candidate) => !candidate.species.size)
      .sort((a, b) => b.allTimeSpeciesCount - a.allTimeSpeciesCount),
    quietLimit
  );
  const geographicLimit = Math.ceil(rescueLimit / 2);
  const geographicCandidates = sorted.filter((candidate) => (
    candidate.geographicRepresentative && !ids.has(candidate.id)
  ));
  addMany(evenlySpacedItems(
    geographicCandidates.sort((a, b) => a.routeProgress - b.routeProgress),
    geographicLimit
  ), geographicLimit);
  addMany(
    sorted.filter((candidate) => (
      candidate.explicitTargetRescue
      || candidate.targetMatches.length
      || candidate.liferSpecies.length
    )),
    rescueLimit - geographicLimit
  );
  addMany(sorted, sorted.length);
  return ordered;
}

async function addNotableObservations(candidates, params) {
  if (params.mode === "area" && state.areaCenter) {
    await addAreaNotableObservations(candidates, params);
    return;
  }
  await fetchNotablesPerCandidate(selectNotableCandidates(candidates, params), params);
}

function selectNotableCandidates(candidates, params) {
  const top = candidates.slice(0, Math.max(params.maxStops, 6));
  const topIds = new Set(top.map((candidate) => candidate.id));
  for (const candidate of candidates) {
    if (candidate.preserved && !topIds.has(candidate.id)) top.push(candidate);
  }
  return top;
}

async function fetchNotablesPerCandidate(list, params) {
  let failed = 0;
  for (let i = 0; i < list.length; i += 1) {
    const candidate = list[i];
    setStatus("Adding notable birds", `Checking notable reports ${i + 1} of ${list.length}.`);
    try {
      candidate.notable = await apiJson(
        `/api/ebird/notable?lat=${candidate.lat}&lng=${candidate.lng}&dist=${Math.min(params.radiusKm, 10)}&back=${params.recentDays}&maxResults=100`,
        { token: params.token }
      );
      if (candidate.evidence) {
        candidate.evidence.notableNearby = {
          status: "complete",
          radiusKm: Math.min(params.radiusKm, 10),
          observations: candidate.notable
        };
      }
    } catch {
      candidate.notable = [];
      if (candidate.evidence) candidate.evidence.notableNearby = { status: "failed", observations: [] };
      failed += 1;
    }
  }
  if (failed) {
    addWarning(`${failed} of ${list.length} notable-report lookups failed; notable counts may be understated.`);
  }
}

async function addAreaNotableObservations(candidates, params) {
  const center = state.areaCenter;
  setStatus("Adding notable birds", "Checking recent notable reports across the area.");
  const feedDistKm = Math.min(params.radiusKm + 10, 50);
  const feedMaxResults = 10000;
  let feed = [];
  try {
    feed = await apiJson(
      `/api/ebird/notable?lat=${center.lat}&lng=${center.lng}&dist=${feedDistKm}&back=${params.recentDays}&maxResults=${feedMaxResults}`,
      { token: params.token }
    );
  } catch {
    await fetchNotablesPerCandidate(selectNotableCandidates(candidates, params), params);
    return;
  }
  if (Array.isArray(feed) && feed.length >= feedMaxResults) {
    addWarning("The area has more notable reports than eBird returns in one request; notable counts may be understated.");
  }
  const valid = (Array.isArray(feed) ? feed : []).filter((obs) => Number.isFinite(obs.lat) && Number.isFinite(obs.lng));
  const notableRadiusKm = Math.min(params.radiusKm, 10);
  const uncovered = [];
  for (const candidate of candidates) {
    if (haversineKm(center, candidate) + notableRadiusKm > feedDistKm) {
      uncovered.push(candidate);
    } else {
      candidate.notable = valid.filter((obs) => haversineKm(candidate, obs) <= notableRadiusKm);
      if (candidate.evidence) {
        candidate.evidence.notableNearby = {
          status: "complete",
          radiusKm: notableRadiusKm,
          observations: candidate.notable
        };
      }
    }
  }
  await fetchNotablesPerCandidate(uncovered, params);
}

function scoreCandidates(candidates, params) {
  const targetsEnabled = Boolean(params.targets.length);
  const unseenEnabled = Boolean(params.lifeList?.size);
  for (const candidate of candidates) {
    const weightedSpecies = weightedUniqueSpecies(candidate.observations);
    const weightedActivity = weightedObservationTotal(candidate.observations);
    const weightedTargets = weightedTargetTotal(candidate.observations, params.targets);
    const weightedUnseen = weightedUnseenTotal(candidate.observations, params.lifeList);
    const result = ranking.calculateCandidateScore({
      mode: params.mode,
      weightedSpecies,
      weightedActivity,
      allTimeSpeciesCount: candidate.allTimeSpeciesCount,
      weightedTargets,
      weightedUnseen,
      targetsEnabled,
      unseenEnabled,
      routeDistanceKm: candidate.routeDistanceKm,
      radiusKm: params.radiusKm,
      addedMinutes: candidate.addedMinutes,
      maxDetour: params.maxDetour
    });
    candidate.scoredWithLifeList = Boolean(params.lifeList?.size);
    candidate.scoringVersion = SCORING_VERSION;
    candidate.enabledScoreParts = result.enabledScoreParts;
    candidate.scoreParts = result.scoreParts;
    candidate.score = result.score;
  }
}

function weightedUniqueSpecies(observations) {
  const bySpecies = new Map();
  for (const obs of observations) {
    const species = normalizeName(obs.comName || obs.sciName);
    if (!species) continue;
    const weight = observationFreshnessWeight(obs.obsDt);
    bySpecies.set(species, Math.max(bySpecies.get(species) || 0, weight));
  }
  return Array.from(bySpecies.values()).reduce((sum, weight) => sum + weight, 0);
}

function weightedObservationTotal(observations) {
  return observations.reduce((sum, obs) => sum + observationFreshnessWeight(obs.obsDt), 0);
}

function weightedTargetTotal(observations, targets) {
  if (!targets.length) return 0;
  const targetSet = new Set(targets);
  const byTarget = new Map();
  for (const obs of observations) {
    const species = normalizeName(obs.comName || obs.sciName);
    if (!targetSet.has(species)) continue;
    const weight = observationFreshnessWeight(obs.obsDt);
    byTarget.set(species, Math.max(byTarget.get(species) || 0, weight));
  }
  return Array.from(byTarget.values()).reduce((sum, weight) => sum + weight, 0);
}

function weightedUnseenTotal(observations, lifeList) {
  if (!lifeList?.size) return 0;
  const bySpecies = new Map();
  for (const obs of observations) {
    if (isSeenObservation(obs, lifeList)) continue;
    const species = normalizeName(obs.comName || obs.sciName);
    if (!species) continue;
    const weight = observationFreshnessWeight(obs.obsDt);
    bySpecies.set(species, Math.max(bySpecies.get(species) || 0, weight));
  }
  return Array.from(bySpecies.values()).reduce((sum, weight) => sum + weight, 0);
}

function observationFreshnessWeight(obsDt) {
  return ranking.observationFreshnessWeight(obsDt, { halfLifeDays: 7 });
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
  const liferText = state.lifeList.species.size ? `, ${stats.liferCount} unseen recent species` : "";
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
  renderNavigationExport(stops);
  if (window.lucide) window.lucide.createIcons();
}

function navigationRoutePoints(stops = pinnedStops()) {
  const points = [];
  if (state.origin) {
    points.push({
      ...state.origin,
      name: state.origin.name || state.params?.origin || "Start",
      type: "Start"
    });
  }
  stops.forEach((stop, index) => {
    points.push({ ...stop, name: `Stop ${index + 1}: ${stop.name}`, type: "Birding stop" });
  });
  if (state.destination) {
    points.push({
      ...state.destination,
      name: state.destination.name || state.params?.destination || "Destination",
      type: "Destination"
    });
  }
  return points;
}

function navigationTrackCoordinates(stops = pinnedStops()) {
  if (state.itinerary?.status === "ready") {
    return state.itinerary.route?.geometry?.coordinates || [];
  }
  if (stops.length === 1) {
    return stops[0].viaRoute?.geometry?.coordinates || [];
  }
  if (!stops.length) return state.route?.geometry?.coordinates || [];
  return [];
}

function renderNavigationExport(stops = pinnedStops()) {
  const routeMode = (state.params?.mode || state.mode) === "route";
  const points = navigationRoutePoints(stops);
  const canExport = routeMode && Boolean(state.route) && points.length >= 2;
  els.navigationExport.hidden = !routeMode;
  els.downloadGpxButton.disabled = !canExport;

  const googleMapsUrl = canExport ? navigationExport.buildGoogleMapsUrl(points) : "";
  if (googleMapsUrl) {
    els.googleMapsRouteLink.href = googleMapsUrl;
    els.googleMapsRouteLink.removeAttribute("aria-disabled");
    els.googleMapsRouteLink.removeAttribute("tabindex");
    els.googleMapsRouteLink.title = "Open this route in Google Maps";
  } else {
    els.googleMapsRouteLink.removeAttribute("href");
    els.googleMapsRouteLink.setAttribute("aria-disabled", "true");
    els.googleMapsRouteLink.tabIndex = -1;
    els.googleMapsRouteLink.title = canExport && stops.length > 3
      ? "Google Maps mobile links support at most 3 waypoints; use GPX to export every stop"
      : "Run a route search to open directions";
  }

  els.navigationExportSummary.textContent = stops.length > 3
    ? `GPX includes all ${stops.length} pinned stops. Google Maps is limited to 3 waypoints on mobile.`
    : stops.length
    ? `${stops.length} pinned ${pluralize("stop", stops.length)} will be exported in this order.`
    : canExport
      ? "Exports the direct route. Pin birding stops to add waypoints."
      : "Run a route search to create navigation files."
}

function downloadGpxRoute() {
  const stops = pinnedStops();
  const points = navigationRoutePoints(stops);
  if (!state.route || points.length < 2) {
    setStatus("Nothing to export", "Run a route search before downloading a navigation file.");
    return;
  }

  const name = state.routeName || `${state.params?.origin || "Start"} to ${state.params?.destination || "Destination"}`;
  const gpx = navigationExport.buildGpxDocument({
    name,
    points,
    trackPoints: navigationTrackCoordinates(stops)
  });
  downloadBlob(gpx, "application/gpx+xml;charset=utf-8", navigationFileName(name));
  setStatus("GPX downloaded", `${stops.length ? `${stops.length} pinned ${pluralize("stop", stops.length)} and ` : ""}the route endpoints are ready to import into a navigation app.`);
}

function navigationFileName(name) {
  const base = slugify(name) || "route";
  const date = new Date().toISOString().slice(0, 10);
  return `birdtrip-${base}-navigation-${date}.gpx`;
}

function downloadBlob(contents, type, fileName) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    els.orderToggle.hidden = true;
    els.resultsList.className = "results-list empty";
    els.resultsList.innerHTML = '<div class="empty-state"><i data-lucide="search-x"></i><p>No stops matched the current constraints.</p></div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const scale = scoreScale(state.results);
  const orderableByArrival = !isArea && state.results.some((candidate) => Number.isFinite(candidate.routeProgress));
  els.orderToggle.hidden = !orderableByArrival;
  const byArrival = orderableByArrival && state.resultOrder === "arrival";
  const displayResults = displayOrderedResults();
  displayResults.forEach((candidate, index) => {
    const node = els.resultTemplate.content.cloneNode(true);
    const card = node.querySelector(".stop-card");
    card.dataset.id = candidate.id;
    if (candidate.id === state.selectedId) card.classList.add("is-selected");
    if (isPinned(candidate.id)) card.classList.add("is-pinned");
    const rank = node.querySelector(".rank");
    rank.textContent = String(index + 1);
    rank.title = byArrival
      ? `Stop ${index + 1} of ${state.results.length} in drive order`
      : `Rank ${index + 1} of ${state.results.length} by score`;
    node.querySelector(".stop-name").textContent = candidate.name;
    node.querySelector(".stop-preview").textContent = speciesPreview(candidate);
    node.querySelector(".stop-chips").innerHTML = candidateChips(candidate, index);
    const scorePill = node.querySelector(".score-pill");
    scorePill.querySelector("b").textContent = candidate.score;
    scorePill.querySelector("small").textContent = candidate.scoringVersion === SCORING_VERSION ? "score" : "legacy";
    scorePill.title = scoreTooltip(candidate, isArea, scale);
    node.querySelector(".stop-reason p").textContent = candidateReasonText(candidate, isArea);
    const detourWrap = node.querySelector(".metric-detour-wrap");
    const offrouteWrap = node.querySelector(".metric-offroute-wrap");
    const speciesWrap = node.querySelector(".metric-species-wrap");
    const notableWrap = node.querySelector(".metric-notable-wrap");
    const targetsWrap = node.querySelector(".metric-targets-wrap");
    const recentDays = state.params?.recentDays || 14;
    if (isArea) {
      const centerDistanceMiles = formatMiles(kmToMiles(candidate.routeDistanceKm));
      node.querySelector(".metric-detour").textContent = `${centerDistanceMiles} mi`;
      node.querySelector(".metric-offroute").textContent = `${state.params.radiusKm} km`;
      setMetricTooltip(
        detourWrap,
        `Distance from center: ${centerDistanceMiles} mi in a straight line from the search center to this stop.`
      );
      setMetricTooltip(
        offrouteWrap,
        `Search radius: stops were searched for within ${state.params.radiusKm} km of the center.`
      );
    } else {
      node.querySelector(".metric-detour").textContent = `+${Math.round(candidate.addedMinutes)}m`;
      node.querySelector(".metric-offroute").textContent = `${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi`;
      setMetricTooltip(
        detourWrap,
        `Added drive time: about ${Math.round(candidate.addedMinutes)} extra minutes for a route via this stop instead of the direct route.`
      );
      setMetricTooltip(
        offrouteWrap,
        `Distance off route: about ${formatMiles(kmToMiles(candidate.routeDistanceKm))} miles from the nearest point on the complete route geometry.`
      );
    }
    node.querySelector(".metric-species").textContent = candidate.species.size;
    node.querySelector(".metric-notable").textContent = uniqueNotableCount(candidate);
    node.querySelector(".metric-targets").textContent = candidate.targetMatches.length;
    setMetricTooltip(
      speciesWrap,
      `Species reported recently: ${candidate.species.size} distinct ${pluralize("species", candidate.species.size)} reported at this stop in the last ${recentDays} ${pluralize("day", recentDays)}. This is recent evidence, not an encounter prediction.`
    );
    setMetricTooltip(
      notableWrap,
      `Nearby notable species: ${uniqueNotableCount(candidate)} distinct ${pluralize("species", uniqueNotableCount(candidate))} from eBird's notable reports within ${Math.min(state.params.radiusKm, 10)} km in the last ${recentDays} ${pluralize("day", recentDays)}.`
    );
    setMetricTooltip(
      targetsWrap,
      `Target matches: ${candidate.targetMatches.length} ${pluralize("species", candidate.targetMatches.length)} from your target list reported at this stop in the last ${recentDays} ${pluralize("day", recentDays)}.`
    );
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
    mainButton.setAttribute("aria-label", `View ${candidate.name}, ${byArrival ? "stop" : "rank"} ${index + 1} of ${state.results.length}, score ${candidate.score} of ${scale.max}`);
    mainButton.addEventListener("click", () => selectCandidate(candidate.id));
    setupCandidateSpeciesPreviews(card);
    els.resultsList.appendChild(node);
  });

  renderComparison();
  if (window.lucide) window.lucide.createIcons();
}

function setMetricTooltip(element, text) {
  element.dataset.tooltip = text;
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", text);
  element.tabIndex = 0;
}

// Single source of truth for result ordering so card ordinals and map marker
// numbers always agree, whichever order toggle is active.
function displayOrderedResults() {
  const byArrival = state.params?.mode !== "area"
    && state.resultOrder === "arrival"
    && state.results.some((candidate) => Number.isFinite(candidate.routeProgress));
  if (!byArrival) return state.results;
  return [...state.results].sort((a, b) => (Number.isFinite(a.routeProgress) ? a.routeProgress : 1) - (Number.isFinite(b.routeProgress) ? b.routeProgress : 1));
}

function renderMarkers() {
  if (!state.mapAdapter) return;
  state.mapAdapter.setMarkers(displayOrderedResults(), state.selectedId, selectCandidate);
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
  const notable = prioritizedNotableReports(candidate, 20);
  const lifers = candidate.liferSpecies.slice(0, 30);
  const unseenNearbyNotables = unseenNotableSpecies(candidate);
  const nearbyRadiusKm = notableSearchRadiusKm();
  const links = candidateLinks(candidate);
  const offRouteMi = formatMiles(kmToMiles(candidate.routeDistanceKm));
  const pinned = isPinned(candidate.id);
  const pinDisabled = isArea || (!pinned && state.pinnedIds.length >= 5);
  const evidenceNote = candidate.evidence?.recent?.status === "failed"
    ? "Recent reports could not be loaded for this hotspot; its score has lower confidence."
    : candidate.species.size
      ? `These are reports from the selected ${state.params?.recentDays || 14}-day window, not encounter predictions.`
      : `No species reports were returned for this hotspot in the selected ${state.params?.recentDays || 14}-day window.`;
  const stopTiming = candidateTiming(candidate);

  els.detailsContent.innerHTML = `
    <h3>${escapeHtml(candidate.name)}</h3>
    <p class="detail-subtitle">${candidate.score} score; ${isArea ? `${offRouteMi} mi from ${escapeHtml(state.routeName)}.` : `+${Math.round(candidate.addedMinutes)} min and +${candidate.addedMiles.toFixed(1)} mi detour.`}</p>
    <section class="reason-line">
      <h4>Why This Stop?</h4>
      <p>${escapeHtml(candidateReasonText(candidate, isArea))}</p>
      <p><small>${escapeHtml(evidenceNote)}</small></p>
    </section>
    ${stopTiming ? `
      <section class="reason-line timing-line timing-${stopTiming.assessment.quality}">
        <h4>Arrival Timing</h4>
        <p>${escapeHtml(timingSentence(stopTiming))}</p>
        <p><small>Estimated from your departure time plus driving along the route; time spent birding at earlier stops is not included.</small></p>
      </section>
    ` : ""}
    <div class="detail-grid">
      <div><b>${candidate.species.size}</b><small>recent species</small></div>
      <div><b>${candidate.observations.length}</b><small>records</small></div>
      <div><b>${uniqueNotableCount(candidate)}</b><small>notable species</small></div>
      <div><b>${candidate.targetMatches.length}</b><small>target matches</small></div>
      <div><b>${candidate.liferSpecies.length}</b><small>unseen recent species</small></div>
      ${state.lifeList.species.size ? `<div><b>${unseenNearbyNotables.length}</b><small>unseen nearby</small></div>` : ""}
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
        ${scoreComponents(candidate, isArea).map((part) => scoreRow(part.label, part.value, part.max)).join("")}
      </div>
    </section>
    ${lifers.length ? `
      <section class="species-list">
        <h4>Unseen Species Reported Recently</h4>
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
        <h4>Nearby Notable Reports</h4>
        <p class="species-list-note">Reported within ${nearbyRadiusKm} km of this stop; reports may be from other nearby locations.</p>
        <ul>${notable.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")} <small>${escapeHtml(obs.obsDt || "")}</small>${notableUnseenBadge(obs)}</li>`).join("")}</ul>
      </section>
    ` : ""}
    ${species.length ? `
      <section class="species-list">
        <h4>Species Reported Recently <small>(${candidate.species.size} grouped by common name)</small></h4>
        <ul>${species.map((sp) => `<li>${escapeHtml(sp.name)} <small>×${sp.count}${sp.latest ? ` · ${escapeHtml(sp.latest)}` : ""}</small></li>`).join("")}</ul>
      </section>
    ` : `
      <section class="species-list">
        <h4>No Recent Species List</h4>
        <p>${escapeHtml(evidenceNote)}</p>
      </section>
    `}
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
      ${comparisonRow("Nearby Notables", compared.map(compareNotablesCell))}
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
  const prioritizedNotables = prioritizedNotableReports(candidate, candidate.notable.length);
  const notableNames = uniqueObservationNames(prioritizedNotables).slice(0, 4);
  const unseenCount = unseenNotableSpecies(candidate).length;
  return `
    <b>${uniqueNotableCount(candidate)} nearby notable</b>
    ${state.lifeList.species.size ? `<small>${unseenCount} unseen in your life list</small>` : ""}
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
  const isArea = state.params?.mode === "area";
  return `
    <b>${candidate.score} total</b>
    <div class="comparison-score">
      ${scoreComponents(candidate, isArea).map((part) => compactScorePart(part.label, part.value, part.max)).join("")}
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

const LEGACY_SCORE_COMPONENTS = [
  { key: "species", label: "Species", max: 45 },
  { key: "activity", label: "Activity", max: 15 },
  { key: "notable", label: "Notable", max: 20 },
  { key: "targets", label: "Targets", max: 15 },
  { key: "lifers", label: "Lifers", max: 18 },
  { key: "practicality", label: "Route", areaLabel: "Proximity", max: 20 }
];

const SCORE_COMPONENTS = [
  { key: "current", label: "Recent evidence", max: 35 },
  { key: "stable", label: "Hotspot history", max: 10 },
  { key: "personal", label: "Personal value", max: 15 },
  { key: "practicality", label: "Route", areaLabel: "Proximity", max: 40 }
];

function scoreComponents(candidate, isArea) {
  const parts = candidate.scoreParts || {};
  const components = candidate.scoringVersion === SCORING_VERSION
    ? SCORE_COMPONENTS.filter((part) => candidate.enabledScoreParts?.includes(part.key))
    : LEGACY_SCORE_COMPONENTS;
  return components.map((part) => ({
    key: part.key,
    label: isArea && part.areaLabel ? part.areaLabel : part.label,
    max: part.max,
    value: Number.isFinite(parts[part.key]) ? parts[part.key] : 0
  }));
}

// Read from the scoring context each candidate was scored in, not the current life
// list: saved trips keep the scores they were built with, so a life list imported or
// cleared since then would otherwise put the pill on a scale its own numbers can
// exceed. Trips saved before that context was recorded fall back to the scores
// themselves, which can understate the scale but can never contradict it.
function scoreScale(candidates) {
  const current = candidates.every((candidate) => candidate.scoringVersion === SCORING_VERSION);
  if (current) return { includesLifers: false, max: 100, legacy: false };
  const includesLifers = candidates.some((candidate) => (
    typeof candidate.scoredWithLifeList === "boolean"
      ? candidate.scoredWithLifeList
      : Number(candidate.scoreParts?.lifers) > 0
  ));
  const max = LEGACY_SCORE_COMPONENTS.reduce(
    (sum, part) => sum + (part.key === "lifers" && !includesLifers ? 0 : part.max),
    0
  );
  return { includesLifers, max, legacy: true };
}

function scoreTooltip(candidate, isArea, scale) {
  const breakdown = scoreComponents(candidate, isArea)
    .filter((part) => scale.includesLifers || part.key !== "lifers")
    .map((part) => `${part.label} ${part.value.toFixed(1)}/${part.max}`)
    .join(", ");
  return `${candidate.scoringVersion === SCORING_VERSION ? "Score" : "Legacy score"} ${candidate.score} of ${scale.max} — ${breakdown}`;
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
  if (names.length) return names.join(", ");
  return candidate.evidence?.recent?.status === "failed"
    ? "Recent reports unavailable"
    : "No reports in the selected window";
}

function candidateReasonText(candidate, isArea = state.params?.mode === "area") {
  const reasons = [];
  const targetCount = candidate.targetMatches.length;
  const liferCount = candidate.liferSpecies.length;
  const notableCount = uniqueNotableCount(candidate);
  const unseenNearbyCount = unseenNotableSpecies(candidate).length;
  const otherNearbyNotableCount = Math.max(0, notableCount - unseenNearbyCount);

  if (targetCount) reasons.push(`${targetCount} ${pluralize("target", targetCount)}`);
  if (liferCount) reasons.push(`${liferCount} recently reported ${pluralize("species", liferCount)} not on your list`);
  if (unseenNearbyCount) reasons.push(`${unseenNearbyCount} unseen ${pluralize("notable", unseenNearbyCount)} nearby`);
  if (otherNearbyNotableCount) {
    if (unseenNearbyCount) {
      const rarityLabel = otherNearbyNotableCount === 1 ? "rarity" : "rarities";
      reasons.push(`${otherNearbyNotableCount} other nearby recent ${rarityLabel}`);
    } else if (otherNearbyNotableCount === 1) {
      reasons.push("nearby recent rarity");
    } else {
      reasons.push(`${otherNearbyNotableCount} nearby recent rarities`);
    }
  }

  if (!reasons.length) {
    if (candidate.species.size) {
      reasons.push(`${candidate.species.size} recently reported ${pluralize("species", candidate.species.size)}`);
    } else if (candidate.allTimeSpeciesCount) {
      reasons.push(`established hotspot with ${candidate.allTimeSpeciesCount} species reported all time`);
    } else {
      reasons.push("known public eBird hotspot");
    }
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

function candidateChips(candidate, index) {
  const chips = [];
  if (candidate.evidence?.recent?.status === "failed") {
    chips.push('<span class="stop-chip">limited evidence</span>');
  } else if (!candidate.species.size) {
    chips.push('<span class="stop-chip">no recent reports</span>');
  }
  if (candidate.targetMatches.length) chips.push(`<span class="stop-chip chip-target">${candidate.targetMatches.length} target</span>`);
  const liferNames = uniqueObservationNames(candidate.liferSpecies);
  if (liferNames.length) {
    chips.push(candidateSpeciesPreview({
      count: liferNames.length,
      index,
      kind: "lifer",
      label: "not on your list",
      names: liferNames,
      title: "Unseen recent species at this stop"
    }));
  }

  const unseenNearby = unseenNotableSpecies(candidate);
  const unseenNearbyNames = uniqueObservationNames(unseenNearby);
  const unseenNearbyKeys = new Set(unseenNearbyNames.map(normalizeName));
  const otherNearbyNames = uniqueObservationNames(candidate.notable.filter((obs) => {
    const key = normalizeName(obs.comName || obs.sciName || obs.speciesCode);
    return key && !unseenNearbyKeys.has(key);
  }));

  if (unseenNearbyNames.length) {
    chips.push(candidateSpeciesPreview({
      count: unseenNearbyNames.length,
      index,
      kind: "unseen-nearby",
      label: "unseen nearby",
      names: unseenNearbyNames,
      title: "Unseen nearby notables"
    }));
  }
  if (otherNearbyNames.length) {
    chips.push(candidateSpeciesPreview({
      count: otherNearbyNames.length,
      index,
      kind: "notable",
      label: unseenNearbyNames.length ? "other notable nearby" : "notable nearby",
      names: otherNearbyNames,
      title: unseenNearbyNames.length ? "Other nearby notables" : "Nearby notables"
    }));
  }
  if (isHotspot(candidate)) chips.push('<span class="stop-chip chip-hotspot">top hotspot</span>');
  const stopTiming = candidateTiming(candidate);
  if (stopTiming) {
    chips.push(`<span class="stop-chip chip-time-${stopTiming.assessment.quality}" title="${escapeHtml(timingSentence(stopTiming))}">~${escapeHtml(formatClock(stopTiming.arrivalMs, stopTimeContext(stopTiming.lng)))} · ${escapeHtml(timingChipLabel(stopTiming))}</span>`);
  }
  return chips.join("");
}

function candidateSpeciesPreview({ count, index, kind, label, names, title }) {
  const previewId = `stop-${index}-${kind}-preview`;
  return `
    <div class="stop-chip-menu preview-${kind}">
      <button
        type="button"
        class="stop-chip chip-${kind}"
        aria-describedby="${previewId}"
        aria-label="${count} ${escapeHtml(label)}. Show ${escapeHtml(title.toLowerCase())}."
      >${count} ${escapeHtml(label)}</button>
      <div id="${previewId}" class="stop-chip-dropdown" role="tooltip">
        <strong>${escapeHtml(title)}</strong>
        <small>${count} species</small>
        <ul>${names.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>
      </div>
    </div>`;
}

function setupCandidateSpeciesPreviews(card) {
  card.querySelectorAll(".stop-chip-menu").forEach((menu) => {
    const trigger = menu.querySelector("button.stop-chip");
    const activate = () => {
      card.classList.add("has-active-species-preview");
      positionCandidateSpeciesPreview(menu);
    };
    const deactivate = () => {
      if (!card.querySelector(".stop-chip-menu:hover, .stop-chip-menu:focus-within")) {
        card.classList.remove("has-active-species-preview");
      }
    };
    menu.addEventListener("pointerenter", activate);
    menu.addEventListener("pointerleave", deactivate);
    trigger?.addEventListener("focus", activate);
    trigger?.addEventListener("blur", () => requestAnimationFrame(deactivate));
  });
}

function positionCandidateSpeciesPreview(menu) {
  const dropdown = menu.querySelector(".stop-chip-dropdown");
  if (!dropdown || !els.resultsList) return;
  menu.classList.remove("opens-up");
  const triggerRect = menu.getBoundingClientRect();
  const resultsRect = els.resultsList.getBoundingClientRect();
  const gap = 7;
  const edgePadding = 8;
  const dropdownWidth = Math.max(0, Math.min(280, resultsRect.width - edgePadding * 2));
  const dropdownLeft = Math.min(
    Math.max(triggerRect.left, resultsRect.left + edgePadding),
    resultsRect.right - edgePadding - dropdownWidth
  );
  const desiredHeight = Math.min(dropdown.scrollHeight, 250);
  const spaceBelow = Math.max(0, resultsRect.bottom - triggerRect.bottom - gap - edgePadding);
  const spaceAbove = Math.max(0, triggerRect.top - resultsRect.top - gap - edgePadding);
  const opensUp = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
  const availableHeight = Math.max(80, opensUp ? spaceAbove : spaceBelow);
  const dropdownOffset = dropdownLeft - triggerRect.left;
  const bridgeLeft = Math.min(0, dropdownOffset);
  const bridgeRight = Math.max(triggerRect.width, dropdownOffset + dropdownWidth);
  menu.classList.toggle("opens-up", opensUp);
  menu.style.setProperty("--stop-chip-dropdown-left", `${dropdownOffset}px`);
  menu.style.setProperty("--stop-chip-dropdown-width", `${dropdownWidth}px`);
  menu.style.setProperty("--stop-chip-dropdown-max-height", `${Math.min(250, availableHeight)}px`);
  menu.style.setProperty("--stop-chip-bridge-left", `${bridgeLeft}px`);
  menu.style.setProperty("--stop-chip-bridge-width", `${bridgeRight - bridgeLeft}px`);
  menu.style.setProperty("--stop-chip-bridge-trigger-left", `${-bridgeLeft}px`);
  menu.style.setProperty("--stop-chip-bridge-trigger-right", `${triggerRect.width - bridgeLeft}px`);
  menu.style.setProperty("--stop-chip-bridge-dropdown-left", `${dropdownOffset - bridgeLeft}px`);
  menu.style.setProperty("--stop-chip-bridge-dropdown-right", `${dropdownOffset + dropdownWidth - bridgeLeft}px`);
}

function isHotspot(candidate) {
  return candidate.score >= 65 || candidate.species.size >= 40;
}

function uniqueNotableCount(candidate) {
  return new Set(candidate.notable.map((obs) => normalizeName(obs.comName || obs.sciName))).size;
}

function unseenNotableSpecies(candidate, lifeList = state.lifeList.species) {
  if (!lifeList?.size) return [];
  const unseen = new Map();
  for (const obs of candidate.notable || []) {
    if (isSeenObservation(obs, lifeList)) continue;
    const key = normalizeName(obs.comName || obs.sciName || obs.speciesCode);
    if (key && !unseen.has(key)) unseen.set(key, obs);
  }
  return Array.from(unseen.values());
}

function prioritizedNotableReports(candidate, limit) {
  const observations = candidate.notable || [];
  if (!state.lifeList.species.size) return observations.slice(0, limit);

  const prioritizedIndexes = new Set();
  const unseenSpecies = new Set();
  const prioritized = [];
  observations.forEach((obs, index) => {
    if (isSeenObservation(obs, state.lifeList.species)) return;
    const key = normalizeName(obs.comName || obs.sciName || obs.speciesCode);
    if (!key || unseenSpecies.has(key)) return;
    unseenSpecies.add(key);
    prioritizedIndexes.add(index);
    prioritized.push(obs);
  });

  observations.forEach((obs, index) => {
    if (!prioritizedIndexes.has(index)) prioritized.push(obs);
  });
  return prioritized.slice(0, limit);
}

function notableUnseenBadge(obs) {
  if (!state.lifeList.species.size || isSeenObservation(obs, state.lifeList.species)) return "";
  return '<span class="unseen-nearby-badge">Unseen nearby</span>';
}

function notableSearchRadiusKm(params = state.params) {
  const radius = Number(params?.radiusKm);
  return Math.min(Number.isFinite(radius) && radius > 0 ? radius : 10, 10);
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
  updateResultsActions();
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
    if (state.sightingLocations.length) {
      els.sightingSummary.textContent = `${state.sightingLocations.length} ${pluralize("location", state.sightingLocations.length)} with recent sightings in the last ${recent} days (latest observation per location).`;
    } else {
      els.sightingSummary.textContent = canAttemptSearch
        ? "Recent sightings appear after you map a species."
        : "Add a personal eBird token in Settings (the gear icon) to map recent species sightings.";
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
    const unseenNearbyCount = uniqueUnseenNotableCount(state.results);
    const unseenNearbyText = state.lifeList.species.size && unseenNearbyCount
      ? ` and ${unseenNearbyCount} unseen species in nearby notable reports`
      : "";
    els.sightingSummary.textContent = `${speciesCount} recently reported species across ${state.results.length} ranked stops, including ${notableCount} nearby notable species${state.lifeList.species.size ? ` and ${liferCount} species not on your imported list` : ""}${unseenNearbyText}.`;
  } else {
    const searchedWithoutToken = state.mode === "area" ? state.areaCenter && !canAttemptSearch : state.route && !canAttemptSearch;
    els.sightingSummary.textContent = searchedWithoutToken
      ? `${state.mode === "area" ? "Area" : "Route"} is ready. Add a personal eBird token in Settings (the gear icon) to load recent sightings and notable reports.`
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

function uniqueUnseenNotableCount(candidates) {
  const unseen = new Set();
  for (const candidate of candidates) {
    for (const obs of unseenNotableSpecies(candidate)) {
      const key = normalizeName(obs.comName || obs.sciName || obs.speciesCode);
      if (key) unseen.add(key);
    }
  }
  return unseen.size;
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
      <p class="report-note">No target species were entered for this search. Use unseen recent reports, notable birds, and recent species lists as field priorities.</p>`;
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
  if (p.mode === "species") return buildSpeciesReportMarkup();
  const route = state.route;
  const isArea = p.mode === "area";
  const generated = new Date().toLocaleString();
  const orderedStops = reportOrderedStops(isArea);
  const param = (label, value, options = {}) => {
    const renderedValue = options.raw ? String(value) : escapeHtml(String(value));
    return `<div><dt>${escapeHtml(label)}</dt><dd>${renderedValue}</dd></div>`;
  };

  const departureMs = isArea ? null : departureTimestamp();
  const departParam = departureMs
    ? param("Leave at", `${formatClock(departureMs)}${routeTimeContext().approximate ? " (approximate local time at the origin)" : ""}`)
    : "";
  const paramsBlock = `
    <h2>Search parameters</h2>
    <dl class="report-params">
      ${param(isArea ? "Location" : "Origin", p.origin)}
      ${isArea ? "" : param("Destination", p.destination)}
      ${departParam}
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
        const notable = prioritizedNotableReports(candidate, 12);
        const unseenNearbyCount = unseenNotableSpecies(candidate).length;
        const links = candidateLinks(candidate);
        const stopTiming = candidateTiming(candidate);
        return `
          <div class="report-stop">
            <h3>${index + 1}. ${escapeHtml(candidate.name)}</h3>
            <p class="report-stop-meta">
              Score ${candidate.score} ·
              ${stopTiming ? `arrive ~${escapeHtml(formatClock(stopTiming.arrivalMs, stopTimeContext(stopTiming.lng)))} (${escapeHtml(timingChipLabel(stopTiming))}) ·` : ""}
              ${isArea
                ? `~${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi from center ·`
                : `+${Math.round(candidate.addedMinutes)} min · +${candidate.addedMiles.toFixed(1)} mi detour · ~${formatMiles(kmToMiles(candidate.routeDistanceKm))} mi off route ·`}
              ${candidate.species.size} species ·
              ${uniqueNotableCount(candidate)} nearby notable ·
              ${candidate.targetMatches.length} targets ·
              ${candidate.liferSpecies.length} unseen recent species at stop${state.lifeList.species.size ? ` · ${unseenNearbyCount} unseen nearby` : ""}
            </p>
            <p class="report-stop-reason">${escapeHtml(candidateReasonText(candidate, isArea))}</p>
            <dl class="report-stop-route">
              ${param("Coordinates", `${candidate.lat.toFixed(5)}, ${candidate.lng.toFixed(5)}`)}
              ${param("Directions", `<a href="${escapeHtml(links.mapsUrl)}">${escapeHtml(links.mapsUrl)}</a>`, { raw: true })}
              ${param("eBird", `<a href="${escapeHtml(links.ebirdUrl)}">${escapeHtml(links.ebirdUrl)}</a>`, { raw: true })}
            </dl>
            ${candidate.targetMatches.length ? `<h4>Species targets</h4><ul>${candidate.targetMatches.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")}${obs.obsDt ? ` <small>${escapeHtml(obs.obsDt)}</small>` : ""}</li>`).join("")}</ul>` : ""}
            ${candidate.liferSpecies.length ? `<h4>Unseen species reported recently at this stop</h4><ul>${candidate.liferSpecies.slice(0, 20).map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")}</li>`).join("")}</ul>` : ""}
            ${notable.length ? `<h4>Nearby notable reports (within ${notableSearchRadiusKm(p)} km)</h4><ul>${notable.map((obs) => `<li>${escapeHtml(obs.comName || obs.sciName || "")} <small>${escapeHtml(obs.obsDt || "")}</small>${state.lifeList.species.size && !isSeenObservation(obs, state.lifeList.species) ? " — unseen nearby" : ""}</li>`).join("")}</ul>` : ""}
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

function buildSpeciesReportMarkup() {
  const p = state.params;
  const generated = new Date().toLocaleString();
  const center = state.areaCenter;
  const speciesLabel = state.species?.comName || p.speciesQuery || "Species";
  const locations = state.sightingLocations;
  const provider = p.mapProvider || state.provider;
  const param = (label, value, options = {}) => {
    const renderedValue = options.raw ? String(value) : escapeHtml(String(value));
    return `<div><dt>${escapeHtml(label)}</dt><dd>${renderedValue}</dd></div>`;
  };

  const paramsBlock = `
    <h2>Search parameters</h2>
    <dl class="report-params">
      ${param("Species", state.species?.sciName ? `${speciesLabel} (${state.species.sciName})` : speciesLabel)}
      ${param("Location", p.origin)}
      ${param("Map service", providerLabel(p.mapProvider))}
      ${param("Search radius", `${p.radiusKm} km`)}
      ${param("Recent window", `${p.recentDays} days`)}
    </dl>`;

  const summaryBlock = `
    <h2>Species summary</h2>
    <dl class="report-route">
      ${param("Species", speciesLabel)}
      ${param("Location", state.routeName || p.origin)}
      ${param("Radius", `${p.radiusKm} km`)}
      ${param("Locations with recent sightings", locations.length)}
      ${param("Records", `${locations.length} (latest observation per location)`)}
      ${center ? param("Center coordinates", `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`) : ""}
    </dl>`;

  const locationsBlock = locations.length
    ? `<h2>Sighting locations</h2>${locations.map((loc, index) => {
        const ebirdUrl = loc.locId
          ? `https://ebird.org/hotspot/${encodeURIComponent(loc.locId)}`
          : `https://ebird.org/map?lat=${loc.lat}&lng=${loc.lng}`;
        const mapsUrl = directionsUrlForPoints([center, loc].filter(Boolean), provider);
        const howManyText = loc.maxCount ? `${loc.maxCount} ${pluralize("bird", loc.maxCount)} counted · ` : "";
        return `
          <div class="report-stop">
            <h3>${index + 1}. ${escapeHtml(loc.name)}</h3>
            <p class="report-stop-meta">Latest observation · ${escapeHtml(howManyText)}${escapeHtml(formatFreshness(loc.latest))}${loc.latest ? ` <small>${escapeHtml(loc.latest)}</small>` : ""}</p>
            <dl class="report-stop-route">
              ${param("Coordinates", `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`)}
              ${mapsUrl ? param("Directions", `<a href="${escapeHtml(mapsUrl)}">${escapeHtml(mapsUrl)}</a>`, { raw: true }) : ""}
              ${param("eBird", `<a href="${escapeHtml(ebirdUrl)}">${escapeHtml(ebirdUrl)}</a>`, { raw: true })}
            </dl>
          </div>`;
      }).join("")}`
    : `<h2>Sighting locations</h2><p>No recent ${escapeHtml(speciesLabel)} sightings within ${escapeHtml(String(p.radiusKm))} km.</p>`;

  return `
    <h1>Birdtrip Species Report</h1>
    <p class="report-sub">${escapeHtml(state.routeName || speciesLabel)} · Generated ${escapeHtml(generated)}</p>
    ${paramsBlock}
    ${summaryBlock}
    ${locationsBlock}
  `;
}

function downloadHtmlReport() {
  if (!hasReportableSearch()) {
    setStatus("Nothing to export", `Run a ${reportModeNoun()} search before downloading a report.`);
    return;
  }

  renderReport();
  const documentHtml = buildStandaloneReportDocument(buildReportMarkup());
  downloadBlob(documentHtml, "text/html;charset=utf-8", reportFileName());
  setStatus("Report downloaded", "Saved a standalone HTML trip report for offline reference.");
}

function buildStandaloneReportDocument(reportMarkup) {
  const mode = state.params?.mode;
  const title = state.routeName
    ? `Birdtrip - ${state.routeName}`
    : `Birdtrip ${mode === "area" ? "Area" : mode === "species" ? "Species" : "Trip"} Report`;
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
  const mode = state.params?.mode;
  const fallback = mode === "area"
    ? state.params.origin
    : mode === "species"
      ? `${state.species?.comName || state.params.speciesQuery || "species"} ${state.params.origin}`
      : `${state.params.origin} to ${state.params.destination}`;
  const base = slugify(state.routeName || fallback)
    || `${mode === "area" ? "area" : mode === "species" ? "species" : "trip"}-report`;
  const date = new Date().toISOString().slice(0, 10);
  return `birdtrip-${base}-${date}.html`;
}

function reportModeNoun() {
  if (state.mode === "area") return "area";
  if (state.mode === "species") return "species";
  return "route";
}

function hasReportableSearch() {
  if (!state.params) return false;
  if (state.params.mode === "area") return Boolean(state.areaCenter);
  if (state.params.mode === "species") return Boolean(state.areaCenter);
  return Boolean(state.route);
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
    this.map.attributionControl.setPrefix(false);
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
    const howMany = candidate.maxCount ? `; ${candidate.maxCount} ${pluralize("bird", candidate.maxCount)} counted` : "";
    return `<strong>${escapeHtml(candidate.name)}</strong><br>Latest observation ${escapeHtml(when)}${howMany}`;
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
