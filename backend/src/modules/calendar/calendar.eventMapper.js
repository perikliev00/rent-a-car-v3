const { TERMINAL_STATUSES } = require('../../domain/reservationStatus');

const CLEANING_BUFFER_HOURS = 2;

function eventId(type, id) {
  return `${type}:${id}`;
}

function parseEventId(raw) {
  const value = String(raw || '');
  const idx = value.indexOf(':');
  if (idx <= 0) return null;
  const type = value.slice(0, idx);
  const id = value.slice(idx + 1);
  if (!type || !id) return null;
  return { type, id };
}

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
