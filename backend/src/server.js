// SaathiGo backend entry point.
// Express + Socket.io. Built to be horizontally sharded behind a load balancer.
require('dotenv').config();
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const pinoHttp = require('pino-http');
const { Server } = require('socket.io');

const logger = require('./services/logger');
const { rateLimit } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/error');
const { initStores, healthCheck } = require('./services/stores');
const { attachLocationSocket } = require('./sockets/locationSocket');
const { attachTripSocket } = require('./sockets/tripSocket');
const { attachSakhiSocket } = require('./sockets/sakhiSocket');

// Routes
const authRoutes = require('./routes/auth');
const cityRoutes = require('./routes/cities');
const driverRoutes = require('./routes/drivers');
const rideRoutes = require('./routes/rides');
const sakhiRoutes = require('./routes/sakhi');
const adminRoutes = require('./routes/admin');

const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');

async function bootstrap() {
  await initStores();

  const app = express();
  const server = http.createServer(app);

  // ----- Middleware -----
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '128kb' }));
  app.use(pinoHttp({ logger }));
  app.use(rateLimit);

  // ----- Health -----
  app.get('/healthz', async (_req, res) => {
    const status = await healthCheck();
    res.status(status.healthy ? 200 : 503).json(status);
  });
  app.get('/readyz', (_req, res) => res.json({ ready: true, ts: Date.now() }));

  // ----- API routes -----
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/cities', cityRoutes);
  app.use('/api/v1/drivers', driverRoutes);
  app.use('/api/v1/rides', rideRoutes);
  app.use('/api/v1/sakhi', sakhiRoutes);
  app.use('/api/v1/admin', adminRoutes);

  app.use(errorHandler);

  // ----- WebSockets -----
  const io = new Server(server, {
    cors: { origin: CORS_ORIGINS, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  attachLocationSocket(io);
  attachTripSocket(io);
  attachSakhiSocket(io);

  // ----- Start -----
  server.listen(PORT, () => {
    logger.info({ port: PORT, mockMode: process.env.MOCK_MODE === 'true' }, 'SaathiGo API listening');
  });

  // Graceful shutdown
  const shutdown = (sig) => {
    logger.info({ sig }, 'Shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start');
  process.exit(1);
});
