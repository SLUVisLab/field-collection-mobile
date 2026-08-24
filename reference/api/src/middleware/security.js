const rateLimit = require('express-rate-limit');

function resolveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createRateLimiter(options = {}) {
  const windowMs = resolveNumber(options.windowMs ?? process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  const max = resolveNumber(options.max ?? process.env.RATE_LIMIT_MAX, 1000);

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: options.message || {
      error: 'Too many requests, please try again later.'
    }
  });
}

function parseApiKeys(value = process.env.API_KEYS) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

function createApiKeyGuard(config = {}) {
  const keys = config.keys ?? parseApiKeys();
  const keySet = new Set(keys);
  const headerName = (config.headerName || process.env.API_KEY_HEADER || 'x-api-key').toLowerCase();
  const exemptRoutes = new Set(config.exemptRoutes || ['/health']);

  const isEnabled = keySet.size > 0;

  return function requireApiKey(req, res, next) {
    if (!isEnabled || req.method === 'OPTIONS' || exemptRoutes.has(req.path)) {
      return next();
    }

    const providedKey = req.headers[headerName];

    if (!providedKey || !keySet.has(providedKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
  createApiKeyGuard,
  parseApiKeys
};
