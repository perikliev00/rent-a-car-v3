/**
 * Aggregates public and admin API routers mounted under /api and /api/v1.
 * Individual mount points below are the public surface area of the JSON API.
 */
const express = require('express');
const carRoutes = require('./carRoutes');
const metaRoutes = require('./metaRoutes');
const orderRoutes = require('./orderRoutes');
const reservationRoutes = require('./reservationRoutes');
const checkoutRoutes = require('./checkoutRoutes');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./admin');
const chatRoutes = require('./chatRoutes');
const contactRoutes = require('./contactRoutes');
const accountRoutes = require('./accountRoutes');
const docsRoutes = require('./docsRoutes');

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

module.exports = router;
