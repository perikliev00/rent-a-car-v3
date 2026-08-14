const NOTIFICATION_TYPES = Object.freeze([
  'reservation_confirmation',
  'payment_failed',
  'pickup_reminder',
  'return_reminder',
  'admin_new_booking_alert',
  'expiring_insurance_alert',
  'maintenance_reminder',
  'abandoned_checkout_reminder',
  'paid_but_not_confirmed_alert',
]);

const CHANNELS = Object.freeze(['email', 'in_app']);

module.exports = {
  NOTIFICATION_TYPES,
  CHANNELS,
};
