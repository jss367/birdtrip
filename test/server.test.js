const test = require("node:test");
const assert = require("node:assert/strict");

const {
  acquireSeasonalityBuildSlot,
  buildSeasonality,
  clientAddress,
  consumeRateLimit,
  fetchJson,
  nearestHotspotRegion,
  pruneResponseCache,
  pruneSeasonalityCache
} = require("../server.js");

test("seasonality build gate limits global build concurrency", async () => {
  const firstRelease = await acquireSeasonalityBuildSlot();
  const secondRelease = await acquireSeasonalityBuildSlot();
  let thirdStarted = false;
  const third = acquireSeasonalityBuildSlot().then((release) => {
    thirdStarted = true;
    return release;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(thirdStarted, false);
  firstRelease();
  const thirdRelease = await third;
  assert.equal(thirdStarted, true);
  secondRelease();
  thirdRelease();
});

test("seasonality uses the nearest hotspot region instead of the modal region", () => {
  const hotspots = [
    { lat: 32.001, lng: -117, subnational2Code: "US-CA-073" },
    { lat: 32.08, lng: -117, subnational2Code: "US-CA-065" },
    { lat: 32.09, lng: -117, subnational2Code: "US-CA-065" },
    { lat: 32.1, lng: -117, subnational2Code: "US-CA-065" }
  ];

  assert.equal(nearestHotspotRegion(hotspots, 32, -117), "US-CA-073");
});

test("nearest hotspot falls back to its most specific available region", () => {
  const hotspots = [
    { lat: "invalid", lng: -117, subnational2Code: "US-CA-999" },
    { lat: 32.01, lng: -117, subnational1Code: "US-CA", countryCode: "US" },
    { lat: 32.02, lng: -117, countryCode: "US" }
  ];

  assert.equal(nearestHotspotRegion(hotspots, 32, -117), "US-CA");
});

test("seasonality cache pruning expires old entries and enforces a size bound", () => {
  const now = Date.UTC(2026, 7, 24);
  const day = 24 * 60 * 60 * 1000;
  const cache = new Map([
    ["expired", { time: now - day - 1, value: {} }],
    ["fresh", { time: now, value: {} }]
  ]);
  for (let index = 0; index < 105; index += 1) {
    cache.set(`region-${index}`, { time: now, value: {} });
  }

  pruneSeasonalityCache(cache, now);

  assert.equal(cache.has("expired"), false);
  assert.equal(cache.has("fresh"), false);
  assert.equal(cache.size, 100);
  assert.equal(cache.has("region-104"), true);
});

test("cache-disabled upstream requests do not retain raw responses", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      text: async () => JSON.stringify([{ speciesCode: "test" }])
    };
  };

  try {
    const url = "https://example.test/historic/2025/1/5";
    await fetchJson(url, {}, { cache: false });
    await fetchJson(url, {}, { cache: false });
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("concurrent cacheable upstream requests share one fetch and cache null responses", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setImmediate(resolve));
    return {
      ok: true,
      text: async () => "null"
    };
  };

  try {
    const url = `https://example.test/coalesced-${Date.now()}`;
    const [first, second] = await Promise.all([fetchJson(url), fetchJson(url)]);
    const third = await fetchJson(url);
    assert.equal(first, null);
    assert.equal(second, null);
    assert.equal(third, null);
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("cache admission rejects transient application errors and retains later success", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      text: async () => JSON.stringify(calls === 1
        ? { status: "OVER_QUERY_LIMIT" }
        : { status: "OK", results: [] })
    };
  };

  try {
    const url = `https://example.test/cache-admission-${Date.now()}`;
    const options = { cacheIf: (body) => body.status === "OK" };
    assert.equal((await fetchJson(url, {}, options)).status, "OVER_QUERY_LIMIT");
    assert.equal((await fetchJson(url, {}, options)).status, "OK");
    assert.equal((await fetchJson(url, {}, options)).status, "OK");
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("concurrent callers with different timeout policies use separate fetches", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls += 1;
    if (options.signal) {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    return {
      ok: true,
      text: async () => "[]"
    };
  };

  try {
    const url = `https://example.test/timeout-policy-${Date.now()}`;
    const [unbounded, bounded] = await Promise.allSettled([
      fetchJson(url),
      fetchJson(url, {}, { timeoutMs: 5 })
    ]);
    assert.equal(unbounded.status, "fulfilled");
    assert.equal(bounded.status, "rejected");
    assert.equal(bounded.reason.status, 504);
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("response cache pruning removes expired and least-recent entries", () => {
  const cache = new Map([
    ["expired", { expiresAt: 999, value: 1 }],
    ["oldest", { expiresAt: 2000, value: 2 }],
    ["newest", { expiresAt: 2000, value: 3 }]
  ]);

  pruneResponseCache(cache, 1000, 1);

  assert.deepEqual([...cache.keys()], ["newest"]);
});

test("rate limiter rejects excess requests and resets after its window", () => {
  const buckets = new Map();
  const options = { buckets, max: 2, windowMs: 1000, now: 5000 };

  assert.deepEqual(consumeRateLimit("client", options), {
    allowed: true,
    limit: 2,
    remaining: 1,
    resetAt: 6000,
    retryAfterSeconds: 1
  });
  assert.equal(consumeRateLimit("client", options).allowed, true);
  assert.equal(consumeRateLimit("client", options).allowed, false);

  const reset = consumeRateLimit("client", { ...options, now: 6000 });
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 1);
});

test("trusted proxy hop count selects the client before the known proxy chain", () => {
  const req = {
    headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.20" },
    socket: { remoteAddress: "192.0.2.30" }
  };

  assert.equal(clientAddress(req, { trustProxy: false }), "192.0.2.30");
  assert.equal(clientAddress(req, { trustProxy: true, trustedHops: 1 }), "198.51.100.20");
  assert.equal(clientAddress(req, { trustProxy: true, trustedHops: 2 }), "203.0.113.10");
});

test("rate limiter rejects new clients instead of evicting active buckets at capacity", () => {
  const buckets = new Map();
  const options = { buckets, max: 2, windowMs: 1000, maxClients: 2, now: 5000 };

  assert.equal(consumeRateLimit("first", options).allowed, true);
  assert.equal(consumeRateLimit("second", options).allowed, true);
  assert.equal(consumeRateLimit("overflow", options).allowed, false);
  assert.equal(buckets.has("overflow"), false);
  assert.equal(consumeRateLimit("first", options).allowed, true);
  assert.equal(consumeRateLimit("first", options).allowed, false);

  assert.equal(consumeRateLimit("overflow", { ...options, now: 6000 }).allowed, true);
  assert.equal(buckets.has("overflow"), true);
});

test("concurrent cold seasonality requests share one upstream build", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setImmediate(resolve));
    return {
      ok: true,
      text: async () => "[]"
    };
  };

  try {
    const region = `TEST-${Date.now()}`;
    const [first, second] = await Promise.all([
      buildSeasonality(region, "token-a"),
      buildSeasonality(region, "token-b")
    ]);
    assert.equal(calls, 36);
    assert.strictEqual(first, second);
  } finally {
    global.fetch = originalFetch;
  }
});
