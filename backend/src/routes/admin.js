// Admin / ops endpoints. Behind a hard-coded admin key in dev. In prod: SSO + RBAC.
const express = require('express');
const { mem } = require('../services/stores');
const { ApiError } = require('../middleware/error');

const router = express.Router();

router.use((req, _res, next) => {
  if (req.headers['x-admin-key'] !== (process.env.ADMIN_KEY || 'dev-admin-key')) {
    return next(new ApiError(403, 'forbidden', 'Bad admin key'));
  }
  next();
});

router.get('/stats', (_req, res) => {
  const drivers = [...mem.drivers.values()];
  const onlineByCity = {};
  for (const d of drivers) {
    if (!onlineByCity[d.city]) onlineByCity[d.city] = { total: 0, online: 0, ev: 0, sakhi: 0 };
    onlineByCity[d.city].total++;
    if (d.online) onlineByCity[d.city].online++;
    if (d.ev) onlineByCity[d.city].ev++;
    if (d.sakhiVerified) onlineByCity[d.city].sakhi++;
  }
  res.json({
    users: mem.users.size,
    drivers: drivers.length,
    rides: mem.trips.size,
    onlineByCity,
  });
});

module.exports = router;
