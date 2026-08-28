const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");

const { server, setTripStore } = require("../server.js");
const { generateSlug, validateTripData } = require("../lib/trip-store");

function fakeTripStore() {
  const trips = new Map();
  return {
    trips,
    async createTrip(data) {
      validateTripData(data);
      const slug = generateSlug();
      trips.set(slug, data);
      return { slug };
    },
    async getTrip(slug) {
      return trips.get(slug) || null;
    },
    async sweepExpired() {
      return 0;
    },
    async ensureReady() {}
  };
}

let baseUrl;

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("trip endpoints report unavailable when no database is configured", async () => {
  setTripStore(null);
  const created = await fetch(`${baseUrl}/api/trips`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin: "San Diego" })
  });
  assert.equal(created.status, 503);

  const fetched = await fetch(`${baseUrl}/api/trips/${generateSlug()}`);
  assert.equal(fetched.status, 503);

  const config = await (await fetch(`${baseUrl}/api/config`)).json();
  assert.equal(config.tripSharing.enabled, false);
});

test("a shared trip round-trips through create and fetch", async () => {
  const store = fakeTripStore();
  setTripStore(store);

  const created = await fetch(`${baseUrl}/api/trips`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin: "San Diego", destination: "Yuma", pins: ["L123"] })
  });
  assert.equal(created.status, 201);
  const { slug, path } = await created.json();
  assert.match(slug, /^[A-Za-z0-9]{22}$/);
  assert.equal(path, `/t/${slug}`);

  const fetched = await fetch(`${baseUrl}/api/trips/${slug}`);
  assert.equal(fetched.status, 200);
  const payload = await fetched.json();
  assert.equal(payload.slug, slug);
  assert.deepEqual(payload.data, { origin: "San Diego", destination: "Yuma", pins: ["L123"] });

  const config = await (await fetch(`${baseUrl}/api/config`)).json();
  assert.equal(config.tripSharing.enabled, true);
});

test("invalid trip payloads are rejected", async () => {
  setTripStore(fakeTripStore());

  const notJson = await fetch(`${baseUrl}/api/trips`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "this is not json"
  });
  assert.equal(notJson.status, 400);

  const noOrigin = await fetch(`${baseUrl}/api/trips`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "route" })
  });
  assert.equal(noOrigin.status, 400);

  const wrongMethod = await fetch(`${baseUrl}/api/trips`);
  assert.equal(wrongMethod.status, 405);
});

test("unknown and malformed slugs both read as expired", async () => {
  setTripStore(fakeTripStore());
  const unknown = await fetch(`${baseUrl}/api/trips/${generateSlug()}`);
  assert.equal(unknown.status, 404);
  const malformed = await fetch(`${baseUrl}/api/trips/short`);
  assert.equal(malformed.status, 404);
});

async function createTripsUntilLimited(makeHeaders) {
  let lastStatus = 0;
  for (let i = 0; i < 31; i += 1) {
    const response = await fetch(`${baseUrl}/api/trips`, {
      method: "POST",
      headers: { "content-type": "application/json", ...makeHeaders(i) },
      body: JSON.stringify({ origin: "San Diego" })
    });
    lastStatus = response.status;
  }
  return lastStatus;
}

test("rate limiting ignores x-forwarded-for unless TRUST_PROXY is set", async () => {
  setTripStore(fakeTripStore());
  delete process.env.TRUST_PROXY;
  // Every request spoofs a different client IP, but without TRUST_PROXY the
  // limiter keys on the socket address, so the limit still trips.
  const lastStatus = await createTripsUntilLimited((i) => ({
    "x-forwarded-for": `198.51.100.${i}`
  }));
  assert.equal(lastStatus, 429);
});

test("with TRUST_PROXY, rate limiting keys on the proxy-appended address", async () => {
  setTripStore(fakeTripStore());
  process.env.TRUST_PROXY = "1";
  try {
    // The leftmost (client-controlled) entry varies per request; the limiter
    // must key on the last entry, which the trusted proxy appended.
    const lastStatus = await createTripsUntilLimited((i) => ({
      "x-forwarded-for": `10.0.0.${i}, 203.0.113.77`
    }));
    assert.equal(lastStatus, 429);
  } finally {
    delete process.env.TRUST_PROXY;
  }
});

test("shared trip pages serve the app shell", async () => {
  const response = await fetch(`${baseUrl}/t/${generateSlug()}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /<base href="\/">/);
  assert.match(html, /app\.js/);
});
