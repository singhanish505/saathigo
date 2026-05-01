// Matching service. Multi-objective:
//   minimize ETA, respect filters, maximise driver-owner equity earnings,
//   avoid concentrating rides on a small driver pool.
const { mem, geoRadius } = require('./stores');

async function match({ city, pickup, rideType }) {
  const candidates = await geoRadius(city, pickup.lat, pickup.lng, 5, 25);
  const scored = [];

  for (const c of candidates) {
    const driver = mem.drivers.get(c.id);
    if (!driver || !driver.online) continue;

    // Filter by ride type preference
    if (rideType === 'SAKHI' && !driver.sakhiVerified) continue;
    if (rideType === 'EV' && !driver.ev) continue;
    if (rideType === 'POOL' && !driver.coopMember) continue;

    // Score components (higher = better)
    const etaScore   = 100 - Math.min(60, c.distance * 12);     // closer is better
    const ratingBoost = (driver.rating - 4.0) * 25;             // 0 to 25
    const equityFair = Math.max(0, 30 - driver.equityPoints / 400); // bump under-served drivers
    const coopBoost  = driver.coopMember ? 10 : 0;

    const score = etaScore + ratingBoost + equityFair + coopBoost;
    scored.push({ driver, distance: c.distance, lat: c.lat, lng: c.lng, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top) return null;
  return {
    driver: top.driver,
    distanceKm: Math.round(top.distance * 100) / 100,
    etaMin: Math.max(2, Math.round(top.distance / 0.4)),
    location: { lat: top.lat, lng: top.lng },
    score: Math.round(top.score),
  };
}

module.exports = { match };
