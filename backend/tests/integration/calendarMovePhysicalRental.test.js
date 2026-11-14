/**
 * B1: calendar must not reassign carId for a physically open rental
 * (picked_up / active_rental); the original car's booking block must stay.
 */
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const {
  createSessionAgent,
  loginAsAdmin,
  postOrder,
  postAdminReservationStatus,
  withCsrf,
} = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertLinkedBooking,
  cleanupTestCar,
  getReservationById,
  getDateBlocksForCar,
  buildOrderBody,
} = require('./helpers/dbFixtures');
const { parseSofiaDate } = require('../../src/utils/date/timezone');
const { pool } = require('../helpers/dbTestHarness');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

async function moveCalendarReservation(admin, reservationId, body) {
  return withCsrf(
    admin,
    admin.patch(`/api/admin/calendar/events/reservation:${reservationId}/move`)
  ).send(body);
}

async function advanceToStatus(admin, reservationId, statuses) {
  for (const status of statuses) {
    const res = await postAdminReservationStatus(admin, reservationId, {
      status,
      reason: `b1_advance_to_${status}`,
    });
    expect({ status: res.status, body: res.body, target: status }).toMatchObject({
      status: 200,
    });
  }
}

describeIf('B1: calendarMovePhysicalRental', () => {
  let app;
  let carA;
  let carB;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    carA = await insertIsolatedTestCar({ name: 'B1 Physical Car A' });
    carB = await insertIsolatedTestCar({ name: 'B1 Physical Car B' });
  });

  afterEach(async () => {
    await cleanupTestCar(carA);
    await cleanupTestCar(carB);
  });

  test.each(['picked_up', 'active_rental'])(
    'refuses car change while status is %s and keeps A blocked',
    async (physicalStatus) => {
      const pickupDate = '2031-07-01';
      const returnDate = '2031-07-04';
      const pickupTime = '10:00';
      const returnTime = '10:00';
      const start = parseSofiaDate(pickupDate, pickupTime);
      const end = parseSofiaDate(returnDate, returnTime);

      const seeded = await insertLinkedBooking({
        carId: carA,
        status: 'confirmed',
        withBlock: true,
        pickupDate,
        returnDate,
        pickupTime,
        returnTime,
        guest: {
          email: `b1-${physicalStatus}-${Date.now()}@example.com`,
          fullName: 'B1 Physical Guest',
        },
      });

      const admin = await loginAsAdmin(app);
      const path =
        physicalStatus === 'picked_up'
          ? ['car_prepared', 'picked_up']
          : ['car_prepared', 'picked_up', 'active_rental'];
      await advanceToStatus(admin, seeded.reservationId, path);

      const beforeBlocksA = await getDateBlocksForCar(carA);
      expect(beforeBlocksA).toHaveLength(1);
      const blockAId = Number(beforeBlocksA[0].id);

      const competitorBefore = await createSessionAgent(app);
      expect(
        (await postOrder(competitorBefore, buildOrderBody(carA, { pickupDate, returnDate }))).status
      ).toBe(409);

      const moveRes = await moveCalendarReservation(admin, seeded.reservationId, {
        start: start.toISOString(),
        end: end.toISOString(),
        carId: carB,
      });

      expect(moveRes.status).toBeGreaterThanOrEqual(400);

      const reservation = await getReservationById(seeded.reservationId);
      expect(Number(reservation.car_id)).toBe(carA);
      expect(reservation.status).toBe(physicalStatus);

      const afterBlocksA = await getDateBlocksForCar(carA);
      expect(afterBlocksA).toHaveLength(1);
      expect(Number(afterBlocksA[0].id)).toBe(blockAId);

      const blocksB = await getDateBlocksForCar(carB);
      expect(blocksB).toHaveLength(0);

      const order = await pool.query(
        `SELECT car_id, is_deleted FROM orders WHERE reservation_id = $1 AND is_deleted = FALSE`,
        [seeded.reservationId]
      );
      expect(Number(order.rows[0].car_id)).toBe(carA);

      const competitorAfter = await createSessionAgent(app);
      expect(
        (await postOrder(competitorAfter, buildOrderBody(carA, { pickupDate, returnDate }))).status
      ).toBe(409);
    }
  );

  test('control: confirmed reservation can move to another free car', async () => {
    const pickupDate = '2031-07-10';
    const returnDate = '2031-07-13';
    const pickupTime = '10:00';
    const returnTime = '10:00';
    const start = parseSofiaDate(pickupDate, pickupTime);
    const end = parseSofiaDate(returnDate, returnTime);

    const seeded = await insertLinkedBooking({
      carId: carA,
      status: 'confirmed',
      withBlock: true,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      guest: {
        email: `b1-control-${Date.now()}@example.com`,
        fullName: 'B1 Control Guest',
      },
    });

    const admin = await loginAsAdmin(app);
    const moveRes = await moveCalendarReservation(admin, seeded.reservationId, {
      start: start.toISOString(),
      end: end.toISOString(),
      carId: carB,
    });
    expect(moveRes.status).toBe(200);

    const reservation = await getReservationById(seeded.reservationId);
    expect(Number(reservation.car_id)).toBe(carB);
    expect(await getDateBlocksForCar(carA)).toHaveLength(0);
    expect(await getDateBlocksForCar(carB)).toHaveLength(1);

    const competitor = await createSessionAgent(app);
    expect(
      (await postOrder(competitor, buildOrderBody(carA, { pickupDate, returnDate }))).status
    ).toBe(200);
  });
});
