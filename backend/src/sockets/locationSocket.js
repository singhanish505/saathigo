// Real-time driver-location WebSocket fan-out.
//
// Architecture (production):
//   driver phone -> MQTT broker -> Kafka topic per H3 cell ->
//   Flink stream processor -> Redis Geo + WebSocket gateway (this file) ->
//   subscribed riders / family-tracker / Sakhi monitor.
//
// Here we emulate the gateway in a single process. Horizontally, this scales by
// running N gateway pods behind a sticky load balancer; the Redis pub/sub adapter
// (`@socket.io/redis-adapter` in prod) keeps fan-out coherent across pods.
//
// Each rider subscribes only to their matched driver's room - O(1) fan-out.
const { mem, geoAdd } = require('../services/stores');
const logger = require('../services/logger');

function attachLocationSocket(io) {
  const ns = io.of('/location');

  // --- Driver pings: 1 Hz GPS updates from the in-vehicle app ---
  // In prod the driver app uses MQTT for lower overhead. WebSocket is also fine for ~50k drivers/pod.
  ns.on('connection', (socket) => {
    socket.on('driver:auth', ({ driverId, city }) => {
      const driver = mem.drivers.get(driverId);
      if (!driver) { socket.emit('error', { code: 'unknown_driver' }); return; }
      socket.data.driverId = driverId;
      socket.data.city = city || driver.city;
      socket.join(`driver:${driverId}`);
      socket.join(`city:${socket.data.city}`);
      socket.emit('driver:authed', { driverId });
    });

    socket.on('driver:ping', async ({ lat, lng }) => {
      if (!socket.data.driverId) return;
      const driverId = socket.data.driverId;
      const city = socket.data.city;
      const driver = mem.drivers.get(driverId);
      if (driver) driver.lastSeen = Date.now();

      // Update geo index (Redis Geo in prod; in-mem in mock)
      await geoAdd(city, driverId, lat, lng);

      // Fan-out: emit only to the rooms watching THIS driver.
      ns.to(`driver:${driverId}`).emit('location:update', { driverId, lat, lng, t: Date.now() });
    });

    // --- Rider subscribes to their matched driver ---
    socket.on('rider:subscribe', ({ driverId }) => {
      socket.join(`driver:${driverId}`);
      socket.emit('subscribed', { driverId });
    });

    socket.on('rider:unsubscribe', ({ driverId }) => {
      socket.leave(`driver:${driverId}`);
    });

    // Family-tracker subscribes to a rideId (one-tap share-with-family)
    socket.on('family:subscribe', ({ rideId, token }) => {
      const ride = mem.trips.get(rideId);
      if (!ride || ride.familyToken !== token) {
        socket.emit('error', { code: 'invalid_token' });
        return;
      }
      socket.join(`driver:${ride.driverId}`);
      socket.emit('subscribed', { rideId, role: 'family' });
    });

    socket.on('disconnect', () => {
      if (socket.data.driverId) {
        logger.debug({ driverId: socket.data.driverId }, 'Driver disconnected');
      }
    });
  });

  // --- Demo: drift the seeded drivers slowly so the map looks alive in MOCK mode ---
  if (process.env.MOCK_MODE === 'true') {
    setInterval(async () => {
      for (const [city, drivers] of mem.geo.entries()) {
        for (const [driverId, pos] of drivers.entries()) {
          // small random walk
          pos.lat += (Math.random() - 0.5) * 0.0006;
          pos.lng += (Math.random() - 0.5) * 0.0006;
          pos.t = Date.now();
          ns.to(`driver:${driverId}`).emit('location:update', {
            driverId, lat: pos.lat, lng: pos.lng, t: pos.t, demo: true,
          });
        }
      }
    }, 1500);
  }
}

module.exports = { attachLocationSocket };
