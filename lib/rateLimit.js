// Simple in-memory sliding window rate limiter
const buckets = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, hits] of buckets.entries()) {
    const fresh = hits.filter(t => now - t < 3600000);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}
setInterval(cleanup, 300000).unref();

function rateLimit({ windowMs = 60000, max = 10, keyPrefix = '' } = {}) {
  return function (req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
      || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter(t => now - t < windowMs);
    if (hits.length >= max) {
      const retry = Math.ceil((hits[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', retry);
      return res.status(429).json({ error: 'Too many requests. Please slow down.', retryAfter: retry });
    }
    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

module.exports = { rateLimit };
