/**
 * Mounts all admin sub-routers under /admin.
 * Permission checks live on each sub-router; this file only composes mounts.
 */
const express = require('express');
// Require the './dashboardRoutes' module as dashboardRoutes.
const dashboardRoutes = require('./dashboardRoutes');
// Require the './carRoutes' module as carRoutes.
const carRoutes = require('./carRoutes');
// Require the './orderRoutes' module as orderRoutes.
const orderRoutes = require('./orderRoutes');
// Require the './contactRoutes' module as contactRoutes.
const contactRoutes = require('./contactRoutes');
// Require the './paymentRoutes' module as paymentRoutes.
const paymentRoutes = require('./paymentRoutes');
// Require the './auditLogRoutes' module as auditLogRoutes.
const auditLogRoutes = require('./auditLogRoutes');
// Require the './reservationRoutes' module as reservationRoutes.
const reservationRoutes = require('./reservationRoutes');
// Require the './pricingRoutes' module as pricingRoutes.
const pricingRoutes = require('./pricingRoutes');
// Require the './userRoutes' module as userRoutes.
const userRoutes = require('./userRoutes');
// Require the './rbacRoutes' module as rbacRoutes.
const rbacRoutes = require('./rbacRoutes');
// Require the '../../../modules/calendar/calendar.routes' module as calendarRoutes.
const calendarRoutes = require('../../../modules/calendar/calendar.routes');
// Require the '../../../modules/analytics/analytics.routes' module as analyticsRoutes.
const analyticsRoutes = require('../../../modules/analytics/analytics.routes');
// Require the '../../../modules/notifications/notifications.routes' module as notificationsRoutes.
const notificationsRoutes = require('../../../modules/notifications/notifications.routes');
// Require the '../../../modules/realtime/realtime.routes' module as realtimeRoutes.
const realtimeRoutes = require('../../../modules/realtime/realtime.routes');
// Require the './apiKeyRoutes' module as apiKeyRoutes.
const apiKeyRoutes = require('./apiKeyRoutes');

// Create the router constant.
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

// Assign the CommonJS module exports.
module.exports = router;
