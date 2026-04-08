// GENERIC RATE LIMITER FACTORY
const createRateLimiter = ({ windowMs = 15 * 60 * 1000, maxRequests = 20, message = "Too many requests. Please try again later." } = {}) => {
  const store = new Map();
  
  // Cleanup expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now > value.resetAt) {
        store.delete(key);
      }
    }
  }, windowMs).unref();
  
  return (req, res, next) => {
    const key = `${req.ip || "unknown"}:${req.path}`;
    const now = Date.now();
    const current = store.get(key);

    if (!current || now > current.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil((current.resetAt - now) / 1000),
      });
    }

    current.count += 1;
    store.set(key, current);
    return next();
  };
};

// Rate limiters for different endpoint types
const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  maxRequests: 20,
  message: "Too many auth attempts. Please try again later.",
});

const salesRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 50,  // 50 sales per 5 min per IP
  message: "Too many sales requests. Please slow down.",
});

const userRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  maxRequests: 10,  // 10 user creations per 15 min per IP
  message: "Too many user creation attempts. Please try again later.",
});

const customerRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 30,  // 30 customers per 5 min per IP
  message: "Too many customer creation attempts. Please slow down.",
});

const generalRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 100,  // 100 requests per 5 min for other write operations
  message: "Too many requests. Please try again later.",
});

module.exports = {
  createRateLimiter,
  authRateLimit,
  salesRateLimit,
  userRateLimit,
  customerRateLimit,
  generalRateLimit,
};
