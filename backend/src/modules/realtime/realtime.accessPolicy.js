/**
 * Authorization for live and replayed admin SSE events.
 * The same decision is used for both so a reconnect cannot reveal more than
 * the live stream.
 */

const RESERVATION_EVENT_TYPES = new Set([
  // Supply the literal value used by the enclosing expression.
  'new_booking',
  // Supply the literal value used by the enclosing expression.
  'payment_succeeded',
  // Supply the literal value used by the enclosing expression.
  'payment_failed',
  // Supply the literal value used by the enclosing expression.
  'reservation_confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_returned',
  // Supply the literal value used by the enclosing expression.
  'manual_review_needed',
  // Supply the literal value used by the enclosing expression.
  'paid_but_not_confirmed',
  // Supply the literal value used by the enclosing expression.
  'reservation_updated',
]);

/**
 * @param {object|null|undefined} access
 * @param {string} permission
 * @returns {boolean}
 */
function hasPermission(access, permission) {
  // Evaluate the condition and enter the branch when it is true.
  if (!access) return false;
  // Evaluate the condition and enter the branch when it is true.
  if ((access.roles || []).includes('owner')) return true;
  // Return the resulting value to the caller.
  return (access.permissions || []).includes(permission);
}

/**
 * @param {object|null|undefined} access
 * @param {object|null|undefined} event
 * @returns {{ allow: boolean, redact: boolean }}
 */
function authorizeLiveEvent(access, event) {
  // Evaluate the condition and enter the branch when it is true.
  if (!access || !event || !event.type) return { allow: false, redact: true };

  // Evaluate the condition and enter the branch when it is true.
  if (event.type === 'calendar_updated') {
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Call hasPermission to perform this step.
      hasPermission(access, 'can_view_calendar') ||
      // Call hasPermission to perform this step.
      hasPermission(access, 'can_view_reservations_ops')
    // Continue the surrounding logic with this statement.
    ) {
      // Return the resulting value to the caller.
      return { allow: true, redact: true };
    }
    // Create the assignee constant.
    const assignee = event.meta?.assignedToUserId ?? event.meta?.assigneeUserId ?? null;
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Call hasPermission to perform this step.
      hasPermission(access, 'can_view_own_calendar_tasks') &&
      // Continue the surrounding logic with this statement.
      assignee != null &&
      // Call String to perform this step.
      String(assignee) === String(access.userId)
    // Continue the surrounding logic with this statement.
    ) {
      // Return the resulting value to the caller.
      return { allow: true, redact: true };
    }
    // Return the resulting value to the caller.
    return { allow: false, redact: true };
  }

  // Evaluate the condition and enter the branch when it is true.
  if (RESERVATION_EVENT_TYPES.has(event.type)) {
    // Evaluate the condition and enter the branch when it is true.
    if (hasPermission(access, 'can_view_reservations_ops')) {
      // Return the resulting value to the caller.
      return { allow: true, redact: false };
    }
    // Return the resulting value to the caller.
    return { allow: false, redact: true };
  }

  // Return the resulting value to the caller.
  return { allow: false, redact: true };
}

/**
 * Calendar invalidations keep only the ids a client needs to refetch through
 * the authorized HTTP API. Customer names and payment metadata are removed.
 *
 * @param {object} event
 * @returns {object}
 */
function redactLiveEvent(event) {
  // Create the meta constant.
  const meta = event && event.meta && typeof event.meta === 'object' ? event.meta : {};
  // Return the resulting value to the caller.
  return {
    // Spread event into the surrounding structure.
    ...event,
    // Provide the customer name field value.
    customerName: null,
    // Provide the meta field value.
    meta: {
      // Provide the action field value.
      action: meta.action ?? null,
      // Provide the entity type field value.
      entityType: meta.entityType ?? null,
      // Provide the entity id field value.
      entityId: meta.entityId ?? null,
      // Provide the assigned to user id field value.
      assignedToUserId: meta.assignedToUserId ?? null,
    },
  };
}

/**
 * @param {object|null|undefined} access
 * @returns {string}
 */
function authFingerprint(access) {
  // Create the roles constant.
  const roles = [...(access?.roles || [])].map(String).sort().join(',');
  // Create the permissions constant.
  const permissions = [...(access?.permissions || [])].map(String).sort().join(',');
  // Return the resulting value to the caller.
  return `${access?.userId ?? ''}|${roles}|${permissions}`;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_EVENT_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  authorizeLiveEvent,
  // Contribute this line to the enclosing declaration or statement.
  redactLiveEvent,
  // Contribute this line to the enclosing declaration or statement.
  authFingerprint,
};
