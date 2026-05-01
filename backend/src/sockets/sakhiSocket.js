// Sakhi Shield monitor WebSocket. Ops centre subscribes to all Sakhi-mode rides
// in their city for live anomaly detection (route-deviation, ping gaps, SOS).
const { mem } = require('../services/stores');

function attachSakhiSocket(io) {
  const ns = io.of('/sakhi');

  ns.on('connection', (socket) => {
    socket.on('opscentre:subscribe', ({ city }) => {
      socket.join(`sakhi:${city}`);
      socket.emit('subscribed', { city });
    });
  });

  // Broadcast Sakhi events (called from routes/sakhi.js in prod)
  io.broadcastSakhiEvent = (city, event) => {
    ns.to(`sakhi:${city}`).emit('sakhi:event', { ...event, t: Date.now() });
  };

  // Periodic gap-detector: scans active Sakhi trips for missing pings.
  setInterval(() => {
    const gapMs = parseInt(process.env.LOCATION_GAP_SECONDS || '90', 10) * 1000;
    const now = Date.now();
    for (const ride of mem.trips.values()) {
      if (!ride.sakhi) continue;
      if (!['ACCEPTED','STARTED'].includes(ride.status)) continue;
      const driver = mem.drivers.get(ride.driverId);
      if (driver && now - driver.lastSeen > gapMs) {
        const event = { rideId: ride.id, type: 'PING_GAP', driverId: ride.driverId, gapMs: now - driver.lastSeen };
        ns.to(`sakhi:${ride.cityCode}`).emit('sakhi:event', event);
      }
    }
  }, 30_000);
}

module.exports = { attachSakhiSocket };
