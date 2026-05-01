const logger = require('../services/logger');

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) logger.error({ err, path: req.path }, 'Unhandled');
  else logger.warn({ err: err.message, path: req.path }, '4xx');

  res.status(status).json({
    error: { code: err.code || 'internal_error', message: err.message || 'Something went wrong' },
  });
}

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = { errorHandler, ApiError };
