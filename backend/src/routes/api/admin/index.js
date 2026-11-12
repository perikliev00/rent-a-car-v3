/**
 * Mounts all admin sub-routers under /admin.
 * Permission checks live on each sub-router; this file only composes mounts.
 */
const express = require('express');
const dashboardRoutes = require('./dashboardRoutes');
const carRoutes = require('./carRoutes');
const orderRoutes = require('./orderRoutes');
const contactRoutes = require('./contactRoutes');
const paymentRoutes = require('./paymentRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const reservationRoutes = require('./reservationRoutes');
const pricingRoutes = require('./pricingRoutes');
const userRoutes = require('./userRoutes');
const rbacRoutes = require('./rbacRoutes');
const calendarRoutes = require('../../../modules/calendar/calendar.routes');
const analyticsRoutes = require('../../../modules/analytics/analytics.routes');
const notificationsRoutes = require('../../../modules/notifications/notifications.routes');
const realtimeRoutes = require('../../../modules/realtime/realtime.routes');
const apiKeyRoutes = require('./apiKeyRoutes');

const router = express.Router();

// Dashboard summary widgets (root paths under /admin).
router.use(dashboardRoutes);
// Fleet CRUD, documents, damage, compliance, alerts.
router.use('/cars', carRoutes);
// Admin order list/create/edit.
router.use('/orders', orderRoutes);
// Inbound contact message inbox.
router.use('/contacts', contactRoutes);
// Payments list, refunds, ledger.
router.use('/payments', paymentRoutes);
// Immutable audit trail browse.
router.use('/audit-logs', auditLogRoutes);
// Reservation ops, checklists, cancellation requests.
router.use('/reservations', reservationRoutes);
// Global pricing, seasons, extras, deposits.
router.use('/pricing', pricingRoutes);
// Staff user management.
router.use('/users', userRoutes);
// Roles and permissions administration.
router.use('/rbac', rbacRoutes);
// Fleet calendar / blocks / tasks (module router).
router.use('/calendar', calendarRoutes);
// Analytics reports (module router).
router.use('/analytics', analyticsRoutes);
// In-app notification feed (module router).
router.use('/notifications', notificationsRoutes);
// SSE realtime stream (module router).
router.use('/realtime', realtimeRoutes);
// Machine API key CRUD.
router.use('/api-keys', apiKeyRoutes);

module.exports = router;
