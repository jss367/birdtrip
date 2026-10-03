const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_TRIP_BYTES,
  SLUG_PATTERN,
  createTripStore,
  generateSlug,
  validateTripData
} = require("../lib/trip-store");

function trackingPool(onQuery) {
  const calls = [];
  const pool = {
    query: async (text, params) => {
      const call = { text: text.replace(/\s+/g, " ").trim(), params };
      calls.push(call);
      return onQuery ? onQuery(call, calls.length) : { rows: [], rowCount: 0 };
    }
  };
  return { pool, calls };
}

function storeWith(onQuery, options = {}) {
  const { pool, calls } = trackingPool(onQuery);
  const store = createTripStore({
    connectionString: "postgres://unused",
    createPool: () => pool,
    ...options
  });
  return { store, calls };
}

test("slugs are 22 unguessable base62 characters", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const slug = generateSlug();
    assert.match(slug, SLUG_PATTERN);
    seen.add(slug);
  }
  assert.equal(seen.size, 200);
});

test("trip data must be an object with an origin and a bounded size", () => {
  assert.throws(() => validateTripData(null), { status: 400 });
  assert.throws(() => validateTripData([1, 2]), { status: 400 });
  assert.throws(() => validateTripData({ mode: "route" }), { status: 400 });
  assert.throws(() => validateTripData({ origin: "   " }), { status: 400 });
  assert.throws(() => validateTripData({ origin: "x".repeat(201) }), { status: 400 });
  assert.throws(() => validateTripData({ origin: "San Diego", notes: "a\u0000b" }), { status: 400 });
  assert.throws(() => validateTripData({ origin: "San Diego", ["a\u0000"]: 1 }), { status: 400 });
  // Postgres JSONB rejects unpaired surrogates (e.g. an emoji cut in half).
  assert.throws(() => validateTripData({ origin: "Park \ud83d" }), { status: 400 });
  assert.throws(() => validateTripData({ origin: "Park \udc26 East" }), { status: 400 });
  assert.throws(() => validateTripData({ origin: "San Diego", ["a\ud83d"]: 1 }), { status: 400 });
  assert.equal(
    validateTripData({ origin: "\u{1F426} Park" }),
    JSON.stringify({ origin: "\u{1F426} Park" })
  );
  assert.throws(
    () => validateTripData({ origin: "San Diego", notes: "x".repeat(MAX_TRIP_BYTES) }),
    { status: 413 }
  );
  assert.equal(
    validateTripData({ origin: "San Diego", mode: "route" }),
    JSON.stringify({ origin: "San Diego", mode: "route" })
  );
});

test("createTrip prepares the schema once and inserts a serialized blob", async () => {
  const { store, calls } = storeWith();
  const first = await store.createTrip({ origin: "San Diego", destination: "Yuma" });
  const second = await store.createTrip({ origin: "San Diego", destination: "Blythe" });
  assert.match(first.slug, SLUG_PATTERN);
  assert.match(second.slug, SLUG_PATTERN);
  assert.notEqual(first.slug, second.slug);

  const schemaCalls = calls.filter((call) => call.text.startsWith("CREATE"));
  assert.equal(schemaCalls.length, 2);
  const inserts = calls.filter((call) => call.text.startsWith("INSERT INTO trips"));
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].params[0], first.slug);
  assert.equal(JSON.parse(inserts[0].params[1]).destination, "Yuma");
});

test("a failed schema setup is retried on the next call", async () => {
  let failures = 0;
  const { store, calls } = storeWith((call) => {
    if (call.text.startsWith("CREATE TABLE") && failures === 0) {
      failures += 1;
      throw new Error("connection refused");
    }
    return { rows: [], rowCount: 0 };
  });
  await assert.rejects(() => store.createTrip({ origin: "San Diego" }), /connection refused/);
  const { slug } = await store.createTrip({ origin: "San Diego" });
  assert.match(slug, SLUG_PATTERN);
  assert.equal(calls.filter((call) => call.text.startsWith("CREATE TABLE")).length, 2);
});

test("getTrip returns stored data and bumps last_opened_at without blocking", async () => {
  const slug = generateSlug();
  const { store, calls } = storeWith((call) => {
    if (call.text.startsWith("SELECT data")) {
      assert.equal(call.params[0], slug);
      return { rows: [{ data: { origin: "San Diego" } }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const data = await store.getTrip(slug);
  assert.deepEqual(data, { origin: "San Diego" });
  await new Promise((resolve) => setImmediate(resolve));
  const bumps = calls.filter((call) => call.text.startsWith("UPDATE trips SET last_opened_at"));
  assert.equal(bumps.length, 1);
  assert.equal(bumps[0].params[0], slug);
});

test("getTrip rejects malformed slugs without touching the database", async () => {
  const { store, calls } = storeWith();
  assert.equal(await store.getTrip("short"), null);
  assert.equal(await store.getTrip("not a slug at all!!"), null);
  assert.equal(await store.getTrip(""), null);
  assert.equal(await store.getTrip(generateSlug() + "extra"), null);
  assert.equal(calls.length, 0);
});

test("getTrip treats an unknown slug as missing", async () => {
  const { store } = storeWith();
  assert.equal(await store.getTrip(generateSlug()), null);
});

test("expiry sweeps delete stale trips and run at most once per hour", async () => {
  let currentTime = 10_000_000;
  const { store, calls } = storeWith(
    (call) => {
      if (call.text.startsWith("DELETE FROM trips")) {
        assert.match(call.text, /interval '90 days'/);
        return { rows: [], rowCount: 3 };
      }
      return { rows: [], rowCount: 0 };
    },
    { now: () => currentTime }
  );

  assert.equal(await store.sweepExpired(), 3);

  const deletesBefore = calls.filter((call) => call.text.startsWith("DELETE")).length;
  await store.createTrip({ origin: "San Diego" });
  await new Promise((resolve) => setImmediate(resolve));
  const afterFirstCreate = calls.filter((call) => call.text.startsWith("DELETE")).length;
  assert.equal(afterFirstCreate, deletesBefore + 1);

  currentTime += 10 * 60 * 1000;
  await store.createTrip({ origin: "San Diego" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.filter((call) => call.text.startsWith("DELETE")).length, afterFirstCreate);

  currentTime += 60 * 60 * 1000;
  await store.createTrip({ origin: "San Diego" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.filter((call) => call.text.startsWith("DELETE")).length, afterFirstCreate + 1);
});

test("close ends the pool once and is a no-op for a store that never connected", async () => {
  let ended = 0;
  const pool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    end: async () => {
      ended += 1;
    }
  };
  const idle = createTripStore({ connectionString: "postgres://unused", createPool: () => pool });
  await idle.close();
  assert.equal(ended, 0);

  const store = createTripStore({ connectionString: "postgres://unused", createPool: () => pool });
  await store.ensureReady();
  await store.close();
  await store.close();
  assert.equal(ended, 1);
});


test("close during schema setup never recreates a pool", async () => {
  let finishQuery;
  let created = 0;
  let ended = 0;
  const store = createTripStore({ createPool: () => {
    created += 1;
    return {
      query: () => new Promise((resolve) => { finishQuery = resolve; }),
      end: async () => { ended += 1; }
    };
  } });
  const ready = store.ensureReady();
  await store.close();
  finishQuery({ rows: [] });
  await assert.rejects(ready, /Trip store is closed/);
  await assert.rejects(store.sweepExpired(), /Trip store is closed/);
  assert.equal(created, 1);
  assert.equal(ended, 1);
});

test("close bounds a checked-out database query with its drain deadline", async () => {
  const { EventEmitter } = require("node:events");
  const pool = new EventEmitter();
  let finishEnd;
  let canceled = 0;
  pool.query = async () => ({ rows: [] });
  pool.end = () => new Promise((resolve) => { finishEnd = resolve; });
  const store = createTripStore({ createPool: () => pool });
  await store.ensureReady();
  pool.emit("connect", { end: async () => { canceled += 1; finishEnd(); } });
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await store.close({ forceAfterMs: 20 });
    assert.equal(canceled, 1);
    await store.close();
    assert.equal(canceled, 1);
  } finally { clearTimeout(keepAlive); }
});
