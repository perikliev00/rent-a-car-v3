const repo = require('./calendar.repository');
const mapper = require('./calendar.eventMapper');
const conflictEngine = require('./calendar.conflictEngine');
const { CALENDAR_PERMISSIONS, isOwnTasksOnly } = require('./calendar.permissions');
const rbacService = require('../../services/rbac/rbacService');
const { getSofiaIsoDateString } = require('../../utils/date/timezone');
const { createHttpError, parseRange } = require('./calendar.shared');
const { resolveScope } = require('./calendarAccessPolicy');

async function getEvents({ access, from, to, filters = {}, density = 'timeline' }) {
  const { start, end } = parseRange(from, to);
  const { ownOnly, cars, carIds } = await resolveScope(access, start, end, filters);
  if (cars.length === 0) {
    return { cars: [], events: [], density };
  }

  const includeMarkers = density !== 'month';
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

async function getDay(access, date) {
  const dateIso = String(date || getSofiaIsoDateString());
  const dayStart = new Date(`${dateIso}T00:00:00+03:00`);
  const dayEnd = new Date(`${dateIso}T23:59:59+03:00`);
  const { ownOnly, cars } = await resolveScope(access, dayStart, dayEnd, {});
  const sections = ownOnly
    ? { pickups: [], returns: [], paidNotConfirmed: [] }
    : await repo.getDayReservationSections(dateIso);
  const insuranceWarnings = ownOnly ? [] : await repo.listInsuranceWarnings(dateIso);

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
    available: conflicts.filter((c) => c.severity === 'block').length === 0,
    conflicts,
  };
}

async function getConflicts(access, from, to) {
  if (isOwnTasksOnly(access)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  const { start, end } = parseRange(from, to);
  const cars = await repo.listCarsForCalendar({});
  const all = [];
  const reservations = await repo.listReservationsInRange({ from: start, to: end });
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
