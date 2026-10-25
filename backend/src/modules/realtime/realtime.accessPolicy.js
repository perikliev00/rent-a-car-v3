/**
 * Authorization for live and replayed admin SSE events.
 * The same decision is used for both so a reconnect cannot reveal more than
 * the live stream.
 */

const RESERVATION_EVENT_TYPES = new Set([
  'new_booking',
  'payment_succeeded',
  'payment_failed',
  'reservation_confirmed',
  'car_returned',
  'manual_review_needed',
  'paid_but_not_confirmed',
  'reservation_updated',
]);

/**
 * @param {object|null|undefined} access
 * @param {string} permission
 * @returns {boolean}
 */
function hasPermission(access, permission) {
  if (!access) return false;
  if ((access.roles || []).includes('owner')) return true;
  return (access.permissions || []).includes(permission);
}

/**
 * @param {object|null|undefined} access
 * @param {object|null|undefined} event
 * @returns {{ allow: boolean, redact: boolean }}
 */
function authorizeLiveEvent(access, event) {
  if (!access || !event || !event.type) return { allow: false, redact: true };

  if (event.type === 'calendar_updated') {
    if (
      hasPermission(access, 'can_view_calendar') ||
      hasPermission(access, 'can_view_reservations_ops')
    ) {
      return { allow: true, redact: true };
    }
    const assignee = event.meta?.assignedToUserId ?? event.meta?.assigneeUserId ?? null;
    if (
      hasPermission(access, 'can_view_own_calendar_tasks') &&
      assignee != null &&
      String(assignee) === String(access.userId)
    ) {
      return { allow: true, redact: true };
    }
    return { allow: false, redact: true };
  }

  if (RESERVATION_EVENT_TYPES.has(event.type)) {
    if (hasPermission(access, 'can_view_reservations_ops')) {
      return { allow: true, redact: false };
    }
    return { allow: false, redact: true };
  }

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
  const meta = event && event.meta && typeof event.meta === 'object' ? event.meta : {};
  return {
    ...event,
    customerName: null,
    meta: {
      action: meta.action ?? null,
      entityType: meta.entityType ?? null,
      entityId: meta.entityId ?? null,
      assignedToUserId: meta.assignedToUserId ?? null,
    },
  };
}

/**
 * @param {object|null|undefined} access
 * @returns {string}
 */
function authFingerprint(access) {
  const roles = [...(access?.roles || [])].map(String).sort().join(',');
  const permissions = [...(access?.permissions || [])].map(String).sort().join(',');
  return `${access?.userId ?? ''}|${roles}|${permissions}`;
}

module.exports = {
  RESERVATION_EVENT_TYPES,
  authorizeLiveEvent,
  redactLiveEvent,
  authFingerprint,
};
