/**
 * Renders notification payloads into email subject/body and sends via SMTP.
 *
 * Missing SMTP is treated as soft success so workers do not retry forever in
 * local/dev environments without mail configured.
 */

const { formatDateForDisplay } = require('../../utils/dateFormatter');
// Destructure object properties into local variables.
const { escapeHtml, escapeMailHeader } = require('../../utils/htmlEscape');
// Destructure object properties into local variables.
const { sendMail } = require('../../services/email/emailService');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Require the '../../monitoring/logEvent' module as logEvent.
const logEvent = require('../../monitoring/logEvent');

/** Plain-text booking lines shared by confirmation / reminder templates. */
function buildBookingSummary(payload) {
  // Create the lines constant.
  const lines = [
    // Continue the surrounding logic with this statement.
    payload.orderId ? `Order reference: #${payload.orderId}` : null,
    // Continue the surrounding logic with this statement.
    payload.reservationId ? `Reservation: #${payload.reservationId}` : null,
    // Continue the surrounding logic with this statement.
    payload.fullName ? `Customer: ${payload.fullName}` : null,
    // Continue the surrounding logic with this statement.
    payload.carName ? `Car: ${payload.carName}` : null,
    // Contribute this line to the enclosing declaration or statement.
    payload.pickupDate
      // Continue the surrounding logic with this statement.
      ? `Pickup: ${formatDateForDisplay(payload.pickupDate)}${
          // Continue the surrounding logic with this statement.
          payload.pickupTime ? ` at ${payload.pickupTime}` : ''
        // Continue the surrounding logic with this statement.
        }${payload.pickupLocation ? ` — ${payload.pickupLocation}` : ''}`
      // Contribute this line to the enclosing declaration or statement.
      : null,
    // Contribute this line to the enclosing declaration or statement.
    payload.returnDate
      // Continue the surrounding logic with this statement.
      ? `Return: ${formatDateForDisplay(payload.returnDate)}${
          // Continue the surrounding logic with this statement.
          payload.returnTime ? ` at ${payload.returnTime}` : ''
        // Continue the surrounding logic with this statement.
        }${payload.returnLocation ? ` — ${payload.returnLocation}` : ''}`
      // Contribute this line to the enclosing declaration or statement.
      : null,
    // Continue the surrounding logic with this statement.
    payload.totalPrice != null ? `Total: EUR ${Number(payload.totalPrice || 0).toFixed(2)}` : null,
  // Continue the surrounding logic with this statement.
  ].filter(Boolean);
  // Return the resulting value to the caller.
  return lines.join('\n');
}

/**
 * Map notification.type + payload to email content.
 * @param {object} notification
 * @returns {{ subject: string, text: string, html: string }}
 */
function renderNotification(notification) {
  // Create the payload constant.
  const payload = notification.payload || {};
  // Create the summary constant.
  const summary = buildBookingSummary(payload);
  // Create the summary html constant.
  const summaryHtml = escapeHtml(summary);
  // Create the order label constant.
  const orderLabel = escapeMailHeader(payload.orderId);
  // Create the car label constant.
  const carLabel = escapeMailHeader(payload.carName || `car #${payload.carId || ''}`);

  // Choose a branch from the switch expression.
  switch (notification.type) {
    // Handle this discrete switch case.
    case 'reservation_confirmation': {
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: `LuxRide booking confirmed — order #${orderLabel}`,
        // Provide the text field value.
        text: `Thank you for your booking.\n\n${summary}\n\nWe look forward to serving you.`,
        // Provide the html field value.
        html: `<p>Thank you for your booking.</p><pre>${summaryHtml}</pre><p>We look forward to serving you.</p>`,
      };
    }
    // Handle this discrete switch case.
    case 'admin_new_booking_alert': {
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: `New LuxRide booking — order #${orderLabel}`,
        // Provide the text field value.
        text: `A new booking was confirmed.\n\n${summary}`,
        // Provide the html field value.
        html: `<p>A new booking was confirmed.</p><pre>${summaryHtml}</pre>`,
      };
    }
    // Handle this discrete switch case.
    case 'payment_failed':
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: 'LuxRide payment failed',
        // Provide the text field value.
        text: `We could not complete your payment${
          // Continue the surrounding logic with this statement.
          payload.reason ? ` (${payload.reason})` : ''
        // Continue the surrounding logic with this statement.
        }. Please try again or contact support.`,
        // Provide the html field value.
        html: `<p>We could not complete your payment${
          // Continue the surrounding logic with this statement.
          payload.reason ? ` (<code>${escapeHtml(payload.reason)}</code>)` : ''
        // Continue the surrounding logic with this statement.
        }. Please try again or contact support.</p>`,
      };
    // Handle this discrete switch case.
    case 'pickup_reminder':
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: 'LuxRide pickup reminder',
        // Provide the text field value.
        text: `Reminder: your pickup is soon.\n\n${summary}`,
        // Provide the html field value.
        html: `<p>Reminder: your pickup is soon.</p><pre>${summaryHtml}</pre>`,
      };
    // Handle this discrete switch case.
    case 'return_reminder':
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: 'LuxRide return reminder',
        // Provide the text field value.
        text: `Reminder: your return is soon.\n\n${summary}`,
        // Provide the html field value.
        html: `<p>Reminder: your return is soon.</p><pre>${summaryHtml}</pre>`,
      };
    // Handle this discrete switch case.
    case 'abandoned_checkout_reminder':
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: 'Complete your LuxRide booking',
        // Provide the text field value.
        text: `You still have a pending car hold. Complete checkout before it expires.\n\n${summary}`,
        // Provide the html field value.
        html: `<p>You still have a pending car hold. Complete checkout before it expires.</p><pre>${summaryHtml}</pre>`,
      };
    // Handle this discrete switch case.
    case 'expiring_insurance_alert':
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: `Insurance expiring — ${carLabel}`,
        // Provide the text field value.
        text: `Insurance/compliance item "${payload.itemTitle || payload.itemType}" expires on ${payload.expiresAt}.`,
        // Provide the html field value.
        html: `<p>Insurance/compliance item <strong>${escapeHtml(payload.itemTitle || payload.itemType)}</strong> expires on <strong>${escapeHtml(payload.expiresAt)}</strong>.</p>`,
      };
    // Handle this discrete switch case.
    case 'maintenance_reminder':
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: `Maintenance reminder — ${carLabel}`,
        // Provide the text field value.
        text: `Maintenance block scheduled ${payload.startDate} → ${payload.endDate}. ${payload.reason || ''}`,
        // Provide the html field value.
        html: `<p>Maintenance block scheduled <strong>${escapeHtml(payload.startDate)}</strong> → <strong>${escapeHtml(payload.endDate)}</strong>.</p>`,
      };
    // Handle this discrete switch case.
    case 'paid_but_not_confirmed_alert':
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: `Paid but not confirmed — reservation #${escapeMailHeader(payload.reservationId)}`,
        // Provide the text field value.
        text: `Reservation #${payload.reservationId} is paid but not confirmed. Customer: ${payload.email || 'n/a'}`,
        // Provide the html field value.
        html: `<p>Reservation <strong>#${escapeHtml(payload.reservationId)}</strong> is paid but not confirmed.</p>`,
      };
    // Handle the default switch path.
    default:
      // Return the resulting value to the caller.
      return {
        // Provide the subject field value.
        subject: `LuxRide notification — ${escapeMailHeader(notification.type)}`,
        // Provide the text field value.
        text: JSON.stringify(payload, null, 2),
        // Provide the html field value.
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
    // Return the resulting value to the caller.
    return { sent: false, reason: 'unsupported_channel' };
  }
  // Evaluate the condition and enter the branch when it is true.
  if (!notification.recipientEmail) {
    // Return the resulting value to the caller.
    return { sent: false, reason: 'missing_recipient' };
  }

  // Create the content constant.
  const content = renderNotification(notification);
  // Create the result constant.
  const result = await sendMail({
    // Provide the to field value.
    to: notification.recipientEmail,
    // Provide the subject field value.
    subject: content.subject,
    // Provide the text field value.
    text: content.text,
    // Provide the html field value.
    html: content.html,
  });

  // Call logEvent.info to perform this step.
  logEvent.info('notification.email.attempt', {
    // Provide the type field value.
    type: notification.type,
    // Provide the notification id field value.
    notificationId: notification.id,
    // Provide the sent field value.
    sent: result.sent,
    // Provide the reason field value.
    reason: result.reason || null,
  });

  // Treat missing SMTP as soft success so cron does not endlessly retry in local/dev.
  if (!result.sent && result.reason === 'smtp_not_configured') {
    // Call logger.info to perform this step.
    logger.info(
      // Contribute this line to the enclosing declaration or statement.
      { notificationId: notification.id, type: notification.type },
      // Continue the surrounding logic with this statement.
      'Notification marked sent (SMTP not configured)'
    );
    // Return the resulting value to the caller.
    return { sent: true, reason: 'smtp_not_configured_soft' };
  }

  // Return the resulting value to the caller.
  return result;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  renderNotification,
  // Contribute this line to the enclosing declaration or statement.
  sendNotificationEmail,
  // Contribute this line to the enclosing declaration or statement.
  buildBookingSummary,
};
