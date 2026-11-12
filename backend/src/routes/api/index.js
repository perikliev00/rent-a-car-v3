/**
 * Aggregates public and admin API routers mounted under /api and /api/v1.
 * Individual mount points below are the public surface area of the JSON API.
 */
const express = require('express');
// Require the './carRoutes' module as carRoutes.
const carRoutes = require('./carRoutes');
// Require the './metaRoutes' module as metaRoutes.
const metaRoutes = require('./metaRoutes');
// Require the './orderRoutes' module as orderRoutes.
const orderRoutes = require('./orderRoutes');
// Require the './reservationRoutes' module as reservationRoutes.
const reservationRoutes = require('./reservationRoutes');
// Require the './checkoutRoutes' module as checkoutRoutes.
const checkoutRoutes = require('./checkoutRoutes');
// Require the './authRoutes' module as authRoutes.
const authRoutes = require('./authRoutes');
// Require the './admin' module as adminRoutes.
const adminRoutes = require('./admin');
// Require the './chatRoutes' module as chatRoutes.
const chatRoutes = require('./chatRoutes');
// Require the './contactRoutes' module as contactRoutes.
const contactRoutes = require('./contactRoutes');
// Require the './accountRoutes' module as accountRoutes.
const accountRoutes = require('./accountRoutes');
// Require the './docsRoutes' module as docsRoutes.
const docsRoutes = require('./docsRoutes');

// Create the router constant.
const router = express.Router();

// OpenAPI / Swagger UI (gated in production).
router.use('/docs', docsRoutes);
// Public fleet catalog.
router.use('/cars', carRoutes);
// Locations, categories, pricing info (no path prefix — routes define their own).
router.use(metaRoutes);
// Create customer orders (pre-checkout).
router.use('/orders', orderRoutes);
// Release / rehold active reservation holds.
router.use('/reservations', reservationRoutes);
// Stripe Checkout session lifecycle.
router.use('/checkout', checkoutRoutes);
// Login, signup, CSRF, session identity.
router.use('/auth', authRoutes);
// Authenticated customer account portal.
router.use('/account', accountRoutes);
// Staff admin API (RBAC-gated inside sub-routers).
router.use('/admin', adminRoutes);
// External chatbot contract (non-envelope responses).
router.use('/chat', chatRoutes);
// Public contact form submissions.
router.use('/contacts', contactRoutes);

// Assign the CommonJS module exports.
module.exports = router;
