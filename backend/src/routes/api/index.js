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

router.use('/docs', docsRoutes);
router.use('/cars', carRoutes);
router.use(metaRoutes);
router.use('/orders', orderRoutes);
router.use('/reservations', reservationRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/auth', authRoutes);
router.use('/account', accountRoutes);
router.use('/admin', adminRoutes);
router.use('/chat', chatRoutes);
router.use('/contacts', contactRoutes);

module.exports = router;
