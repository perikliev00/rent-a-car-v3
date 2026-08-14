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

router.use(dashboardRoutes);
router.use('/cars', carRoutes);
router.use('/orders', orderRoutes);
router.use('/contacts', contactRoutes);
router.use('/payments', paymentRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/reservations', reservationRoutes);
router.use('/pricing', pricingRoutes);
router.use('/users', userRoutes);
router.use('/rbac', rbacRoutes);
router.use('/calendar', calendarRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/realtime', realtimeRoutes);
router.use('/api-keys', apiKeyRoutes);

module.exports = router;
