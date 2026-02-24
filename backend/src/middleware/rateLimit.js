const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 20;

const stores = new Map();

const getStore = (key) => {
  if (!stores.has(key)) {
    stores.set(key, new Map());
  }
  return stores.get(key);
};

const createRateLimiter = ({ key = "global", windowMs = DEFAULT_WINDOW_MS, maxRequests = DEFAULT_MAX_REQUESTS } = {}) => {
  const store = getStore(key);

  return (req, res, next) => {
    const now = Date.now();
    const ipKey = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const existing = store.get(ipKey);

    if (!existing || existing.resetAt <= now) {
      store.set(ipKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please retry shortly.",
        },
      });
    }

    existing.count += 1;
    store.set(ipKey, existing);
    return next();
  };
};

module.exports = { createRateLimiter };
