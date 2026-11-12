/**
 * Maps DB rows to unified calendar event DTOs for the UI timeline.
 *
 * Event ids use `type:id` so move/resize/detail handlers can parse identity.
 * Reservations expand into bar + optional pickup/return markers and alerts.
 */

const { TERMINAL_STATUSES } = require('../../domain/reservationStatus');

/** Hours required between one rental's return and the next pickup. */
const CLEANING_BUFFER_HOURS = 2;

/**
 * Compose a stable client event id.
 * @param {string} type
 * @param {string|number} id
 */
function eventId(type, id) {
  return `${type}:${id}`;
}

/**
 * Parse `type:id` event ids from the client.
 * @param {string} raw
 * @returns {{ type: string, id: string }|null}
 */
function parseEventId(raw) {
  const value = String(raw || '');
  const idx = value.indexOf(':');
  if (idx <= 0) return null;
  const type = value.slice(0, idx);
  const id = value.slice(idx + 1);
  if (!type || !id) return null;
  return { type, id };
}

/**
 * Map a reservation row to one or more calendar events (bar, markers, alerts).
 * Terminal statuses produce no events.
 * @param {object} row
 * @param {{ includeMarkers?: boolean }} [opts]
 * @returns {object[]}
 */
function mapReservationEvents(row, { includeMarkers = true } = {}) {
  if (!row || TERMINAL_STATUSES.includes(row.status)) {
    return [];
  }

  const events = [
    {
      id: eventId('reservation', row.id),
      type: 'reservation',
      carId: String(row.car_id),
      start: row.pickup_date,
      end: row.return_date,
      title: row.full_name || row.email || `Reservation #${row.id}`,
      status: row.status,
      reservationId: String(row.id),
      meta: {
        email: row.email || null,
        phoneNumber: row.phone_number || null,
        pickupLocation: row.pickup_location,
        returnLocation: row.return_location,
        totalPrice: row.total_price != null ? Number(row.total_price) : null,
        carName: row.car_name || null,
      },
    },
  ];

  if (includeMarkers) {
    events.push(
      {
        id: eventId('pickup', row.id),
        type: 'pickup',
        carId: String(row.car_id),
        start: row.pickup_date,
        end: row.pickup_date,
        title: `Pickup · ${row.full_name || `#${row.id}`}`,
        status: row.status,
        reservationId: String(row.id),
        meta: { pickupLocation: row.pickup_location },
      },
      {
        id: eventId('return', row.id),
        type: 'return',
        carId: String(row.car_id),
        start: row.return_date,
        end: row.return_date,
        title: `Return · ${row.full_name || `#${row.id}`}`,
        status: row.status,
        reservationId: String(row.id),
        meta: { returnLocation: row.return_location },
      }
    );
  }

  // Surface ops attention states as separate overlay events.
  if (row.status === 'manual_review') {
    events.push({
      id: eventId('manual_review', row.id),
      type: 'manual_review',
      carId: String(row.car_id),
      start: row.pickup_date,
      end: row.return_date,
      title: `Manual review · #${row.id}`,
      status: row.status,
      reservationId: String(row.id),
      meta: {},
    });
  }

  if (row.status === 'paid') {
    events.push({
      id: eventId('payment_issue', row.id),
      type: 'payment_issue',
      carId: String(row.car_id),
      start: row.pickup_date,
      end: row.return_date,
      title: `Paid not confirmed · #${row.id}`,
      status: row.status,
      reservationId: String(row.id),
      meta: {},
    });
  }

  return events;
}

/**
 * Map a car_date_blocks row. Booking-type blocks are omitted (derived from reservations).
 * @param {object} row
 * @returns {object|null}
 */
function mapBlockEvent(row) {
  if (!row || row.block_type === 'booking') return null;
  return {
    id: eventId('blocked', row.id),
    type: 'blocked',
    carId: String(row.car_id),
    start: row.start_date,
    end: row.end_date,
    title: row.reason || `Block (${row.block_type})`,
    status: row.block_type,
    meta: {
      blockType: row.block_type,
      notes: row.notes || null,
    },
  };
}

/**
 * Map an ops task row; cancelled tasks are hidden from the calendar.
 * @param {object} row
 * @returns {object|null}
 */
function mapTaskEvent(row) {
  if (!row || row.status === 'cancelled') return null;
  return {
    id: eventId('task', row.id),
    type: 'task',
    carId: row.car_id != null ? String(row.car_id) : null,
    start: row.starts_at || row.due_at,
    end: row.due_at || row.starts_at,
    title: row.title,
    status: row.status,
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    meta: {
      taskType: row.task_type,
      assignedToUserId: row.assigned_to_user_id != null ? String(row.assigned_to_user_id) : null,
      locationText: row.location_text || null,
      notes: row.notes || null,
    },
  };
}

/**
 * Full-range maintenance band when car status is in_maintenance.
 * @param {object} car
 * @param {Date|string} rangeFrom
 * @param {Date|string} rangeTo
 * @returns {object|null}
 */
function mapMaintenanceEvent(car, rangeFrom, rangeTo) {
  if (!car || car.status !== 'in_maintenance') return null;
  return {
    id: eventId('maintenance', car.id),
    type: 'maintenance',
    carId: String(car.id),
    start: rangeFrom,
    end: rangeTo,
    title: `${car.name || 'Car'} · maintenance`,
    status: 'in_maintenance',
    meta: { carStatus: car.status },
  };
}

/**
 * Full-range cleaning band when car status is needs_cleaning.
 * @param {object} car
 * @param {Date|string} rangeFrom
 * @param {Date|string} rangeTo
 * @returns {object|null}
 */
function mapCleaningStatusEvent(car, rangeFrom, rangeTo) {
  if (!car || car.status !== 'needs_cleaning') return null;
  return {
    id: eventId('cleaning', car.id),
    type: 'cleaning',
    carId: String(car.id),
    start: rangeFrom,
    end: rangeTo,
    title: `${car.name || 'Car'} · needs cleaning`,
    status: 'needs_cleaning',
    meta: { carStatus: car.status },
  };
}

module.exports = {
  CLEANING_BUFFER_HOURS,
  eventId,
  parseEventId,
  mapReservationEvents,
  mapBlockEvent,
  mapTaskEvent,
  mapMaintenanceEvent,
  mapCleaningStatusEvent,
};
