// Sakhi Shield - women's safety endpoints.
// SOS escalation, route-deviation registration, family-tracker subscription.
const express = require('express');
const Joi = require('joi');
const { v4: uuid } = require('uuid');
const { mem, haversine } = require('../services/stores');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/error');
const logger = require('../services/logger');

const router = express.Router();

// In-memory SOS log. In prod, this writes to incident-svc + escalates to police via Dial 112 integration.
const sosLog = [];

router.post('/sos', requireAuth, (req, res) => {
  const schema = Joi.object({
    rideId: Joi.string().required(),
    lat: Joi.number().required(),
    lng: Joi.number().required(),
    severity: Joi.string().valid('panic','suspicious','medical').default('panic'),
    audioConsent: Joi.boolean().default(false),
  });
  const { error, value } = schema.validate(req.body);
  if (error) throw new ApiError(400, 'invalid_input', error.message);

  const ride = mem.trips.get(value.rideId);
  if (!ride || ride.riderId !== req.user.sub) throw new ApiError(404, 'not_found', 'Ride not found');

  const incident = {
    id: 'sos_' + uuid().split('-')[0],
    rideId: value.rideId,
    riderId: req.user.sub,
    driverId: ride.driverId,
    severity: value.severity,
    location: { lat: value.lat, lng: value.lng },
    cityCode: ride.cityCode,
    audioConsent: value.audioConsent,
    raisedAt: new Date().toISOString(),
    escalations: [
      { channel: 'family',  at: new Date().toISOString() },
      { channel: 'opsCentre', at: new Date().toISOString() },
      { channel: 'police_dial112', at: new Date().toISOString(), status: 'mock_dispatched' },
    ],
    state: 'OPEN',
  };
  sosLog.push(incident);
  ride.timeline.push({ status: 'SOS_RAISED', at: new Date().toISOString(), severity: value.severity });

  // In prod: push to family-tracker WebSocket channel + alert opsCentre + escalate to local police.
  logger.warn({ incidentId: incident.id, rideId: ride.id, severity: value.severity }, 'SOS RAISED');

  res.status(201).json({ incident, message: 'SOS escalated to family + ops centre + police (mock).' });
});

// POST /sakhi/route-deviation -> server-side check using planned route polyline (mock)
router.post('/route-deviation/:rideId', requireAuth, (req, res) => {
  const schema = Joi.object({
    currentLat: Joi.number().required(),
    currentLng: Joi.number().required(),
    plannedLat: Joi.number().required(),
    plannedLng: Joi.number().required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) throw new ApiError(400, 'invalid_input', error.message);
  const distanceMeters = haversine(value.currentLat, value.currentLng, value.plannedLat, value.plannedLng) * 1000;
  const threshold = parseInt(process.env.ROUTE_DEVIATION_METERS || '250', 10);
  const deviated = distanceMeters > threshold;
  if (deviated) {
    const ride = mem.trips.get(req.params.rideId);
    if (ride) ride.timeline.push({ status: 'ROUTE_DEVIATION', at: new Date().toISOString(), meters: Math.round(distanceMeters) });
  }
  res.json({ deviated, distanceMeters: Math.round(distanceMeters), threshold });
});

// GET /sakhi/incidents -> ops centre view (admin only in real life, demo open here)
router.get('/incidents', (_req, res) => {
  res.json({ incidents: sosLog.slice(-100).reverse() });
});

// POST /sakhi/family-link -> generate a shareable family-tracker link
router.post('/family-link', requireAuth, (req, res) => {
  const ride = mem.trips.get(req.body.rideId);
  if (!ride || ride.riderId !== req.user.sub) throw new ApiError(404, 'not_found', 'Ride not found');
  // Token expires when ride ends + 30 min buffer. In prod use signed URL with HMAC.
  const familyToken = uuid().replace(/-/g, '').slice(0, 24);
  ride.familyToken = familyToken;
  res.json({
    url: `${req.protocol}://${req.get('host')}/track/${ride.id}?t=${familyToken}`,
    expiresIn: 'until ride ends + 30m',
  });
});

module.exports = router;
