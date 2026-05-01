// Pricing service. Computes fare estimate, surge multiplier, multi-modal stitch fares.
const { cities } = require('../data/seed');
const { mem, haversine } = require('./stores');

// Per-km base fare in paise (₹)
const BASE_PER_KM = {
  STD:        14_00,
  EV:         12_50,
  SAKHI:      15_50,
  POOL:        7_50,
  ONEJOURNEY: 10_00,
};
const BASE_FLAG = 25_00; // base flagfall in paise
const PER_MIN   =  2_00;

const SURGE_CAP = {
  metro: parseFloat(process.env.SURGE_CAP_METRO || '2.2'),
  tier2: parseFloat(process.env.SURGE_CAP_TIER2 || '1.6'),
};

// Surge model — in prod this comes from a Flink window of (requests / drivers).
// Here we vary by hour-of-day per city.
function computeSurge(cityCode) {
  const city = cities.find((c) => c.code === cityCode);
  if (!city) return 1.0;
  const cap = SURGE_CAP[city.tier] || 1.6;
  const hour = new Date().getHours();
  let s = 1.0;
  if (hour >= 8 && hour <= 10) s = 1.5;          // morning peak
  else if (hour >= 17 && hour <= 20) s = 1.7;    // evening peak
  else if (hour >= 22 || hour <= 5) s = 1.25;    // late night
  // jitter
  s = s * (1 + (Math.random() - 0.5) * 0.1);
  return Math.min(s, cap);
}

function estimate({ pickup, drop, rideType = 'EV', cityCode }) {
  const distanceKm = haversine(pickup.lat, pickup.lng, drop.lat, drop.lng);
  const surge = computeSurge(cityCode);
  const perKm = BASE_PER_KM[rideType] || BASE_PER_KM.STD;
  const minutes = Math.max(5, Math.round(distanceKm / 0.4)); // assume 24 km/h average
  const subtotalPaise = BASE_FLAG + Math.round(distanceKm * perKm) + minutes * PER_MIN;
  const totalPaise = Math.round(subtotalPaise * surge);
  const co2SavedGrams = rideType === 'EV' ? Math.round(distanceKm * 120) : 0; // ~120 g/km
  return {
    rideType,
    distanceKm: Math.round(distanceKm * 100) / 100,
    minutes,
    surge: Math.round(surge * 100) / 100,
    farePaise: totalPaise,
    fareRupees: Math.round(totalPaise / 100),
    farePretty: '₹ ' + Math.round(totalPaise / 100).toLocaleString('en-IN'),
    co2SavedGrams,
    driverShareRupees: Math.round(totalPaise * 0.92 / 100), // 92% to driver-owner
    cooperativeContributionPct: 92,
  };
}

function multiQuote({ pickup, drop, cityCode }) {
  const types = ['EV','SAKHI','POOL','ONEJOURNEY','STD'];
  return types.map((t) => ({ type: t, ...estimate({ pickup, drop, rideType: t, cityCode }) }));
}

module.exports = { estimate, multiQuote, computeSurge };
