/**
 * Calendar read/query application service.
 *
 * Aggregates reservations, blocks, tasks, and car-status bands for a scoped
 * car set. VIEW_OWN users only see their tasks (no fleet reservations/blocks).
 * Phone numbers are redacted without VIEW_PHONE.
 */

const repo = require('./calendar.repository');
// Require the './calendar.eventMapper' module as mapper.
const mapper = require('./calendar.eventMapper');
// Require the './calendar.conflictEngine' module as conflictEngine.
const conflictEngine = require('./calendar.conflictEngine');
// Destructure object properties into local variables.
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
// Require the '../../services/rbac/rbacService' module as rbacService.
const rbacService = require('../../services/rbac/rbacService');
// Destructure object properties into local variables.
const { getSofiaIsoDateString } = require('../../utils/date/timezone');
// Destructure object properties into local variables.
const { createHttpError, parseRange } = require('./calendar.shared');
// Destructure object properties into local variables.
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
  // Destructure object properties into local variables.
  const { start, end } = parseRange(from, to);
  // Scope cars by RBAC + filters; VIEW_OWN yields ownOnly without fleet rows.
  const { ownOnly, cars, carIds } = await resolveScope(access, start, end, filters);
  // Evaluate the condition and enter the branch when it is true.
  if (cars.length === 0) {
    // Return the resulting value to the caller.
    return { cars: [], events: [], density };
  }

  // Month density omits pickup/return marker events to reduce clutter.
  const includeMarkers = density !== 'month';
  // VIEW_OWN: tasks only; managers: reservations + blocks + tasks in parallel.
  const [reservations, blocks, tasks] = await Promise.all([
    // Reference the identifier used by the enclosing expression.
    ownOnly
      // Contribute this line to the enclosing declaration or statement.
      ? []
      // Continue the surrounding logic with this statement.
      : repo.listReservationsInRange({
          // Provide the from field value.
          from: start,
          // Provide the to field value.
          to: end,
          // Contribute this line to the enclosing declaration or statement.
          carIds,
          // Provide the statuses field value.
          statuses: filters.reservationStatus ? [filters.reservationStatus] : null,
        }),
    // Continue the surrounding logic with this statement.
    ownOnly ? [] : repo.listManualBlocksInRange({ from: start, to: end, carIds }),
    // Call repo.listTasksInRange to perform this step.
    repo.listTasksInRange({
      // Provide the from field value.
      from: start,
      // Provide the to field value.
      to: end,
      // Contribute this line to the enclosing declaration or statement.
      carIds,
      // Provide the assigned to user id field value.
      assignedToUserId: ownOnly ? access.userId : filters.staffUserId || null,
    }),
  ]);

  // Map DB rows → calendar event DTOs.
  let events = [];
  // Iterate using the loop initializer, condition, and step.
  for (const row of reservations) {
    // Call events.push to perform this step.
    events.push(...mapper.mapReservationEvents(row, { includeMarkers }));
  }
  // Iterate using the loop initializer, condition, and step.
  for (const row of blocks) {
    // Create the ev constant.
    const ev = mapper.mapBlockEvent(row);
    // Evaluate the condition and enter the branch when it is true.
    if (ev) events.push(ev);
  }
  // Iterate using the loop initializer, condition, and step.
  for (const row of tasks) {
    // Create the ev constant.
    const ev = mapper.mapTaskEvent(row);
    // Evaluate the condition and enter the branch when it is true.
    if (ev) events.push(ev);
  }

  // Synthetic car-status bands (maintenance / needs_cleaning) for full fleet views.
  if (!ownOnly) {
    // Iterate using the loop initializer, condition, and step.
    for (const car of cars) {
      // Create the m constant.
      const m = mapper.mapMaintenanceEvent(car, start, end);
      // Evaluate the condition and enter the branch when it is true.
      if (m) events.push(m);
      // Create the c constant.
      const c = mapper.mapCleaningStatusEvent(car, start, end);
      // Evaluate the condition and enter the branch when it is true.
      if (c) events.push(c);
    }
  }

  // Evaluate the condition and enter the branch when it is true.
  if (filters.eventType) {
    // Update events with the right-hand side value.
    events = events.filter((e) => e.type === filters.eventType);
  }

  // Redact phone numbers without VIEW_PHONE.
  const canPhone = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_PHONE);
  // Evaluate the condition and enter the branch when it is true.
  if (!canPhone) {
    // Update events with the right-hand side value.
    events = events.map((e) => {
      // Evaluate the condition and enter the branch when it is true.
      if (e.meta?.phoneNumber) {
        // Return the resulting value to the caller.
        return { ...e, meta: { ...e.meta, phoneNumber: null } };
      }
      // Return the resulting value to the caller.
      return e;
    });
  }

  // Return the resulting value to the caller.
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
  // Create the day start constant.
  const dayStart = new Date(`${dateIso}T00:00:00+03:00`);
  // Create the day end constant.
  const dayEnd = new Date(`${dateIso}T23:59:59+03:00`);
  // Destructure object properties into local variables.
  const { ownOnly, cars } = await resolveScope(access, dayStart, dayEnd, {});
  // VIEW_OWN skips reservation sections and insurance warnings.
  const sections = ownOnly
    // Contribute this line to the enclosing declaration or statement.
    ? { pickups: [], returns: [], paidNotConfirmed: [] }
    // Continue the surrounding logic with this statement.
    : await repo.getDayReservationSections(dateIso);
  // Create the insurance warnings constant.
  const insuranceWarnings = ownOnly ? [] : await repo.listInsuranceWarnings(dateIso);

  // Busy = has pickup or return on this day (by car_id).
  const busyCarIds = new Set([
    // Call ...sections.pickups.map to perform this step.
    ...sections.pickups.map((r) => String(r.car_id)),
    // Call ...sections.returns.map to perform this step.
    ...sections.returns.map((r) => String(r.car_id)),
  ]);

  // Create the free cars constant.
  const freeCars = cars.filter((c) => !busyCarIds.has(c.id) && c.status === 'available');
  // Create the busy cars constant.
  const busyCars = cars.filter(
    // Continue the surrounding logic with this statement.
    (c) => busyCarIds.has(c.id) || ['rented', 'reserved'].includes(c.status)
  );
  // Create the maintenance constant.
  const maintenance = cars.filter((c) => c.status === 'in_maintenance');
  // Create the cleaning constant.
  const cleaning = cars.filter((c) => c.status === 'needs_cleaning');

  // Create the can phone constant.
  const canPhone = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.VIEW_PHONE);
  // Normalize reservation rows for the day board; redact phone without VIEW_PHONE.
  const redact = (rows) =>
    // Call rows.map to perform this step.
    rows.map((r) => ({
      // Provide the id field value.
      id: String(r.id),
      // Provide the car id field value.
      carId: String(r.car_id),
      // Provide the status field value.
      status: r.status,
      // Provide the pickup date field value.
      pickupDate: r.pickup_date,
      // Provide the return date field value.
      returnDate: r.return_date,
      // Provide the full name field value.
      fullName: r.full_name,
      // Provide the email field value.
      email: r.email,
      // Provide the phone number field value.
      phoneNumber: canPhone ? r.phone_number || null : null,
      // Provide the car name field value.
      carName: r.car_name,
      // Provide the car status field value.
      carStatus: r.car_status || null,
    }));

  // Return the resulting value to the caller.
  return {
    // Provide the date field value.
    date: dateIso,
    // Contribute this line to the enclosing declaration or statement.
    cars,
    // Contribute this line to the enclosing declaration or statement.
    freeCars,
    // Contribute this line to the enclosing declaration or statement.
    busyCars,
    // Contribute this line to the enclosing declaration or statement.
    maintenance,
    // Contribute this line to the enclosing declaration or statement.
    cleaning,
    // Provide the pickups field value.
    pickups: redact(sections.pickups),
    // Provide the returns field value.
    returns: redact(sections.returns),
    // Provide the paid not confirmed field value.
    paidNotConfirmed: redact(sections.paidNotConfirmed),
    // Provide the insurance warnings field value.
    insuranceWarnings: insuranceWarnings.map((c) => ({
      // Provide the id field value.
      id: String(c.id),
      // Provide the name field value.
      name: c.name,
      // Provide the insurance expiry field value.
      insuranceExpiry: c.insurance_expiry,
      // Provide the technical inspection expiry field value.
      technicalInspectionExpiry: c.technical_inspection_expiry,
      // Provide the status field value.
      status: c.status,
    })),
    // Aggregated problem list for the day-ops UI.
    problems: [
      // Call ...maintenance.map to perform this step.
      ...maintenance.map((c) => ({ type: 'maintenance', carId: c.id, label: c.name })),
      // Call ...cleaning.map to perform this step.
      ...cleaning.map((c) => ({ type: 'cleaning', carId: c.id, label: c.name })),
      // Call ...sections.paidNotConfirmed.map to perform this step.
      ...sections.paidNotConfirmed.map((r) => ({
        // Provide the type field value.
        type: 'paid_not_confirmed',
        // Provide the reservation id field value.
        reservationId: String(r.id),
        // Provide the label field value.
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
  // Create the result constant.
  const result = await getEvents({ access, from, to, filters: {} });
  // Create the car constant.
  const car = result.cars.find((c) => c.id === String(carId));
  // Evaluate the condition and enter the branch when it is true.
  if (!car) {
    // Throw an error to stop the current control flow.
    throw createHttpError('NOT_FOUND', 'Car not found or not in scope.', 404);
  }
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    car,
    // Provide the events field value.
    events: result.events.filter((e) => e.carId === String(carId)),
    // Provide the from field value.
    from: result.from,
    // Provide the to field value.
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
  // Evaluate the condition and enter the branch when it is true.
  if (isOwnTasksOnly(access)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Destructure object properties into local variables.
  const { start, end } = parseRange(from, to);
  // Create the conflicts constant.
  const conflicts = await conflictEngine.collectRangeConflictsForRead({
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    start,
    // Contribute this line to the enclosing declaration or statement.
    end,
  });
  // Return the resulting value to the caller.
  return {
    // Provide the car id field value.
    carId: String(carId),
    // Provide the from field value.
    from: start,
    // Provide the to field value.
    to: end,
    // Available when no severity=block conflicts remain.
    available: conflicts.filter((c) => c.severity === 'block').length === 0,
    // Contribute this line to the enclosing declaration or statement.
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
  // Evaluate the condition and enter the branch when it is true.
  if (isOwnTasksOnly(access)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Destructure object properties into local variables.
  const { start, end } = parseRange(from, to);
  // Create the cars constant.
  const cars = await repo.listCarsForCalendar({});
  // Create the all constant.
  const all = [];
  // Create the reservations constant.
  const reservations = await repo.listReservationsInRange({ from: start, to: end });
  // Check each reservation against the conflict engine, excluding itself.
  for (const r of reservations) {
    // Create the conflicts constant.
    const conflicts = await conflictEngine.collectRangeConflictsForRead({
      // Provide the car id field value.
      carId: r.car_id,
      // Provide the start field value.
      start: r.pickup_date,
      // Provide the end field value.
      end: r.return_date,
      // Provide the exclude reservation id field value.
      excludeReservationId: r.id,
    });
    // Iterate using the loop initializer, condition, and step.
    for (const c of conflicts) {
      // Call all.push to perform this step.
      all.push({
        // Spread c into the surrounding structure.
        ...c,
        // Provide the reservation id field value.
        reservationId: String(r.id),
        // Provide the car id field value.
        carId: String(r.car_id),
      });
    }
  }
  // Return the resulting value to the caller.
  return { from: start, to: end, carCount: cars.length, conflicts: all };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getEvents,
  // Contribute this line to the enclosing declaration or statement.
  getDay,
  // Contribute this line to the enclosing declaration or statement.
  getCarTimeline,
  // Contribute this line to the enclosing declaration or statement.
  getAvailability,
  // Contribute this line to the enclosing declaration or statement.
  getConflicts,
};
