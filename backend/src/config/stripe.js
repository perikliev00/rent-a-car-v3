/**
 * Shared Stripe SDK client initialized from validated env (`STRIPE_SECRET`).
 * Used for Checkout Sessions and webhook signature verification.
 *
 * Side effects at import: constructs a Stripe client (requires prior `validateEnv()`).
 */
const Stripe = require('stripe');
// Destructure object properties into local variables.
const { config } = require('./env');

// One shared client so all controllers/services reuse the same secret and API version defaults.
const stripe = new Stripe(config.stripeSecret);

// Assign the CommonJS module exports.
module.exports = stripe;
