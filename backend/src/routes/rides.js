// Booking + matching + pricing.
const express = require('express');
const Joi = require('joi');
const { v4: uuid } = require('uuid');
const { mem } = require('../services/stores');
const pricing = require('../services/pricing');
const matching = require('../services/matching');
const { ApiError } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const point = Joi.object({ lat: Joi.number().required(), lng: Joi.number().required(), label: Joi.string().optional() });

// POST /rides/estimate
router.post('/estimate', (req, res) => {
  const schema = Joi.object({
    pickup: point.required(),
    drop: point.required(),
    cityCode: Joi.string().required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) throw new ApiError(400, 'invalid_input', error.message);
  const quotes = pricing.multiQuote(value);
  const surge = pricing.computeSurge(value.cityCode);
  res.json({ surge: Math.round(surge * 100) / 100, quotes });
});

// POST /rides/book
router.post('/book', requireAuth, async (req, res) => {
  const schema = Joi.object({
    cityCode: Joi.string().required(),
    pickup: point.required(),
    drop: point.required(),
    rideType: Joi.string().valid('STD','EV','SAKHI','POOL','ONEJOURNEY').required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) throw new ApiError(400, 'invalid_input', error.message);

  const matched = await matching.match({ city: value.cityCode, pickup: value.pickup, rideType: value.rideType });
  if (!matched) throw new ApiError(503, 'no_drivers', 'No drivers available right now. Try again or change ride type.');

  const fare = pricing.estimate({
    pickup: value.pickup, drop: value.drop, rideType: value.rideType, cityCode: value.cityCode,
  });

  const ride = {
    id: 'rid_' + uuid().split('-')[0],
    riderId: req.user.sub,
    driverId: matched.driver.id,
    cityCode: value.cityCode,
    rideType: value.rideType,
    pickup: value.pickup,
    drop: value.drop,
    status: 'ACCEPTED',
    fare,
    fareLocked: true,
    sakhi: value.rideType === 'SAKHI',
    matchedAt: new Date().toISOString(),
    etaMin: matched.etaMin,
    distanceToPickupKm: matched.distanceKm,
    timeline: [
      { status: 'REQUESTED', at: new Date().toISOString() },
      { status: 'ACCEPTED', at: new Date().toISOString() },
    ],
  };
  mem.trips.set(ride.id, ride);

  // Award streak + CO2
  const user = mem.users.get(req.user.sub);
  if (user) {
    user.khushiStreak = (user.khushiStreak || 0) + 1;
    if (user.khushiStreak % 10 === 0) ride.freeRideEarned = true;
    user.co2SavedKg = (user.co2SavedKg || 0) + (fare.co2SavedGrams || 0) / 1000;
  }

  res.status(201).json({ ride, driver: matched.driver, freeRideEarned: !!ride.freeRideEarned });
});

router.get('/:id', requireAuth, (req, res) => {
  const ride = mem.trips.get(req.params.id);
  if (!ride) throw new ApiError(404, 'not_found', 'Ride not found');
  if (ride.riderId !== req.user.sub) throw new ApiError(403, 'forbidden', 'Not your ride');
  const driver = mem.drivers.get(ride.driverId);
  res.json({ ride, driver });
});

// PATCH /rides/:id/status -> simulate driver progression (start, end, cancel)
router.patch('/:id/status', requireAuth, (req, res) => {
  const ride = mem.trips.get(req.params.id);
  if (!ride) throw new ApiError(404, 'not_found', 'Ride not found');
  if (ride.riderId !== req.user.sub) throw new ApiError(403, 'forbidden', 'Not your ride');
  const allowed = ['STARTED','ENDED','CANCELLED'];
  if (!allowed.includes(req.body.status)) throw new ApiError(400, 'invalid_input', 'Bad status');
  ride.status = req.body.status;
  ride.timeline.push({ status: req.body.status, at: new Date().toISOString() });
  res.json({ ride });
});

// GET /rides -> rider's recent
router.get('/', requireAuth, (req, res) => {
  const all = [...mem.trips.values()]
    .filter((r) => r.riderId === req.user.sub)
    .sort((a, b) => b.matchedAt.localeCompare(a.matchedAt))
    .slice(0, 20);
  res.json({ rides: all });
});

module.exports = router;
