/**
 * Discriminated response builders for the checkout controller
 * (re-render order page vs HTTP redirect to Stripe / success).
 */

/**
 * Instruct the controller to re-render the order page with a message.
 * @param {object} car
 * @param {object} formData
 * @param {string} message
 * @param {object} [options]
 * @returns {{ type: 'renderOrderPage', car: object, formData: object, message: string, options: object }}
 */
function buildRenderOrderPageResponse(car, formData, message, options = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the type field value.
    type: 'renderOrderPage',
    // Contribute this line to the enclosing declaration or statement.
    car,
    // Contribute this line to the enclosing declaration or statement.
    formData,
    // Contribute this line to the enclosing declaration or statement.
    message,
    // Contribute this line to the enclosing declaration or statement.
    options,
  };
}

/**
 * Instruct the controller to redirect (typically to Stripe Checkout URL).
 * @param {string} url
 * @param {number} [statusCode=303]
 * @returns {{ type: 'redirect', statusCode: number, url: string }}
 */
function buildRedirectResponse(url, statusCode = 303) {
  // Return the resulting value to the caller.
  return {
    // Provide the type field value.
    type: 'redirect',
    // Contribute this line to the enclosing declaration or statement.
    statusCode,
    // Contribute this line to the enclosing declaration or statement.
    url,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  buildRenderOrderPageResponse,
  // Contribute this line to the enclosing declaration or statement.
  buildRedirectResponse,
};
