(function exposeBirdtripNavigationExport(root) {
  "use strict";

  function validPoint(point) {
    return Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));
  }

  function normalizePoints(points) {
    return (Array.isArray(points) ? points : [])
      .filter(validPoint)
      .map((point, index) => ({
        lat: Number(point.lat),
        lng: Number(point.lng),
        name: String(point.name || `Point ${index + 1}`),
        type: String(point.type || "Waypoint")
      }));
  }

  function buildGoogleMapsUrl(points) {
    const routePoints = normalizePoints(points);
    if (!routePoints.length) return "";

    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("travelmode", "driving");
    url.searchParams.set("dir_action", "navigate");

    if (routePoints.length === 1) {
      url.searchParams.set("destination", coordinate(routePoints[0]));
      return url.toString();
    }

    url.searchParams.set("origin", coordinate(routePoints[0]));
    url.searchParams.set("destination", coordinate(routePoints.at(-1)));
    const waypoints = routePoints.slice(1, -1);
    if (waypoints.length) {
      url.searchParams.set("waypoints", waypoints.map(coordinate).join("|"));
    }
    return url.toString();
  }

  function buildGpxDocument(options = {}) {
    const routePoints = normalizePoints(options.points);
    if (!routePoints.length) return "";
    const trackPoints = normalizeTrackPoints(options.trackPoints);
    const name = String(options.name || "Birdtrip route");
    const generatedAt = options.generatedAt instanceof Date
      ? options.generatedAt
      : new Date(options.generatedAt || Date.now());
    const time = Number.isNaN(generatedAt.getTime()) ? new Date().toISOString() : generatedAt.toISOString();
    const waypointXml = routePoints.map((point) => `  <wpt lat="${point.lat}" lon="${point.lng}">\n    <name>${escapeXml(point.name)}</name>\n    <type>${escapeXml(point.type)}</type>\n  </wpt>`).join("\n");
    const routePointXml = routePoints.map((point) => `    <rtept lat="${point.lat}" lon="${point.lng}">\n      <name>${escapeXml(point.name)}</name>\n      <type>${escapeXml(point.type)}</type>\n    </rtept>`).join("\n");
    const trackXml = trackPoints.length > 1
      ? `\n  <trk>\n    <name>${escapeXml(name)}</name>\n    <trkseg>\n${trackPoints.map((point) => `      <trkpt lat="${point.lat}" lon="${point.lng}"></trkpt>`).join("\n")}\n    </trkseg>\n  </trk>`
      : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Birdtrip" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${time}</time>
  </metadata>
${waypointXml}
  <rte>
    <name>${escapeXml(name)}</name>
${routePointXml}
  </rte>${trackXml}
</gpx>
`;
  }

  function normalizeTrackPoints(points) {
    return (Array.isArray(points) ? points : []).flatMap((point) => {
      const lat = Array.isArray(point) ? Number(point[1]) : Number(point?.lat);
      const lng = Array.isArray(point) ? Number(point[0]) : Number(point?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
    });
  }

  function coordinate(point) {
    return `${point.lat},${point.lng}`;
  }

  function escapeXml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  root.BirdtripNavigationExport = Object.freeze({
    buildGoogleMapsUrl,
    buildGpxDocument
  });
}(globalThis));
