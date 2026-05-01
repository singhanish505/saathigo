const express = require('express');
const Joi = require('joi');
const { mem, geoRadius } = require('../services/stores');
const { ApiError } = require('../middleware/error');

const router = express.Router();

// GET /drivers/nearby?city=BLR&lat=12.97&lng=77.59&filter=ev|sakhi|pool|all&radius=5
router.get('/nearby', async (req, res) => {
  const schema = Joi.object({
    city: Joi.string().required(),
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    filter: Joi.string().valid('all','ev','sakhi','pool').default('all'),
    radius: Joi.number().min(0.5).max(15).default(5),
    limit: Joi.number().min(1).max(50).default(20),
  });
  const { error, value } = schema.validate(req.query);
  if (error) throw new ApiError(400, 'invalid_input', error.message);

  const candidates = await geoRadius(value.city, value.lat, value.lng, value.radius, value.limit * 3);
  const results = [];
  for (const c of candidates) {
    const driver = mem.drivers.get(c.id);
    if (!driver || !driver.online) continue;
    if (value.filter === 'ev' && !driver.ev) continue;
    if (value.filter === 'sakhi' && !driver.sakhiVerified) continue;
    if (value.filter === 'pool' && Math.random() < 0.5) continue; // pool eligibility (mock)
    results.push({
      id: driver.id,
      name: driver.name,
      rating: driver.rating,
      trips: driver.trips,
      ev: driver.ev,
      sakhi: driver.sakhiVerified,
      coop: driver.coopMember,
      vehicle: driver.vehicle,
      lat: c.lat,
      lng: c.lng,
      distanceKm: Math.round(c.distance * 100) / 100,
      etaMin: Math.max(2, Math.round(c.distance / 0.4)), // rough 24 km/h average
    });
    if (results.length >= value.limit) break;
  }
  res.json({ count: results.length, drivers: results });
});

router.get('/:id', (req, res) => {
  const driver = mem.drivers.get(req.params.id);
  if (!driver) throw new ApiError(404, 'not_found', 'Driver not found');
  // Drop equity-internal fields from public driver view
  const { equityPoints, ...publicView } = driver;
  res.json({ driver: publicView });
});

module.exports = router;
