// Stripe SDK клиентът се използва при създаване на checkout sessions и верифициране на webhooks.
const Stripe = require('stripe');
const { config } = require('./env');

// Един споделен Stripe клиент – secret key от validated config.
const stripe = new Stripe(config.stripeSecret);

// Експорт – controllers/services да преизползват същата конфигурация.
module.exports = stripe;
