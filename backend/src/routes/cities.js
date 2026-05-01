const express = require('express');
const { cities } = require('../data/seed');

const router = express.Router();

router.get('/', (_req, res) => res.json({ cities }));

router.get('/:code', (req, res) => {
  const city = cities.find((c) => c.code === req.params.code.toUpperCase());
  if (!city) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown city' } });
  res.json({ city });
});

module.exports = router;
