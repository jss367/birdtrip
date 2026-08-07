(function () {
  const MM = window.BirdtripMigrationMap;
  const STORAGE_KEY = "birdtripMigrationView";
  const DEFAULTS = { group: "all", month: 3 };

  const els = {
    group: document.querySelector("#migrationGroup"),
    month: document.querySelector("#migrationMonth"),
    monthLabel: document.querySelector("#migrationMonthLabel"),
    phaseLabel: document.querySelector("#migrationPhaseLabel"),
    play: document.querySelector("#migrationPlayButton"),
    timeline: document.querySelector("#migrationTimeline"),
    resultContext: document.querySelector("#resultContext"),
    resultsList: document.querySelector("#resultsList"),
    shareButton: document.querySelector("#shareButton"),
    downloadButton: document.querySelector("#downloadReportButton"),
    status: document.querySelector("#pageStatus")
  };

  function parseGroup(value) {
    return typeof value === "string" && MM.isGroup(value) ? value : null;
  }

  function parseMonth(value) {
    return typeof value === "string" && /^(?:[0-9]|1[01])$/.test(value.trim())
      ? Number(value.trim())
      : null;
  }

  function readStoredView() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || typeof raw !== "object") return { group: null, month: null };
      return {
        group: parseGroup(String(raw.group ?? "")),
        month: parseMonth(String(raw.month ?? ""))
      };
    } catch {
      return { group: null, month: null };
    }
  }

  function readUrlView() {
    const search = new URLSearchParams(window.location.search);
    return {
      group: parseGroup(search.get("group") || ""),
      month: parseMonth(search.get("month") || "")
    };
  }

  function resolveInitialView() {
    const stored = readStoredView();
    const fromUrl = readUrlView();
    return {
      group: fromUrl.group ?? stored.group ?? DEFAULTS.group,
      month: fromUrl.month ?? stored.month ?? DEFAULTS.month
    };
  }

  class MigrationLeafletAdapter {
    constructor(container) {
      this.container = container;
      this.map = null;
      this.migrationLayer = null;
    }

    init() {
      this.map = L.map(this.container, { zoomControl: true }).setView([38.5, -95.5], 4);
      this.map.attributionControl.setPrefix(false);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(this.map);
    }

    setMigration(migration, selectedId, onSelect) {
      if (this.migrationLayer) {
        this.map.removeLayer(this.migrationLayer);
        this.migrationLayer = null;
      }
      const layers = [];
      migration.corridors.forEach((corridor) => {
        const selected = corridor.id === selectedId;
        const latLngs = corridor.path.map((point) => [point.lat, point.lng]);
        const line = L.polyline(latLngs, {
          color: corridor.color,
          weight: selected ? corridor.width + 7 : corridor.width,
          opacity: selected ? 0.88 : 0.56,
          lineCap: "round",
          lineJoin: "round"
        }).bindPopup(MM.popup(corridor));
        line.on("click", () => onSelect(corridor.id));
        layers.push(line);
        const dot = L.circleMarker([corridor.anchor.lat, corridor.anchor.lng], {
          radius: selected ? 10 : 7,
          color: "#ffffff",
          weight: 2,
          fillColor: corridor.color,
          fillOpacity: selected ? 0.96 : 0.82
        }).bindPopup(MM.popup(corridor));
        dot.on("click", () => onSelect(corridor.id));
        layers.push(dot);
        for (const flow of MM.flowMarkers(corridor)) {
          const flowMarker = L.marker([flow.lat, flow.lng], {
            interactive: false,
            icon: L.divIcon({
              className: "",
              html: MM.flowMarkerHtml(flow),
              iconSize: [flow.size + 10, flow.size + 10],
              iconAnchor: [(flow.size + 10) / 2, (flow.size + 10) / 2]
            })
          });
          layers.push(flowMarker);
        }
      });
      this.migrationLayer = L.featureGroup(layers).addTo(this.map);
      this.map.fitBounds(this.migrationLayer.getBounds(), { padding: [36, 36] });
    }

    flyTo(point, minZoom) {
      this.map.flyTo([point.lat, point.lng], Math.max(this.map.getZoom(), minZoom), { duration: 0.6 });
    }
  }

  const mapAdapter = window.L ? new MigrationLeafletAdapter(document.querySelector("#map")) : null;
  if (mapAdapter) mapAdapter.init();

  let selectedId = null;

  const controller = MM.createController({
    elements: {
      group: els.group,
      month: els.month,
      monthLabel: els.monthLabel,
      phaseLabel: els.phaseLabel,
      play: els.play,
      timeline: els.timeline,
      resultContext: els.resultContext,
      resultsList: els.resultsList
    },
    getMapAdapter: () => mapAdapter,
    getSelectedId: () => selectedId,
    setSelectedId: (id) => {
      selectedId = id;
    },
    onControlsChanged: renderFromControls,
    onLayerChange: persistView,
    renderIcons: () => {
      if (window.lucide) window.lucide.createIcons();
    }
  });

  function renderFromControls() {
    selectedId = null;
    controller.render({
      migrationGroup: els.group.value,
      migrationMonth: Number(els.month.value)
    });
  }

  function persistView(layer) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ group: layer.groupKey, month: layer.monthValue }));
    } catch {
      // Storage unavailable (private mode, quota) - the view still works, it just isn't remembered.
    }
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("group", layer.groupKey);
    url.searchParams.set("month", String(layer.monthValue));
    window.history.replaceState(null, "", url);
  }

  function setPageStatus(message) {
    if (els.status) els.status.textContent = message;
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

  els.shareButton?.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await copyTextToClipboard(url);
      setPageStatus("Link copied.");
    } catch {
      setPageStatus(`Copy this link: ${url}`);
    }
  });

  function reportDocumentCss() {
    return `
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; }
  .report { max-width: 760px; margin: 0 auto; padding: 28px 20px 60px; }
  h1 { font-size: 1.6rem; margin-bottom: 4px; }
  h2 { font-size: 1.15rem; margin-top: 28px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .report-sub { color: #6b7280; margin-top: 0; }
  .report-params { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .report-params dt { font-size: 0.78rem; text-transform: uppercase; color: #6b7280; }
  .report-params dd { margin: 2px 0 0; font-weight: 600; }
  .report-stop { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-top: 12px; }
  .report-stop h3 { margin: 0 0 4px; }
  .report-stop-meta { color: #6b7280; margin: 0 0 6px; font-size: 0.9rem; }
  .report-stop-reason { margin: 0; }
`;
  }

  els.downloadButton?.addEventListener("click", () => {
    const layer = controller.layer;
    const title = `Birdtrip Migration Map - ${MM.fileLabel(layer)}`;
    const documentHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</title>
  <style>${reportDocumentCss()}</style>
</head>
<body>
  <main class="report">
${MM.reportMarkup(layer)}
  </main>
</body>
</html>
`;
    const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `birdtrip-migration-${layer.groupKey}-${layer.month.label.toLowerCase()}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPageStatus("Report downloaded.");
  });

  const initial = resolveInitialView();
  els.group.value = initial.group;
  els.month.value = String(initial.month);
  controller.attach();
  renderFromControls();
  if (window.lucide) window.lucide.createIcons();
})();
