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
  // Return the resulting value to the caller.
  return `${type}:${id}`;
}

/**
 * Parse `type:id` event ids from the client.
 * @param {string} raw
 * @returns {{ type: string, id: string }|null}
 */
function parseEventId(raw) {
  // Create the value constant.
  const value = String(raw || '');
  // Create the idx constant.
  const idx = value.indexOf(':');
  // Evaluate the condition and enter the branch when it is true.
  if (idx <= 0) return null;
  // Create the type constant.
  const type = value.slice(0, idx);
  // Create the id constant.
  const id = value.slice(idx + 1);
  // Evaluate the condition and enter the branch when it is true.
  if (!type || !id) return null;
  // Return the resulting value to the caller.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!row || TERMINAL_STATUSES.includes(row.status)) {
    // Return the resulting value to the caller.
    return [];
  }

  // Create the events constant.
  const events = [
    {
      // Provide the id field value.
      id: eventId('reservation', row.id),
      // Provide the type field value.
      type: 'reservation',
      // Provide the car id field value.
      carId: String(row.car_id),
      // Provide the start field value.
      start: row.pickup_date,
      // Provide the end field value.
      end: row.return_date,
      // Provide the title field value.
      title: row.full_name || row.email || `Reservation #${row.id}`,
      // Provide the status field value.
      status: row.status,
      // Provide the reservation id field value.
      reservationId: String(row.id),
      // Provide the meta field value.
      meta: {
        // Provide the email field value.
        email: row.email || null,
        // Provide the phone number field value.
        phoneNumber: row.phone_number || null,
        // Provide the pickup location field value.
        pickupLocation: row.pickup_location,
        // Provide the return location field value.
        returnLocation: row.return_location,
        // Provide the total price field value.
        totalPrice: row.total_price != null ? Number(row.total_price) : null,
        // Provide the car name field value.
        carName: row.car_name || null,
      },
    },
  ];

  // Evaluate the condition and enter the branch when it is true.
  if (includeMarkers) {
    // Call events.push to perform this step.
    events.push(
      {
        // Provide the id field value.
        id: eventId('pickup', row.id),
        // Provide the type field value.
        type: 'pickup',
        // Provide the car id field value.
        carId: String(row.car_id),
        // Provide the start field value.
        start: row.pickup_date,
        // Provide the end field value.
        end: row.pickup_date,
        // Provide the title field value.
        title: `Pickup · ${row.full_name || `#${row.id}`}`,
        // Provide the status field value.
        status: row.status,
        // Provide the reservation id field value.
        reservationId: String(row.id),
        // Provide the meta field value.
        meta: { pickupLocation: row.pickup_location },
      },
      {
        // Provide the id field value.
        id: eventId('return', row.id),
        // Provide the type field value.
        type: 'return',
        // Provide the car id field value.
        carId: String(row.car_id),
        // Provide the start field value.
        start: row.return_date,
        // Provide the end field value.
        end: row.return_date,
        // Provide the title field value.
        title: `Return · ${row.full_name || `#${row.id}`}`,
        // Provide the status field value.
        status: row.status,
        // Provide the reservation id field value.
        reservationId: String(row.id),
        // Provide the meta field value.
        meta: { returnLocation: row.return_location },
      }
    );
  }

  // Surface ops attention states as separate overlay events.
  if (row.status === 'manual_review') {
    // Call events.push to perform this step.
    events.push({
      // Provide the id field value.
      id: eventId('manual_review', row.id),
      // Provide the type field value.
      type: 'manual_review',
      // Provide the car id field value.
      carId: String(row.car_id),
      // Provide the start field value.
      start: row.pickup_date,
      // Provide the end field value.
      end: row.return_date,
      // Provide the title field value.
      title: `Manual review · #${row.id}`,
      // Provide the status field value.
      status: row.status,
      // Provide the reservation id field value.
      reservationId: String(row.id),
      // Provide the meta field value.
      meta: {},
    });
  }

  // Evaluate the condition and enter the branch when it is true.
  if (row.status === 'paid') {
    // Call events.push to perform this step.
    events.push({
      // Provide the id field value.
      id: eventId('payment_issue', row.id),
      // Provide the type field value.
      type: 'payment_issue',
      // Provide the car id field value.
      carId: String(row.car_id),
      // Provide the start field value.
      start: row.pickup_date,
      // Provide the end field value.
      end: row.return_date,
      // Provide the title field value.
      title: `Paid not confirmed · #${row.id}`,
      // Provide the status field value.
      status: row.status,
      // Provide the reservation id field value.
      reservationId: String(row.id),
      // Provide the meta field value.
      meta: {},
    });
  }

  // Return the resulting value to the caller.
  return events;
}

/**
 * Map a car_date_blocks row. Booking-type blocks are omitted (derived from reservations).
 * @param {object} row
 * @returns {object|null}
 */
function mapBlockEvent(row) {
  // Evaluate the condition and enter the branch when it is true.
  if (!row || row.block_type === 'booking') return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: eventId('blocked', row.id),
    // Provide the type field value.
    type: 'blocked',
    // Provide the car id field value.
    carId: String(row.car_id),
    // Provide the start field value.
    start: row.start_date,
    // Provide the end field value.
    end: row.end_date,
    // Provide the title field value.
    title: row.reason || `Block (${row.block_type})`,
    // Provide the status field value.
    status: row.block_type,
    // Provide the meta field value.
    meta: {
      // Provide the block type field value.
      blockType: row.block_type,
      // Provide the notes field value.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!row || row.status === 'cancelled') return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: eventId('task', row.id),
    // Provide the type field value.
    type: 'task',
    // Provide the car id field value.
    carId: row.car_id != null ? String(row.car_id) : null,
    // Provide the start field value.
    start: row.starts_at || row.due_at,
    // Provide the end field value.
    end: row.due_at || row.starts_at,
    // Provide the title field value.
    title: row.title,
    // Provide the status field value.
    status: row.status,
    // Provide the reservation id field value.
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    // Provide the meta field value.
    meta: {
      // Provide the task type field value.
      taskType: row.task_type,
      // Provide the assigned to user id field value.
      assignedToUserId: row.assigned_to_user_id != null ? String(row.assigned_to_user_id) : null,
      // Provide the location text field value.
      locationText: row.location_text || null,
      // Provide the notes field value.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!car || car.status !== 'in_maintenance') return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: eventId('maintenance', car.id),
    // Provide the type field value.
    type: 'maintenance',
    // Provide the car id field value.
    carId: String(car.id),
    // Provide the start field value.
    start: rangeFrom,
    // Provide the end field value.
    end: rangeTo,
    // Provide the title field value.
    title: `${car.name || 'Car'} · maintenance`,
    // Provide the status field value.
    status: 'in_maintenance',
    // Provide the meta field value.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!car || car.status !== 'needs_cleaning') return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: eventId('cleaning', car.id),
    // Provide the type field value.
    type: 'cleaning',
    // Provide the car id field value.
    carId: String(car.id),
    // Provide the start field value.
    start: rangeFrom,
    // Provide the end field value.
    end: rangeTo,
    // Provide the title field value.
    title: `${car.name || 'Car'} · needs cleaning`,
    // Provide the status field value.
    status: 'needs_cleaning',
    // Provide the meta field value.
    meta: { carStatus: car.status },
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  CLEANING_BUFFER_HOURS,
  // Contribute this line to the enclosing declaration or statement.
  eventId,
  // Contribute this line to the enclosing declaration or statement.
  parseEventId,
  // Contribute this line to the enclosing declaration or statement.
  mapReservationEvents,
  // Contribute this line to the enclosing declaration or statement.
  mapBlockEvent,
  // Contribute this line to the enclosing declaration or statement.
  mapTaskEvent,
  // Contribute this line to the enclosing declaration or statement.
  mapMaintenanceEvent,
  // Contribute this line to the enclosing declaration or statement.
  mapCleaningStatusEvent,
};
