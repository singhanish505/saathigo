// Single point of init for Redis + Postgres + in-memory fallback.
// MOCK_MODE=true => use in-memory only (great for `npm start` without Docker).
const Redis = require('ioredis');
const { Pool } = require('pg');
const logger = require('./logger');

const MOCK = process.env.MOCK_MODE === 'true';

let redis;
let pg;

// In-memory fallbacks (used in MOCK mode and as L1 cache otherwise).
const mem = {
  users: new Map(),
  drivers: new Map(),
  trips: new Map(),
  geo: new Map(), // city -> Map(driverId, {lat,lng,t})
  otps: new Map(),
};

async function initStores() {
  if (MOCK) {
    logger.warn('MOCK_MODE=true - using in-memory stores. Do not use in prod.');
    require('../data/seed').seed(mem);
    return;
  }

  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3, enableOfflineQueue: false,
  });
  redis.on('error', (e) => logger.error(e, 'Redis error'));

  pg = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  pg.on('error', (e) => logger.error(e, 'Postgres pool error'));

  // Seed in case the DB is empty
  require('../data/seed').seed(mem);
  logger.info('Stores initialised (Redis + Postgres + L1 mem)');
}

async function healthCheck() {
  if (MOCK) return { healthy: true, mode: 'mock', ts: Date.now() };
  try {
    await Promise.all([redis.ping(), pg.query('SELECT 1')]);
    return { healthy: true, mode: 'live', ts: Date.now() };
  } catch (e) {
    return { healthy: false, error: e.message };
  }
}

// ----- Redis Geo helpers (real) + in-mem fallback -----
async function geoAdd(city, driverId, lat, lng) {
  if (MOCK || !redis) {
    if (!mem.geo.has(city)) mem.geo.set(city, new Map());
    mem.geo.get(city).set(driverId, { lat, lng, t: Date.now() });
    return;
  }
  await redis.geoadd(`drivers:geo:${city}`, lng, lat, driverId);
  await redis.set(`drivers:lastseen:${driverId}`, Date.now(), 'EX', 600);
}

async function geoRadius(city, lat, lng, radiusKm = 5, count = 10) {
  if (MOCK || !redis) {
    const drivers = mem.geo.get(city);
    if (!drivers) return [];
    const results = [];
    for (const [id, pos] of drivers.entries()) {
      const d = haversine(lat, lng, pos.lat, pos.lng);
      if (d <= radiusKm) results.push({ id, distance: d, lat: pos.lat, lng: pos.lng });
    }
    return results.sort((a, b) => a.distance - b.distance).slice(0, count);
  }
  const raw = await redis.georadius(
    `drivers:geo:${city}`, lng, lat, radiusKm, 'km', 'WITHCOORD', 'WITHDIST', 'COUNT', count, 'ASC'
  );
  return raw.map(([id, distance, [lng, lat]]) => ({
    id, distance: parseFloat(distance), lat: parseFloat(lat), lng: parseFloat(lng),
  }));
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = {
  initStores,
  healthCheck,
  mem,
  geoAdd,
  geoRadius,
  haversine,
  getRedis: () => redis,
  getPg: () => pg,
  isMock: () => MOCK,
};
