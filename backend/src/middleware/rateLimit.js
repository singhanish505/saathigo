// Rate limiter. In dev: in-memory. In prod: Redis-backed (rate-limit-redis).
const rateLimitLib = require('express-rate-limit');
const { getRedis, isMock } = require('../services/stores');

let limiter = null;
function buildLimiter() {
  const opts = {
    windowMs: 60 * 1000,
    max: 600,           // per IP per minute
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/healthz'),
  };
  if (!isMock() && getRedis()) {
    const RedisStore = require('rate-limit-redis');
    opts.store = new RedisStore.default({ sendCommand: (...args) => getRedis().call(...args) });
  }
  return rateLimitLib(opts);
}

function rateLimit(req, res, next) {
  if (!limiter) limiter = buildLimiter();
  return limiter(req, res, next);
}

module.exports = { rateLimit };
