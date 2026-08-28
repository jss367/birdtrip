const test = require("node:test");
const assert = require("node:assert/strict");

require("../public/navigation-export.js");

const navigationExport = globalThis.BirdtripNavigationExport;

test("Google Maps route preserves ordered stops as driving waypoints", () => {
  const url = new URL(navigationExport.buildGoogleMapsUrl([
    { lat: 32.6927, lng: -114.6277, name: "Yuma" },
    { lat: 33.1, lng: -113.2, name: "Birding stop" },
    { lat: 33.4484, lng: -112.074, name: "Phoenix" }
  ]));

  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.pathname, "/maps/dir/");
  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(url.searchParams.get("travelmode"), "driving");
  assert.equal(url.searchParams.get("dir_action"), "navigate");
  assert.equal(url.searchParams.get("origin"), "32.6927,-114.6277");
  assert.equal(url.searchParams.get("destination"), "33.4484,-112.074");
  assert.equal(url.searchParams.get("waypoints"), "33.1,-113.2");
});

test("GPX export includes named route points, escaped XML, and route geometry", () => {
  const gpx = navigationExport.buildGpxDocument({
    name: "Yuma & Phoenix",
    generatedAt: new Date("2026-08-28T12:00:00.000Z"),
    points: [
      { lat: 32.6927, lng: -114.6277, name: "Start <Yuma>", type: "Start" },
      { lat: 33.1, lng: -113.2, name: "Stop 1: Birds & Water", type: "Birding stop" },
      { lat: 33.4484, lng: -112.074, name: "Phoenix", type: "Destination" }
    ],
    trackPoints: [[-114.6277, 32.6927], [-113.2, 33.1], [-112.074, 33.4484]]
  });

  assert.match(gpx, /<gpx version="1\.1" creator="Birdtrip"/);
  assert.match(gpx, /<name>Yuma &amp; Phoenix<\/name>/);
  assert.match(gpx, /<time>2026-08-28T12:00:00\.000Z<\/time>/);
  assert.match(gpx, /<wpt lat="33\.1" lon="-113\.2">/);
  assert.match(gpx, /<name>Start &lt;Yuma&gt;<\/name>/);
  assert.match(gpx, /<name>Stop 1: Birds &amp; Water<\/name>/);
  assert.match(gpx, /<rtept lat="33\.4484" lon="-112\.074">/);
  assert.match(gpx, /<trkpt lat="33\.1" lon="-113\.2"><\/trkpt>/);
});
