/**
 * Canonical notification type and channel enums for enqueue validation.
 */

const NOTIFICATION_TYPES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'reservation_confirmation',
  // Supply the literal value used by the enclosing expression.
  'payment_failed',
  // Supply the literal value used by the enclosing expression.
  'pickup_reminder',
  // Supply the literal value used by the enclosing expression.
  'return_reminder',
  // Supply the literal value used by the enclosing expression.
  'admin_new_booking_alert',
  // Supply the literal value used by the enclosing expression.
  'expiring_insurance_alert',
  // Supply the literal value used by the enclosing expression.
  'maintenance_reminder',
  // Supply the literal value used by the enclosing expression.
  'abandoned_checkout_reminder',
  // Supply the literal value used by the enclosing expression.
  'paid_but_not_confirmed_alert',
]);

// Create the channels constant.
const CHANNELS = Object.freeze(['email', 'in_app']);

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  NOTIFICATION_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  CHANNELS,
};
