/**
 * Simple in-memory rate limiter
 * No external dependencies
 */

const store = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of store) {
    if (now - data.windowStart > data.windowMs * 2) {
      store.delete(key);
    }
  }
}, 300000).unref();

/**
 * Rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in ms (default: 60000 = 1 min)
 * @param {number} options.max - Max requests per window (default: 60)
 * @param {string} options.keyPrefix - Prefix for the key (default: 'rl')
 * @param {Function} options.keyGenerator - Custom key generator (default: uses IP)
 */
export function rateLimit({ windowMs = 60000, max = 60, keyPrefix = 'rl', keyGenerator = null } = {}) {
  return (req, res, next) => {
    const key = keyPrefix + ':' + (keyGenerator ? keyGenerator(req) : (req.ip || req.connection?.remoteAddress || 'unknown'));
    const now = Date.now();
    
    let entry = store.get(key);
    
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 0 };
      store.set(key, entry);
    }
    
    entry.count++;
    
    // Set rate limit headers
    const remaining = Math.max(0, max - entry.count);
    const resetTime = entry.windowStart + windowMs;
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
    
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((resetTime - now) / 1000)));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((resetTime - now) / 1000)}s`
      });
    }
    
    next();
  };
}
