/**
 * Compatibility re-export of request-id middleware under the historical `requestContext` name.
 * Prefer importing from `requestIdMiddleware.js` in new code.
 */
const { requestIdMiddleware, requestContext } = require('./requestIdMiddleware');

module.exports = {
  requestContext: requestIdMiddleware,
  requestIdMiddleware,
};
