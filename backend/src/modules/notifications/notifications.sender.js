const { formatDateForDisplay } = require('../../utils/dateFormatter');
const { sendMail } = require('../../services/email/emailService');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');

function buildBookingSummary(payload) {
  const lines = [
    payload.orderId ? `Order reference: #${payload.orderId}` : null,
    payload.reservationId ? `Reservation: #${payload.reservationId}` : null,
    payload.fullName ? `Customer: ${payload.fullName}` : null,
    payload.carName ? `Car: ${payload.carName}` : null,
    payload.pickupDate
      ? `Pickup: ${formatDateForDisplay(payload.pickupDate)}${
          payload.pickupTime ? ` at ${payload.pickupTime}` : ''
        }${payload.pickupLocation ? ` — ${payload.pickupLocation}` : ''}`
      : null,
    payload.returnDate
      ? `Return: ${formatDateForDisplay(payload.returnDate)}${
          payload.returnTime ? ` at ${payload.returnTime}` : ''
        }${payload.returnLocation ? ` — ${payload.returnLocation}` : ''}`
      : null,
    payload.totalPrice != null ? `Total: EUR ${Number(payload.totalPrice || 0).toFixed(2)}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function renderNotification(notification) {
  const payload = notification.payload || {};

  switch (notification.type) {
    case 'reservation_confirmation': {
      const summary = buildBookingSummary(payload);
      return {
        subject: `LuxRide booking confirmed — order #${payload.orderId}`,
        text: `Thank you for your booking.\n\n${summary}\n\nWe look forward to serving you.`,
        html: `<p>Thank you for your booking.</p><pre>${summary}</pre><p>We look forward to serving you.</p>`,
      };
    }
    case 'admin_new_booking_alert': {
      const summary = buildBookingSummary(payload);
      return {
        subject: `New LuxRide booking — order #${payload.orderId}`,
        text: `A new booking was confirmed.\n\n${summary}`,
        html: `<p>A new booking was confirmed.</p><pre>${summary}</pre>`,
      };
    }
    case 'payment_failed':
      return {
        subject: 'LuxRide payment failed',
        text: `We could not complete your payment${
          payload.reason ? ` (${payload.reason})` : ''
        }. Please try again or contact support.`,
        html: `<p>We could not complete your payment${
          payload.reason ? ` (<code>${payload.reason}</code>)` : ''
        }. Please try again or contact support.</p>`,
      };
    case 'pickup_reminder':
      return {
        subject: 'LuxRide pickup reminder',
        text: `Reminder: your pickup is soon.\n\n${buildBookingSummary(payload)}`,
        html: `<p>Reminder: your pickup is soon.</p><pre>${buildBookingSummary(payload)}</pre>`,
      };
    case 'return_reminder':
      return {
        subject: 'LuxRide return reminder',
        text: `Reminder: your return is soon.\n\n${buildBookingSummary(payload)}`,
        html: `<p>Reminder: your return is soon.</p><pre>${buildBookingSummary(payload)}</pre>`,
      };
    case 'abandoned_checkout_reminder':
      return {
        subject: 'Complete your LuxRide booking',
        text: `You still have a pending car hold. Complete checkout before it expires.\n\n${buildBookingSummary(payload)}`,
        html: `<p>You still have a pending car hold. Complete checkout before it expires.</p><pre>${buildBookingSummary(payload)}</pre>`,
      };
    case 'expiring_insurance_alert':
      return {
        subject: `Insurance expiring — ${payload.carName || `car #${payload.carId}`}`,
        text: `Insurance/compliance item "${payload.itemTitle || payload.itemType}" expires on ${payload.expiresAt}.`,
        html: `<p>Insurance/compliance item <strong>${payload.itemTitle || payload.itemType}</strong> expires on <strong>${payload.expiresAt}</strong>.</p>`,
      };
    case 'maintenance_reminder':
      return {
        subject: `Maintenance reminder — ${payload.carName || `car #${payload.carId}`}`,
        text: `Maintenance block scheduled ${payload.startDate} → ${payload.endDate}. ${payload.reason || ''}`,
        html: `<p>Maintenance block scheduled <strong>${payload.startDate}</strong> → <strong>${payload.endDate}</strong>.</p>`,
      };
    case 'paid_but_not_confirmed_alert':
      return {
        subject: `Paid but not confirmed — reservation #${payload.reservationId}`,
        text: `Reservation #${payload.reservationId} is paid but not confirmed. Customer: ${payload.email || 'n/a'}`,
        html: `<p>Reservation <strong>#${payload.reservationId}</strong> is paid but not confirmed.</p>`,
      };
    default:
      return {
        subject: `LuxRide notification — ${notification.type}`,
        text: JSON.stringify(payload, null, 2),
        html: `<pre>${JSON.stringify(payload, null, 2)}</pre>`,
      };
  }
}

async function sendNotificationEmail(notification) {
  if (notification.channel !== 'email') {
    return { sent: false, reason: 'unsupported_channel' };
  }
  if (!notification.recipientEmail) {
    return { sent: false, reason: 'missing_recipient' };
  }

  const content = renderNotification(notification);
  const result = await sendMail({
    to: notification.recipientEmail,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  logEvent.info('notification.email.attempt', {
    type: notification.type,
    notificationId: notification.id,
    sent: result.sent,
    reason: result.reason || null,
  });

  if (!result.sent && result.reason === 'smtp_not_configured') {
    // Treat as soft success so cron does not endlessly retry in dev without SMTP
    logger.info(
      { notificationId: notification.id, type: notification.type },
      'Notification marked sent (SMTP not configured)'
    );
    return { sent: true, reason: 'smtp_not_configured_soft' };
  }

  return result;
}

module.exports = {
  renderNotification,
  sendNotificationEmail,
  buildBookingSummary,
};
