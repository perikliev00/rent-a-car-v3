const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { loginAsAdmin, withCsrf } = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertLinkedBooking,
  getReservationById,
  getDateBlocksForCar,
  cleanupTestCar,
} = require('./helpers/dbFixtures');
const {
  getSofiaIsoDateString,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  parseSofiaDate,
} = require('../../src/utils/date/timezone');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function toSofiaIso(date, time) {
  const parsed = parseSofiaDate(date, time);
  if (!parsed) {
    throw new Error(`toSofiaIso: invalid Sofia date/time ${date} ${time}`);
  }
  return parsed.toISOString();
}

function assertDateBlockCovers(blocks, startIso, endIso) {
  const covers = blocks.some((block) => {
    const blockStartDay = getSofiaIsoDateString(new Date(block.start_date));
    const blockEndDay = getSofiaIsoDateString(new Date(block.end_date));
    return blockStartDay <= startIso && blockEndDay >= endIso;
  });
  expect(covers).toBe(true);
}

async function resizeCalendarEvent(admin, reservationId, body) {
  return withCsrf(
    admin,
    admin.patch(`/api/admin/calendar/events/reservation:${reservationId}/resize`)
  ).send({
    start: body.start,
    end: body.end,
    carId: body.carId != null ? Number(body.carId) : undefined,
    force: body.force ?? false,
  });
}

describeIf('ADMIN-008: calendarResizeReservation', () => {
  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Cal Resize Car', price: 55 });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('API resize extends return date and increases total price', async () => {
    const pickupDate = '2031-06-01';
    const returnDate = '2031-06-04';
    const pickupTime = '10:00';
    const returnTime = '10:00';

    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      dayPrice: 55,
      guest: { email: `cal-resize-${Date.now()}@example.com`, fullName: 'Cal Resize Guest' },
    });

    const before = await getReservationById(seeded.reservationId);
    const totalBefore = Number(before.total_price);

    const longerReturn = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(returnDate, '00:00'), 2)
    );

    const admin = await loginAsAdmin(app);
    const result = await resizeCalendarEvent(admin, seeded.reservationId, {
      start: toSofiaIso(pickupDate, pickupTime),
      end: toSofiaIso(longerReturn, returnTime),
      carId,
    });
    expect(result.status).toBe(200);

    const after = await getReservationById(seeded.reservationId);
    expect(getSofiaIsoDateString(new Date(after.pickup_date))).toBe(pickupDate);
    expect(getSofiaIsoDateString(new Date(after.return_date))).toBe(longerReturn);
    expect(Number(after.total_price)).toBeGreaterThan(totalBefore);
    const snapshotTotal = Number(after.price_snapshot?.totalPrice ?? 0);
    expect(snapshotTotal).toBe(Number(after.total_price));
    expect(snapshotTotal).toBeGreaterThan(totalBefore);

    assertDateBlockCovers(await getDateBlocksForCar(carId), pickupDate, longerReturn);
  });

  test('API resize shorter stay decreases total price', async () => {
    const pickupDate = '2031-07-01';
    const returnDate = '2031-07-06';
    const pickupTime = '10:00';
    const returnTime = '10:00';

    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      dayPrice: 55,
      guest: {
        email: `cal-resize-short-${Date.now()}@example.com`,
        fullName: 'Cal Resize Short',
      },
    });

    const before = await getReservationById(seeded.reservationId);
    const totalBefore = Number(before.total_price);

    const shorterReturn = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(pickupDate, '00:00'), 2)
    );

    const admin = await loginAsAdmin(app);
    const result = await resizeCalendarEvent(admin, seeded.reservationId, {
      start: toSofiaIso(pickupDate, pickupTime),
      end: toSofiaIso(shorterReturn, returnTime),
      carId,
    });
    expect(result.status).toBe(200);

    const after = await getReservationById(seeded.reservationId);
    expect(getSofiaIsoDateString(new Date(after.return_date))).toBe(shorterReturn);
    expect(Number(after.total_price)).toBeLessThan(totalBefore);
    assertDateBlockCovers(await getDateBlocksForCar(carId), pickupDate, shorterReturn);
  });
});
