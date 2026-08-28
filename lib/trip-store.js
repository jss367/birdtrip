const crypto = require("crypto");

// Shared trips are opaque JSON blobs keyed by an unguessable slug; the slug
// itself is the only authorization. 22 base62 characters is ~130 bits.
const SLUG_LENGTH = 22;
const SLUG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_PATTERN = /^[A-Za-z0-9]{22}$/;
const MAX_TRIP_BYTES = 100 * 1024;
const MAX_ORIGIN_LENGTH = 200;
const TRIP_TTL_DAYS = 90;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

function generateSlug() {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i += 1) {
    slug += SLUG_ALPHABET[crypto.randomInt(SLUG_ALPHABET.length)];
  }
  return slug;
}

function tripStoreError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// The server treats trip data as an opaque blob the client owns, so
// validation stops at "is a plausible trip and not abuse-sized".
function validateTripData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw tripStoreError(400, "Trip data must be a JSON object");
  }
  if (typeof data.origin !== "string" || !data.origin.trim()) {
    throw tripStoreError(400, "Trip data must include an origin");
  }
  if (data.origin.length > MAX_ORIGIN_LENGTH) {
    throw tripStoreError(400, "Trip origin is too long");
  }
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > MAX_TRIP_BYTES) {
    throw tripStoreError(413, "Trip data is too large to share");
  }
  return serialized;
}

function defaultCreatePool(connectionString) {
  const { Pool } = require("pg");
  return new Pool({ connectionString, max: 3 });
}

function createTripStore({ connectionString, createPool = defaultCreatePool, now = Date.now } = {}) {
  let pool = null;
  let readyPromise = null;
  let lastSweepAt = 0;

  function getPool() {
    if (!pool) pool = createPool(connectionString);
    return pool;
  }

  function ensureReady() {
    if (!readyPromise) {
      readyPromise = (async () => {
        await getPool().query(`
          CREATE TABLE IF NOT EXISTS trips (
            slug           TEXT PRIMARY KEY,
            data           JSONB NOT NULL,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await getPool().query(
          "CREATE INDEX IF NOT EXISTS trips_expiry_idx ON trips (last_opened_at)"
        );
      })().catch((error) => {
        // Allow a later request to retry setup instead of caching the failure.
        readyPromise = null;
        throw error;
      });
    }
    return readyPromise;
  }

  async function sweepExpired() {
    await ensureReady();
    const result = await getPool().query(
      `DELETE FROM trips WHERE last_opened_at < now() - interval '${TRIP_TTL_DAYS} days'`
    );
    return result.rowCount || 0;
  }

  // There is no cron in this deployment, so expiry rides along with writes:
  // at most one sweep per hour, and never blocking the request that runs it.
  function sweepIfDue() {
    const at = now();
    if (at - lastSweepAt < SWEEP_INTERVAL_MS) return;
    lastSweepAt = at;
    sweepExpired().catch((error) => {
      console.error(`[trips] expiry sweep failed: ${error.message}`);
    });
  }

  async function createTrip(data) {
    const serialized = validateTripData(data);
    await ensureReady();
    const slug = generateSlug();
    await getPool().query(
      "INSERT INTO trips (slug, data) VALUES ($1, $2::jsonb)",
      [slug, serialized]
    );
    sweepIfDue();
    return { slug };
  }

  async function getTrip(slug) {
    if (!SLUG_PATTERN.test(String(slug || ""))) return null;
    await ensureReady();
    const result = await getPool().query(
      `SELECT data FROM trips
       WHERE slug = $1 AND last_opened_at >= now() - interval '${TRIP_TTL_DAYS} days'`,
      [slug]
    );
    const row = result.rows?.[0];
    if (!row) return null;
    getPool()
      .query("UPDATE trips SET last_opened_at = now() WHERE slug = $1", [slug])
      .catch((error) => {
        console.error(`[trips] last-opened bump failed: ${error.message}`);
      });
    return row.data;
  }

  return { ensureReady, createTrip, getTrip, sweepExpired };
}

module.exports = {
  MAX_TRIP_BYTES,
  SLUG_PATTERN,
  TRIP_TTL_DAYS,
  createTripStore,
  generateSlug,
  validateTripData
};
