/**
 * Compatibility re-export of request-id middleware under the historical `requestContext` name.
 * Prefer importing from `requestIdMiddleware.js` in new code.
 */
const { requestIdMiddleware, requestContext } = require('./requestIdMiddleware');

// Assign the CommonJS module exports.
module.exports = {
  // Provide the request context field value.
  requestContext: requestIdMiddleware,
  // Contribute this line to the enclosing declaration or statement.
  requestIdMiddleware,
};
