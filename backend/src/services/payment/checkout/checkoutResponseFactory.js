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
  return {
    type: 'renderOrderPage',
    car,
    formData,
    message,
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
  return {
    type: 'redirect',
    statusCode,
    url,
  };
}

module.exports = {
  buildRenderOrderPageResponse,
  buildRedirectResponse,
};
