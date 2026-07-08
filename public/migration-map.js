(function () {
  const MONTHS = [
    { value: 0, label: "Jan", name: "January", phase: "Wintering concentration", path: "winter", direction: "Wintering", base: 0.18 },
    { value: 1, label: "Feb", name: "February", phase: "Early northbound movement", path: "spring", direction: "Northbound", base: 0.3 },
    { value: 2, label: "Mar", name: "March", phase: "Building spring movement", path: "spring", direction: "Northbound", base: 0.58 },
    { value: 3, label: "Apr", name: "April", phase: "Peak spring movement", path: "spring", direction: "Northbound", base: 1 },
    { value: 4, label: "May", name: "May", phase: "Late spring movement", path: "spring", direction: "Northbound", base: 0.74 },
    { value: 5, label: "Jun", name: "June", phase: "Breeding season concentration", path: "breeding", direction: "Breeding range", base: 0.16 },
    { value: 6, label: "Jul", name: "July", phase: "Post-breeding dispersal", path: "fall", direction: "Early southbound", base: 0.24 },
    { value: 7, label: "Aug", name: "August", phase: "Building fall movement", path: "fall", direction: "Southbound", base: 0.62 },
    { value: 8, label: "Sep", name: "September", phase: "Peak fall movement", path: "fall", direction: "Southbound", base: 1 },
    { value: 9, label: "Oct", name: "October", phase: "Strong fall movement", path: "fall", direction: "Southbound", base: 0.86 },
    { value: 10, label: "Nov", name: "November", phase: "Late fall movement", path: "fall", direction: "Southbound", base: 0.44 },
    { value: 11, label: "Dec", name: "December", phase: "Wintering concentration", path: "winter", direction: "Wintering", base: 0.2 }
  ];

  const GROUPS = {
    all: {
      label: "All nocturnal migrants",
      description: "Broad overnight movement across the major continental flyways.",
      corridors: ["mississippi", "atlantic", "central", "pacific", "gulf", "greatLakes"],
      focus: "Radar-visible nocturnal migration is strongest after sunset and often pulses with favorable winds.",
      months: [0.18, 0.3, 0.62, 1, 0.74, 0.16, 0.24, 0.62, 1, 0.86, 0.44, 0.2]
    },
    warblers: {
      label: "Warblers and songbirds",
      description: "Neotropical songbirds moving through wooded river systems, Gulf arrivals, and eastern stopover belts.",
      corridors: ["gulf", "mississippi", "atlantic", "greatLakes"],
      focus: "Expect broad nighttime flights with heavy stopover use in riparian woods, coastal forests, and lake edges.",
      months: [0.08, 0.18, 0.52, 1, 0.88, 0.12, 0.12, 0.44, 1, 0.78, 0.24, 0.08]
    },
    waterfowl: {
      label: "Waterfowl",
      description: "Ducks and geese tracking wetlands, prairie potholes, large river valleys, and coastal marshes.",
      corridors: ["central", "mississippi", "pacific", "atlantic"],
      focus: "Movements cluster around wetland complexes rather than a single narrow line.",
      months: [0.24, 0.34, 0.74, 0.9, 0.48, 0.12, 0.16, 0.28, 0.58, 1, 0.82, 0.32]
    },
    shorebirds: {
      label: "Shorebirds",
      description: "Long-distance migrants using coasts, inland playas, prairie wetlands, and exposed mudflats.",
      corridors: ["atlantic", "pacific", "central", "gulf"],
      focus: "Timing and local water levels can shift stopovers dramatically.",
      months: [0.12, 0.16, 0.42, 0.78, 0.92, 0.22, 0.62, 1, 0.84, 0.42, 0.18, 0.1]
    },
    raptors: {
      label: "Raptors",
      description: "Daytime migration concentrated along ridges, shorelines, and thermal corridors.",
      corridors: ["appalachian", "atlantic", "pacific", "central"],
      focus: "This layer is a daytime corridor approximation, unlike the nocturnal songbird layers.",
      months: [0.08, 0.14, 0.36, 0.64, 0.42, 0.08, 0.08, 0.2, 1, 0.88, 0.34, 0.08]
    },
    hummingbirds: {
      label: "Hummingbirds",
      description: "Small-bodied migrants moving through the Gulf Coast, Southwest, and Pacific slope.",
      corridors: ["gulf", "pacific", "central"],
      focus: "Ruby-throated movement dominates the East; western species use mountain and coastal corridors.",
      months: [0.08, 0.16, 0.58, 1, 0.58, 0.1, 0.14, 0.56, 0.92, 0.52, 0.14, 0.08]
    }
  };

  const CORRIDORS = {
    atlantic: {
      name: "Atlantic Flyway",
      anchor: { lat: 37.6, lng: -76.4 },
      spring: [[25.8, -80.1], [30.3, -81.5], [34.0, -78.7], [38.9, -76.6], [41.8, -72.6], [44.5, -69.0]],
      fall: [[45.0, -69.2], [41.9, -72.8], [38.8, -76.7], [34.3, -78.6], [30.1, -81.4], [25.8, -80.1]],
      winter: [[25.8, -80.1], [30.3, -81.5], [34.0, -78.7], [36.6, -75.9]],
      breeding: [[38.9, -76.6], [41.8, -72.6], [44.5, -69.0]],
      width: 42,
      color: "#0891b2",
      base: 0.78,
      groups: { all: 1, warblers: 0.95, waterfowl: 0.82, shorebirds: 1, raptors: 0.72 }
    },
    mississippi: {
      name: "Mississippi River Corridor",
      anchor: { lat: 36.2, lng: -90.2 },
      spring: [[29.9, -90.1], [33.0, -91.0], [36.1, -90.2], [39.2, -90.3], [42.2, -91.2], [45.0, -93.1]],
      fall: [[45.0, -93.1], [42.1, -91.2], [39.2, -90.3], [36.1, -90.2], [32.9, -91.0], [29.9, -90.1]],
      winter: [[29.9, -90.1], [32.9, -91.0], [36.1, -90.2]],
      breeding: [[39.2, -90.3], [42.2, -91.2], [45.0, -93.1]],
      width: 48,
      color: "#10b981",
      base: 0.98,
      groups: { all: 1, warblers: 1, waterfowl: 1, shorebirds: 0.76 }
    },
    central: {
      name: "Central Plains Flyway",
      anchor: { lat: 38.5, lng: -99.2 },
      spring: [[27.5, -97.4], [32.6, -99.0], [37.0, -99.6], [41.2, -100.2], [46.0, -101.0], [48.8, -103.0]],
      fall: [[48.8, -103.0], [45.8, -101.0], [41.2, -100.2], [37.0, -99.6], [32.6, -99.0], [27.5, -97.4]],
      winter: [[27.5, -97.4], [32.6, -99.0], [37.0, -99.6]],
      breeding: [[41.2, -100.2], [46.0, -101.0], [48.8, -103.0]],
      width: 52,
      color: "#f59e0b",
      base: 0.84,
      groups: { all: 1, waterfowl: 1, shorebirds: 0.9, raptors: 0.72, hummingbirds: 0.62 }
    },
    pacific: {
      name: "Pacific Flyway",
      anchor: { lat: 39.2, lng: -121.2 },
      spring: [[32.6, -117.1], [35.0, -119.6], [38.6, -121.6], [42.4, -122.8], [45.6, -122.7], [48.8, -122.5]],
      fall: [[48.8, -122.5], [45.6, -122.7], [42.4, -122.8], [38.6, -121.6], [35.0, -119.6], [32.6, -117.1]],
      winter: [[32.6, -117.1], [35.0, -119.6], [38.6, -121.6]],
      breeding: [[42.4, -122.8], [45.6, -122.7], [48.8, -122.5]],
      width: 46,
      color: "#7c3aed",
      base: 0.76,
      groups: { all: 1, waterfowl: 0.9, shorebirds: 1, raptors: 0.86, hummingbirds: 0.86 }
    },
    gulf: {
      name: "Gulf Coast Launch and Landfall Belt",
      anchor: { lat: 29.4, lng: -91.4 },
      spring: [[25.7, -97.2], [28.7, -95.2], [29.4, -91.4], [30.2, -88.2], [29.9, -84.0], [27.8, -82.5]],
      fall: [[30.6, -84.4], [30.0, -88.6], [29.4, -91.4], [28.7, -95.2], [25.7, -97.2]],
      winter: [[25.7, -97.2], [28.7, -95.2], [29.4, -91.4], [30.2, -88.2], [29.9, -84.0], [27.8, -82.5]],
      breeding: [[28.7, -95.2], [29.4, -91.4], [30.2, -88.2]],
      width: 50,
      color: "#ef4444",
      base: 0.9,
      groups: { all: 1, warblers: 1, shorebirds: 0.82, hummingbirds: 1 }
    },
    greatLakes: {
      name: "Great Lakes Stopover Belt",
      anchor: { lat: 42.7, lng: -84.7 },
      spring: [[41.6, -87.4], [42.7, -84.7], [42.5, -81.2], [43.7, -78.8], [44.2, -76.4]],
      fall: [[44.2, -76.4], [43.7, -78.8], [42.5, -81.2], [42.7, -84.7], [41.6, -87.4]],
      winter: [[41.6, -87.4], [42.7, -84.7], [42.5, -81.2]],
      breeding: [[42.5, -81.2], [43.7, -78.8], [44.2, -76.4]],
      width: 34,
      color: "#2563eb",
      base: 0.68,
      groups: { all: 0.8, warblers: 0.94 }
    },
    appalachian: {
      name: "Appalachian Ridge Corridor",
      anchor: { lat: 40.3, lng: -76.0 },
      spring: [[34.8, -83.7], [37.2, -80.4], [40.3, -76.0], [42.4, -74.0], [44.0, -72.3]],
      fall: [[44.0, -72.3], [42.4, -74.0], [40.3, -76.0], [37.2, -80.4], [34.8, -83.7]],
      winter: [[34.8, -83.7], [37.2, -80.4], [40.3, -76.0]],
      breeding: [[40.3, -76.0], [42.4, -74.0], [44.0, -72.3]],
      width: 30,
      color: "#334155",
      base: 0.74,
      groups: { raptors: 1 }
    }
  };

  const NOTES = {
    atlantic: "Coastal forests, marshes, barrier islands, and urban-light risks shape movement along the East Coast.",
    mississippi: "River valleys, bottomland forests, wetlands, and agricultural stopovers make this one of the continent's strongest shared corridors.",
    central: "Prairie wetlands, playas, and open-country winds produce broad Plains movement rather than a single narrow route.",
    pacific: "Coastal wetlands, Central Valley habitat, and western mountain edges carry a mixed waterbird and landbird stream.",
    gulf: "The Gulf belt is a critical launch, landfall, and refueling zone, especially for trans-Gulf songbirds and hummingbirds.",
    greatLakes: "Lake edges concentrate stopovers and can bend flights around large water bodies during strong passage windows.",
    appalachian: "Ridges and thermal lift concentrate visible daytime raptor movement."
  };

  function buildLayer(params = {}) {
    const monthValue = clamp(Number(params.migrationMonth ?? 3), 0, 11);
    const month = MONTHS[monthValue] || MONTHS[3];
    const groupKey = GROUPS[params.migrationGroup] ? params.migrationGroup : "all";
    const group = GROUPS[groupKey];
    const monthWeight = group.months[month.value] ?? month.base;
    const corridors = group.corridors
      .map((id) => buildCorridor(id, groupKey, group, month, monthWeight))
      .filter(Boolean)
      .sort((a, b) => b.intensity - a.intensity);

    return {
      month,
      monthValue: month.value,
      groupKey,
      group,
      corridors
    };
  }

  function buildCorridor(id, groupKey, group, month, monthWeight) {
    const corridor = CORRIDORS[id];
    if (!corridor) return null;
    const groupWeight = corridor.groups[groupKey] || corridor.groups.all || 0;
    if (!groupWeight) return null;
    const intensity = Math.round(clamp(corridor.base * groupWeight * monthWeight, 0.08, 1) * 100);
    const path = (corridor[month.path] || corridor.spring).map(([lat, lng]) => ({ lat, lng }));
    return {
      id,
      name: corridor.name,
      path,
      anchor: corridor.anchor,
      color: corridor.color,
      width: Math.round(corridor.width * (0.54 + intensity / 210)),
      intensity,
      direction: month.direction,
      summary: corridorSummary(id, groupKey, month, group),
      phase: month.phase
    };
  }

  function corridorSummary(id, groupKey, month, group) {
    const groupNote = groupKey === "raptors"
      ? "Raptor timing is daytime and weather-dependent."
      : groupKey === "waterfowl"
        ? "Wetland availability can shift local intensity."
        : groupKey === "shorebirds"
          ? "Mudflat and water-level conditions strongly affect stopovers."
          : "Nightly weather can move peak flights earlier or later.";
    return `${NOTES[id] || "A broad seasonal movement corridor."} ${groupNote} Current view shows ${month.name.toLowerCase()} as ${group.label.toLowerCase()} enter ${month.phase.toLowerCase()}.`;
  }

  function createController(options) {
    return new MigrationController(options);
  }

  class MigrationController {
    constructor(options) {
      this.options = options || {};
      this.els = this.options.elements || {};
      this.getMapAdapter = this.options.getMapAdapter || (() => null);
      this.onLayerChange = this.options.onLayerChange || (() => {});
      this.onControlsChanged = this.options.onControlsChanged || (() => {});
      this.setSelectedId = this.options.setSelectedId || (() => {});
      this.getSelectedId = this.options.getSelectedId || (() => null);
      this.renderIcons = this.options.renderIcons || (() => {});
      this.setStatus = this.options.setStatus || (() => {});
      this.layer = null;
      this.playTimer = 0;
    }

    attach() {
      this.renderMonthButtons();
      this.els.group?.addEventListener("change", () => this.onControlsChanged());
      this.els.month?.addEventListener("input", () => this.onControlsChanged());
      this.els.play?.addEventListener("click", () => this.togglePlayback());
      this.syncControls();
    }

    readParams() {
      return {
        migrationGroup: this.els.group?.value || "all",
        migrationMonth: clamp(Number(this.els.month?.value ?? 3), 0, 11)
      };
    }

    render(params = this.readParams()) {
      this.layer = buildLayer(params);
      this.syncControls(this.layer);
      this.renderMap();
      this.renderResults();
      this.onLayerChange(this.layer);
      return this.layer;
    }

    setLayer(layer) {
      this.layer = layer || null;
      this.syncControls(layer);
      this.renderMap();
      this.renderResults();
    }

    renderMap() {
      const mapAdapter = this.getMapAdapter();
      if (!mapAdapter || !this.layer) return;
      mapAdapter.setMigration(this.layer, this.getSelectedId(), (id) => this.selectCorridor(id));
    }

    renderResults() {
      const layer = this.layer;
      if (!layer) return;
      const els = this.els;
      if (els.resultsTitle) els.resultsTitle.textContent = "Migration Map";
      if (els.resultLegend) els.resultLegend.hidden = true;
      if (els.itineraryBuilder) els.itineraryBuilder.hidden = true;
      if (els.comparisonPanel) els.comparisonPanel.hidden = true;
      if (els.routeDistance) els.routeDistance.textContent = String(layer.corridors.length);
      if (els.hotspotCount) els.hotspotCount.textContent = `${layer.corridors[0]?.intensity || 0}%`;
      if (els.notableCount) els.notableCount.textContent = directionShort(layer.month.direction);
      if (els.candidateCount) els.candidateCount.textContent = String(layer.corridors.length);
      if (els.liferCount) els.liferCount.textContent = "-";
      if (els.targetCount) els.targetCount.textContent = layer.groupKey === "all" ? "6" : "1";
      if (els.maxAdded) els.maxAdded.textContent = layer.month.label;
      if (els.resultContext) {
        els.resultContext.textContent = `${layer.group.label}; ${layer.month.name}; ${layer.month.phase.toLowerCase()}.`;
      }
      if (!els.resultsList) return;

      els.resultsList.className = "results-list migration-results";
      els.resultsList.innerHTML = `
        <section class="migration-overview">
          <div>
            <span>${escapeHtml(layer.month.name)}</span>
            <h3>${escapeHtml(layer.group.label)}</h3>
            <p>${escapeHtml(layer.group.description)}</p>
          </div>
          <b>${escapeHtml(layer.month.phase)}</b>
        </section>
        <section class="migration-note">
          <i data-lucide="info"></i>
          <p>${escapeHtml(layer.group.focus)} This annual timeline shows modeled macro patterns for the United States; it is not live radar and does not identify individual birds.</p>
        </section>
      `;

      layer.corridors.forEach((corridor) => {
        const card = document.createElement("article");
        card.className = "migration-card";
        card.dataset.id = corridor.id;
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        if (corridor.id === this.getSelectedId()) card.classList.add("is-selected");
        card.innerHTML = `
          <div class="migration-card-main">
            <span class="migration-swatch" style="--migration-color: ${escapeHtml(corridor.color)}"></span>
            <div>
              <h3>${escapeHtml(corridor.name)}</h3>
              <p>${escapeHtml(corridor.summary)}</p>
            </div>
          </div>
          <div class="migration-meter" aria-label="Relative intensity ${corridor.intensity} percent">
            <span style="width: ${corridor.intensity}%"></span>
          </div>
          <div class="migration-card-meta">
            <span><i data-lucide="${directionIcon(corridor.direction)}"></i>${escapeHtml(corridor.direction)}</span>
            <span><i data-lucide="activity"></i>${corridor.intensity}% relative intensity</span>
          </div>
        `;
        card.addEventListener("click", () => this.selectCorridor(corridor.id));
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.selectCorridor(corridor.id);
          }
        });
        els.resultsList.appendChild(card);
      });
      this.renderIcons();
    }

    selectCorridor(id) {
      const corridor = this.layer?.corridors.find((item) => item.id === id);
      if (!corridor) return;
      this.setSelectedId(id);
      this.els.resultsList?.querySelectorAll(".migration-card").forEach((card) => {
        card.classList.toggle("is-selected", card.dataset.id === id);
      });
      this.renderMap();
      const mapAdapter = this.getMapAdapter();
      if (mapAdapter) mapAdapter.flyTo(corridor.anchor, 6);
    }

    syncControls(layer = this.layer || buildLayer(this.readParams())) {
      const month = layer.month || MONTHS[3];
      if (this.els.month && Number(this.els.month.value) !== month.value) {
        this.els.month.value = String(month.value);
      }
      if (this.els.monthLabel) this.els.monthLabel.textContent = month.name;
      if (this.els.phaseLabel) this.els.phaseLabel.textContent = month.phase;
      if (this.els.timeline) {
        this.els.timeline.querySelectorAll("[data-month]").forEach((button) => {
          button.classList.toggle("is-active", Number(button.dataset.month) === month.value);
        });
      }
    }

    renderMonthButtons() {
      if (!this.els.timeline) return;
      this.els.timeline.innerHTML = "";
      MONTHS.forEach((month) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.month = String(month.value);
        button.textContent = month.label;
        button.addEventListener("click", () => {
          if (this.els.month) this.els.month.value = String(month.value);
          this.onControlsChanged();
        });
        this.els.timeline.appendChild(button);
      });
    }

    togglePlayback() {
      if (this.playTimer) {
        this.stopPlayback();
        return;
      }
      this.playTimer = window.setInterval(() => {
        const nextMonth = (clamp(Number(this.els.month?.value ?? 3), 0, 11) + 1) % 12;
        if (this.els.month) this.els.month.value = String(nextMonth);
        this.onControlsChanged();
      }, 900);
      if (this.els.play) {
        this.els.play.classList.add("is-playing");
        this.els.play.innerHTML = '<i data-lucide="pause"></i><span>Pause</span>';
        this.renderIcons();
      }
    }

    stopPlayback() {
      if (this.playTimer) {
        window.clearInterval(this.playTimer);
        this.playTimer = 0;
      }
      if (this.els.play) {
        this.els.play.classList.remove("is-playing");
        this.els.play.innerHTML = '<i data-lucide="play"></i><span>Play</span>';
        this.renderIcons();
      }
    }
  }

  function directionIcon(direction) {
    if (direction.includes("North")) return "arrow-up";
    if (direction.includes("South")) return "arrow-down";
    if (direction.includes("Breeding")) return "map-pinned";
    return "circle-dot";
  }

  function directionShort(direction) {
    if (direction.includes("North")) return "N";
    if (direction.includes("South")) return "S";
    if (direction.includes("Breeding")) return "B";
    return "W";
  }

  function popup(corridor) {
    return `<strong>${escapeHtml(corridor.name)}</strong><br>${escapeHtml(corridor.direction)}; ${corridor.intensity}% relative intensity<br>${escapeHtml(corridor.summary)}`;
  }

  function reportMarkup(layer) {
    const migration = layer || buildLayer();
    const generated = new Date().toLocaleString();
    const corridorsBlock = migration.corridors.length
      ? `<h2>Migration corridors</h2>${migration.corridors.map((corridor, index) => `
          <div class="report-stop">
            <h3>${index + 1}. ${escapeHtml(corridor.name)}</h3>
            <p class="report-stop-meta">${escapeHtml(corridor.direction)} - ${corridor.intensity}% relative intensity</p>
            <p class="report-stop-reason">${escapeHtml(corridor.summary)}</p>
          </div>
        `).join("")}`
      : "<h2>Migration corridors</h2><p>No corridors are available for these settings.</p>";

    return `
      <h1>Birdtrip Migration Map Report</h1>
      <p class="report-sub">${escapeHtml(migration.group.label)} - ${escapeHtml(migration.month.name)} - Generated ${escapeHtml(generated)}</p>
      <h2>Map parameters</h2>
      <dl class="report-params">
        ${param("Month", migration.month.name)}
        ${param("Annual phase", migration.month.phase)}
        ${param("Bird group", migration.group.label)}
        ${param("Corridors shown", migration.corridors.length)}
      </dl>
      <h2>Interpretation</h2>
      <p>${escapeHtml(migration.group.description)} ${escapeHtml(migration.group.focus)} This is a modeled macro visualization, not live radar or species-level tracking.</p>
      ${corridorsBlock}
    `;
  }

  function param(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
  }

  function fileLabel(layer) {
    const migration = layer || buildLayer();
    return `${migration.group.label} ${migration.month.name}`;
  }

  function monthFor(value) {
    return MONTHS[clamp(Number(value ?? 3), 0, 11)] || MONTHS[3];
  }

  function isGroup(value) {
    return Boolean(GROUPS[value]);
  }

  function groupCount(value) {
    const group = GROUPS[value] || GROUPS.all;
    return value === "all" ? "6" : String(group.corridors.length);
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.BirdtripMigrationMap = {
    MONTHS,
    GROUPS,
    buildLayer,
    createController,
    popup,
    reportMarkup,
    fileLabel,
    monthFor,
    isGroup,
    groupCount
  };
})();
