/**
 * Renders notification payloads into email subject/body and sends via SMTP.
 *
 * Missing SMTP is treated as soft success so workers do not retry forever in
 * local/dev environments without mail configured.
 */

const { formatDateForDisplay } = require('../../utils/dateFormatter');
const { escapeHtml, escapeMailHeader } = require('../../utils/htmlEscape');
const { sendMail } = require('../../services/email/emailService');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');

/** Plain-text booking lines shared by confirmation / reminder templates. */
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

/**
 * Map notification.type + payload to email content.
 * @param {object} notification
 * @returns {{ subject: string, text: string, html: string }}
 */
function renderNotification(notification) {
  const payload = notification.payload || {};
  const summary = buildBookingSummary(payload);
  const summaryHtml = escapeHtml(summary);
  const orderLabel = escapeMailHeader(payload.orderId);
  const carLabel = escapeMailHeader(payload.carName || `car #${payload.carId || ''}`);

  switch (notification.type) {
    case 'reservation_confirmation': {
      return {
        subject: `LuxRide booking confirmed — order #${orderLabel}`,
        text: `Thank you for your booking.\n\n${summary}\n\nWe look forward to serving you.`,
        html: `<p>Thank you for your booking.</p><pre>${summaryHtml}</pre><p>We look forward to serving you.</p>`,
      };
    }
    case 'admin_new_booking_alert': {
      return {
        subject: `New LuxRide booking — order #${orderLabel}`,
        text: `A new booking was confirmed.\n\n${summary}`,
        html: `<p>A new booking was confirmed.</p><pre>${summaryHtml}</pre>`,
      };
    }
    case 'payment_failed':
      return {
        subject: 'LuxRide payment failed',
        text: `We could not complete your payment${
          payload.reason ? ` (${payload.reason})` : ''
        }. Please try again or contact support.`,
        html: `<p>We could not complete your payment${
          payload.reason ? ` (<code>${escapeHtml(payload.reason)}</code>)` : ''
        }. Please try again or contact support.</p>`,
      };
    case 'pickup_reminder':
      return {
        subject: 'LuxRide pickup reminder',
        text: `Reminder: your pickup is soon.\n\n${summary}`,
        html: `<p>Reminder: your pickup is soon.</p><pre>${summaryHtml}</pre>`,
      };
    case 'return_reminder':
      return {
        subject: 'LuxRide return reminder',
        text: `Reminder: your return is soon.\n\n${summary}`,
        html: `<p>Reminder: your return is soon.</p><pre>${summaryHtml}</pre>`,
      };
    case 'abandoned_checkout_reminder':
      return {
        subject: 'Complete your LuxRide booking',
        text: `You still have a pending car hold. Complete checkout before it expires.\n\n${summary}`,
        html: `<p>You still have a pending car hold. Complete checkout before it expires.</p><pre>${summaryHtml}</pre>`,
      };
    case 'expiring_insurance_alert':
      return {
        subject: `Insurance expiring — ${carLabel}`,
        text: `Insurance/compliance item "${payload.itemTitle || payload.itemType}" expires on ${payload.expiresAt}.`,
        html: `<p>Insurance/compliance item <strong>${escapeHtml(payload.itemTitle || payload.itemType)}</strong> expires on <strong>${escapeHtml(payload.expiresAt)}</strong>.</p>`,
      };
    case 'maintenance_reminder':
      return {
        subject: `Maintenance reminder — ${carLabel}`,
        text: `Maintenance block scheduled ${payload.startDate} → ${payload.endDate}. ${payload.reason || ''}`,
        html: `<p>Maintenance block scheduled <strong>${escapeHtml(payload.startDate)}</strong> → <strong>${escapeHtml(payload.endDate)}</strong>.</p>`,
      };
    case 'paid_but_not_confirmed_alert':
      return {
        subject: `Paid but not confirmed — reservation #${escapeMailHeader(payload.reservationId)}`,
        text: `Reservation #${payload.reservationId} is paid but not confirmed. Customer: ${payload.email || 'n/a'}`,
        html: `<p>Reservation <strong>#${escapeHtml(payload.reservationId)}</strong> is paid but not confirmed.</p>`,
      };
    default:
      return {
        subject: `LuxRide notification — ${escapeMailHeader(notification.type)}`,
        text: JSON.stringify(payload, null, 2),
        html: `<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`,
      };
  }
}

/**
 * Send one email-channel notification; non-email channels are skipped.
 * @param {object} notification
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendNotificationEmail(notification) {
  // Only email channel is implemented; others are soft-failed for the worker.
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

  // Treat missing SMTP as soft success so cron does not endlessly retry in local/dev.
  if (!result.sent && result.reason === 'smtp_not_configured') {
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
