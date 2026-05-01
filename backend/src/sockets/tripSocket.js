// Trip-state WebSocket: pushes status transitions (REQUESTED -> ACCEPTED -> STARTED -> ENDED)
const { mem } = require('../services/stores');

function attachTripSocket(io) {
  const ns = io.of('/trip');
  ns.on('connection', (socket) => {
    socket.on('trip:subscribe', ({ rideId }) => {
      const ride = mem.trips.get(rideId);
      if (!ride) { socket.emit('error', { code: 'not_found' }); return; }
      socket.join(`trip:${rideId}`);
      socket.emit('trip:state', { ride });
    });
    socket.on('trip:unsubscribe', ({ rideId }) => socket.leave(`trip:${rideId}`));
  });

  // Helper for routes to emit state changes
  io.emitTripState = (rideId) => {
    const ride = mem.trips.get(rideId);
    if (ride) ns.to(`trip:${rideId}`).emit('trip:state', { ride });
  };
}

module.exports = { attachTripSocket };
