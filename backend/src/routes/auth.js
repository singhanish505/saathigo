// OTP auth (mock OTP shown in dev). Real impl would integrate Karix/Twilio + DigiLocker for KYC.
const express = require('express');
const Joi = require('joi');
const { v4: uuid } = require('uuid');
const { mem } = require('../services/stores');
const { signToken, requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/error');

const router = express.Router();

const phoneSchema = Joi.object({ phone: Joi.string().pattern(/^\+?91?[6-9]\d{9}$/).required() });
const otpSchema = Joi.object({
  phone: Joi.string().required(),
  otp: Joi.string().length(6).required(),
  name: Joi.string().min(1).max(60).optional(),
});

// POST /auth/request-otp -> sends OTP (mocked)
router.post('/request-otp', (req, res) => {
  const { error, value } = phoneSchema.validate(req.body);
  if (error) throw new ApiError(400, 'invalid_input', error.message);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  mem.otps.set(value.phone, { otp, exp: Date.now() + 5 * 60_000 });
  // In prod we'd send via Karix/Twilio. For demo we return it (DEV ONLY).
  res.json({ ok: true, dev_otp: otp, phone: value.phone, expiresIn: 300 });
});

// POST /auth/verify-otp -> returns JWT
router.post('/verify-otp', (req, res) => {
  const { error, value } = otpSchema.validate(req.body);
  if (error) throw new ApiError(400, 'invalid_input', error.message);
  const stored = mem.otps.get(value.phone);
  if (!stored || stored.exp < Date.now()) throw new ApiError(401, 'otp_expired', 'OTP expired or not requested');
  if (stored.otp !== value.otp) throw new ApiError(401, 'otp_mismatch', 'OTP does not match');

  let user = [...mem.users.values()].find((u) => u.phone === value.phone);
  if (!user) {
    user = {
      id: 'usr_' + uuid().split('-')[0],
      phone: value.phone,
      name: value.name || 'Saathi',
      kycStatus: 'pending',
      sakhiOptIn: false,
      khushiStreak: 0,
      co2SavedKg: 0,
      familyContacts: [],
      createdAt: new Date().toISOString(),
    };
    mem.users.set(user.id, user);
  }
  mem.otps.delete(value.phone);
  const token = signToken({ sub: user.id, phone: user.phone });
  res.json({ ok: true, token, user });
});

router.get('/me', requireAuth, (req, res) => {
  const user = mem.users.get(req.user.sub);
  if (!user) throw new ApiError(404, 'not_found', 'User not found');
  res.json({ user });
});

// PATCH /auth/me -> update profile (sakhiOptIn, family contacts, name)
router.patch('/me', requireAuth, (req, res) => {
  const user = mem.users.get(req.user.sub);
  if (!user) throw new ApiError(404, 'not_found', 'User not found');
  const { sakhiOptIn, name, familyContacts } = req.body;
  if (sakhiOptIn !== undefined) user.sakhiOptIn = !!sakhiOptIn;
  if (name) user.name = String(name).slice(0, 60);
  if (Array.isArray(familyContacts)) {
    user.familyContacts = familyContacts.slice(0, 5).map((c) => ({
      name: String(c.name || '').slice(0, 60),
      phone: String(c.phone || '').slice(0, 16),
    }));
  }
  res.json({ user });
});

// POST /auth/driver/register -> driver KYC stub
router.post('/driver/register', (req, res) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    aadhaarLast4: Joi.string().length(4).required(),
    licenceNumber: Joi.string().required(),
    city: Joi.string().valid('BLR','MUM','DEL','PUN','HYD','PAT').required(),
    vehiclePlate: Joi.string().required(),
    isEv: Joi.boolean().default(false),
    isWoman: Joi.boolean().default(false),
  });
  const { error, value } = schema.validate(req.body);
  if (error) throw new ApiError(400, 'invalid_input', error.message);

  const driverId = 'drv_' + value.city.toLowerCase() + '_' + Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  const driver = {
    id: driverId,
    name: value.name,
    gender: value.isWoman ? 'F' : 'M',
    rating: 5.0,
    trips: 0,
    sakhiVerified: value.isWoman, // pending video interview verification
    ev: value.isEv,
    coopMember: false, // becomes true after first 50 trips
    equityPoints: 0,
    vehicle: { plate: value.vehiclePlate, model: 'TBD', color: 'TBD' },
    city: value.city,
    online: false,
    kycStatus: 'pending', // would integrate UIDAI/DigiLocker in prod
    createdAt: new Date().toISOString(),
  };
  mem.drivers.set(driverId, driver);
  res.status(201).json({ driverId, status: 'pending_verification' });
});

module.exports = router;
