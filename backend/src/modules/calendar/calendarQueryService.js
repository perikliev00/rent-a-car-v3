/**
 * Calendar read/query application service.
 *
 * Aggregates reservations, blocks, tasks, and car-status bands for a scoped
 * car set. VIEW_OWN users only see their tasks (no fleet reservations/blocks).
 * Phone numbers are redacted without VIEW_PHONE.
 */

const repo = require('./calendar.repository');
const mapper = require('./calendar.eventMapper');
const conflictEngine = require('./calendar.conflictEngine');
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
const rbacService = require('../../services/rbac/rbacService');
const { getSofiaIsoDateString } = require('../../utils/date/timezone');
const { createHttpError, parseRange } = require('./calendar.shared');
const { resolveScope } = require('./calendarAccessPolicy');

/**
 * Load calendar events for a date range and optional filters.
 * @param {object} opts
 * @param {object} opts.access
 * @param {string|Date} opts.from
 * @param {string|Date} opts.to
 * @param {object} [opts.filters]
 * @param {string} [opts.density='timeline'] Month density omits pickup/return markers
 */
async function getEvents({ access, from, to, filters = {}, density = 'timeline' }) {
  const { start, end } = parseRange(from, to);
  // Scope cars by RBAC + filters; VIEW_OWN yields ownOnly without fleet rows.
  const { ownOnly, cars, carIds } = await resolveScope(access, start, end, filters);
  if (cars.length === 0) {
    return { cars: [], events: [], density };
  }

  // Month density omits pickup/return marker events to reduce clutter.
  const includeMarkers = density !== 'month';
  // VIEW_OWN: tasks only; managers: reservations + blocks + tasks in parallel.
  const [reservations, blocks, tasks] = await Promise.all([
    ownOnly
      ? []
      : repo.listReservationsInRange({
          from: start,
          to: end,
          carIds,
          statuses: filters.reservationStatus ? [filters.reservationStatus] : null,
        }),
    ownOnly ? [] : repo.listManualBlocksInRange({ from: start, to: end, carIds }),
    repo.listTasksInRange({
      from: start,
      to: end,
      carIds,
      assignedToUserId: ownOnly ? access.userId : filters.staffUserId || null,
    }),
  ]);

  // Map DB rows → calendar event DTOs.
  let events = [];
  for (const row of reservations) {
    events.push(...mapper.mapReservationEvents(row, { includeMarkers }));
  }
  for (const row of blocks) {
    const ev = mapper.mapBlockEvent(row);
    if (ev) events.push(ev);
  }
  for (const row of tasks) {
    const ev = mapper.mapTaskEvent(row);
    if (ev) events.push(ev);
  }

  // Synthetic car-status bands (maintenance / needs_cleaning) for full fleet views.
  if (!ownOnly) {
    for (const car of cars) {
      const m = mapper.mapMaintenanceEvent(car, start, end);
      if (m) events.push(m);
      const c = mapper.mapCleaningStatusEvent(car, start, end);
      if (c) events.push(c);
    }
  }

  if (filters.eventType) {
    events = events.filter((e) => e.type === filters.eventType);
  }

  // Redact phone numbers without VIEW_PHONE.
  const canPhone = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_PHONE);
  if (!canPhone) {
    events = events.map((e) => {
      if (e.meta?.phoneNumber) {
        return { ...e, meta: { ...e.meta, phoneNumber: null } };
      }
      return e;
    });
  }

  return { cars, events, density, from: start, to: end };
}

/**
 * Day-ops board: pickups/returns, free/busy cars, insurance warnings.
 * Day bounds use Sofia (+03:00) to match fleet local operations.
 * @param {object} access
 * @param {string} date YYYY-MM-DD
 */
async function getDay(access, date) {
  // Day bounds use Sofia (+03:00) so ops match local fleet day.
  const dateIso = String(date || getSofiaIsoDateString());
  const dayStart = new Date(`${dateIso}T00:00:00+03:00`);
  const dayEnd = new Date(`${dateIso}T23:59:59+03:00`);
  const { ownOnly, cars } = await resolveScope(access, dayStart, dayEnd, {});
  // VIEW_OWN skips reservation sections and insurance warnings.
  const sections = ownOnly
    ? { pickups: [], returns: [], paidNotConfirmed: [] }
    : await repo.getDayReservationSections(dateIso);
  const insuranceWarnings = ownOnly ? [] : await repo.listInsuranceWarnings(dateIso);

  // Busy = has pickup or return on this day (by car_id).
  const busyCarIds = new Set([
    ...sections.pickups.map((r) => String(r.car_id)),
    ...sections.returns.map((r) => String(r.car_id)),
  ]);

  const freeCars = cars.filter((c) => !busyCarIds.has(c.id) && c.status === 'available');
  const busyCars = cars.filter(
    (c) => busyCarIds.has(c.id) || ['rented', 'reserved'].includes(c.status)
  );
  const maintenance = cars.filter((c) => c.status === 'in_maintenance');
  const cleaning = cars.filter((c) => c.status === 'needs_cleaning');

  const canPhone = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_PHONE);
  // Normalize reservation rows for the day board; redact phone without VIEW_PHONE.
  const redact = (rows) =>
    rows.map((r) => ({
      id: String(r.id),
      carId: String(r.car_id),
      status: r.status,
      pickupDate: r.pickup_date,
      returnDate: r.return_date,
      fullName: r.full_name,
      email: r.email,
      phoneNumber: canPhone ? r.phone_number || null : null,
      carName: r.car_name,
      carStatus: r.car_status || null,
    }));

  return {
    date: dateIso,
    cars,
    freeCars,
    busyCars,
    maintenance,
    cleaning,
    pickups: redact(sections.pickups),
    returns: redact(sections.returns),
    paidNotConfirmed: redact(sections.paidNotConfirmed),
    insuranceWarnings: insuranceWarnings.map((c) => ({
      id: String(c.id),
      name: c.name,
      insuranceExpiry: c.insurance_expiry,
      technicalInspectionExpiry: c.technical_inspection_expiry,
      status: c.status,
    })),
    // Aggregated problem list for the day-ops UI.
    problems: [
      ...maintenance.map((c) => ({ type: 'maintenance', carId: c.id, label: c.name })),
      ...cleaning.map((c) => ({ type: 'cleaning', carId: c.id, label: c.name })),
      ...sections.paidNotConfirmed.map((r) => ({
        type: 'paid_not_confirmed',
        reservationId: String(r.id),
        label: r.full_name || `#${r.id}`,
      })),
    ],
  };
}

/**
 * Single-car timeline: same payload as getEvents filtered to one car in scope.
 * @param {object} access
 * @param {string|number} carId
 * @param {string|Date} from
 * @param {string|Date} to
 */
async function getCarTimeline(access, carId, from, to) {
  const result = await getEvents({ access, from, to, filters: {} });
  const car = result.cars.find((c) => c.id === String(carId));
  if (!car) {
    throw createHttpError('NOT_FOUND', 'Car not found or not in scope.', 404);
  }
  return {
    car,
    events: result.events.filter((e) => e.carId === String(carId)),
    from: result.from,
    to: result.to,
  };
}

/**
 * Preview conflicts for a car/range; blocked for VIEW_OWN-only users.
 * @param {object} access
 * @param {string|number} carId
 * @param {string|Date} from
 * @param {string|Date} to
 */
async function getAvailability(access, carId, from, to) {
  if (isOwnTasksOnly(access)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  const { start, end } = parseRange(from, to);
  const conflicts = await conflictEngine.collectRangeConflictsForRead({
    carId,
    start,
    end,
  });
  return {
    carId: String(carId),
    from: start,
    to: end,
    // Available when no severity=block conflicts remain.
    available: conflicts.filter((c) => c.severity === 'block').length === 0,
    conflicts,
  };
}

/**
 * Fleet-wide conflict scan across reservations in range (managers only).
 * @param {object} access
 * @param {string|Date} from
 * @param {string|Date} to
 */
async function getConflicts(access, from, to) {
  if (isOwnTasksOnly(access)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  const { start, end } = parseRange(from, to);
  const cars = await repo.listCarsForCalendar({});
  const all = [];
  const reservations = await repo.listReservationsInRange({ from: start, to: end });
  // Check each reservation against the conflict engine, excluding itself.
  for (const r of reservations) {
    const conflicts = await conflictEngine.collectRangeConflictsForRead({
      carId: r.car_id,
      start: r.pickup_date,
      end: r.return_date,
      excludeReservationId: r.id,
    });
    for (const c of conflicts) {
      all.push({
        ...c,
        reservationId: String(r.id),
        carId: String(r.car_id),
      });
    }
  }
  return { from: start, to: end, carCount: cars.length, conflicts: all };
}

module.exports = {
  getEvents,
  getDay,
  getCarTimeline,
  getAvailability,
  getConflicts,
};
