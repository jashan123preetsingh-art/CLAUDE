// Request logger + error helpers
function log(level, msg, meta) {
  const stamp = new Date().toISOString();
  const m = meta ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[${stamp}] [${level}] ${msg}${m}`);
}

const logger = {
  info: (m, x) => log('INFO', m, x),
  warn: (m, x) => log('WARN', m, x),
  error: (m, x) => log('ERROR', m, x),
};

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    log('HTTP', `${req.method} ${req.path} ${res.statusCode} ${ms}ms`, { ip });
  });
  next();
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', { msg: err.message, stack: err.stack });
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: err.expose ? err.message : 'Internal server error'
  });
}

module.exports = { logger, requestLogger, asyncHandler, errorHandler };
