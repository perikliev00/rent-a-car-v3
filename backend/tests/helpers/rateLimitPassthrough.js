/**
 * Builds a stand-in for the rate-limit middleware module in which every `*Limiter`
 * export is a passthrough.
 *
 * Route modules mount limiters at require time, so a hand-written partial mock makes
 * every route-mounting test fail the moment a new limiter is introduced. Deriving the
 * shape from the real module keeps those tests decoupled from the limiter inventory.
 *
 * Usage:
 *   jest.mock('../../src/middleware/rateLimit', () =>
 *     require('../helpers/rateLimitPassthrough')()
 *   );
 */
module.exports = function createRateLimitPassthrough() {
  const actual = jest.requireActual('../../src/middleware/rateLimit');
  const passthrough = (_req, _res, next) => next();

  return Object.fromEntries(
    Object.entries(actual).map(([name, value]) => [
      name,
      name.endsWith('Limiter') ? passthrough : value,
    ])
  );
};
