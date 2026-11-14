/**
 * B3: concurrent calendar moves of the same reservation must not leave a ghost
 * booking block (a block that no longer matches the reservation range).
 */
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const { loginAsAdmin, withCsrf } = require('../helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertLinkedBooking,
  getReservationById,
  getDateBlocksForCar,
  cleanupTestCar,
} = require('../helpers/dbFixtures');
const { waitUntilAdvisoryLockWaiters, ADVISORY_LOCK_NS } = require('../helpers/lockBarrier');
const { pool } = require('../../helpers/dbTestHarness');
const { acquireCarAdvisoryLock } = require('../../../src/db/transaction');
const { parseSofiaDate } = require('../../../src/utils/date/timezone');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function moveCalendarReservation(admin, reservationId, range) {
  return Promise.resolve(
    withCsrf(
      admin,
      admin.patch(`/api/admin/calendar/events/reservation:${reservationId}/move`)
    ).send({
      start: parseSofiaDate(range.pickupDate, '10:00').toISOString(),
      end: parseSofiaDate(range.returnDate, '10:00').toISOString(),
    })
  );
}

function expectSingleBlockMatchesReservation(blocks, reservation) {
  expect(blocks).toHaveLength(1);
  expect(new Date(blocks[0].start_date).getTime()).toBe(
    new Date(reservation.pickup_date).getTime()
  );
  expect(new Date(blocks[0].end_date).getTime()).toBe(
    new Date(reservation.return_date).getTime()
  );
}

describeIf('B3: calendarConcurrentMoves', () => {
  jest.setTimeout(60_000);

  let app;
  let carId;

  const ORIGINAL = { pickupDate: '2031-07-01', returnDate: '2031-07-04' };
  const RANGE_1 = { pickupDate: '2031-08-01', returnDate: '2031-08-04' };
  const RANGE_2 = { pickupDate: '2031-09-01', returnDate: '2031-09-04' };

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'B3 Concurrent Moves Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  async function seed() {
    return insertLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      ...ORIGINAL,
      pickupTime: '10:00',
      returnTime: '10:00',
      guest: { email: `b3-${Date.now()}@example.com`, fullName: 'B3 Guest' },
    });
  }

  test('control: sequential moves leave exactly one block matching the final range', async () => {
    const seeded = await seed();
    const admin = await loginAsAdmin(app);

    expect((await moveCalendarReservation(admin, seeded.reservationId, RANGE_1)).status).toBe(200);
    expect((await moveCalendarReservation(admin, seeded.reservationId, RANGE_2)).status).toBe(200);

    const reservation = await getReservationById(seeded.reservationId);
    expectSingleBlockMatchesReservation(await getDateBlocksForCar(carId), reservation);
    expect(new Date(reservation.pickup_date).getTime()).toBe(
      parseSofiaDate(RANGE_2.pickupDate, '10:00').getTime()
    );
  });

  test('concurrent moves to two different ranges leave no ghost block', async () => {
    const seeded = await seed();
    const adminA = await loginAsAdmin(app);
    const adminB = await loginAsAdmin(app);

    const holder = await pool.connect();
    let results;
    try {
      await holder.query('BEGIN');
      await acquireCarAdvisoryLock(holder, carId);

      // Both requests pass their pre-lock reads against the ORIGINAL range, then queue on the lock.
      const p1 = moveCalendarReservation(adminA, seeded.reservationId, RANGE_1);
      const p2 = moveCalendarReservation(adminB, seeded.reservationId, RANGE_2);
      await waitUntilAdvisoryLockWaiters(ADVISORY_LOCK_NS.CAR, carId, 2);

      await holder.query('COMMIT');
      results = await Promise.all([p1, p2]);
    } finally {
      try {
        await holder.query('ROLLBACK');
      } catch {
        // already committed
      }
      holder.release();
    }

    for (const res of results) {
      expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    }

    const reservation = await getReservationById(seeded.reservationId);
    const blocks = await getDateBlocksForCar(carId);

    // Reservation landed on exactly one of the two requested ranges.
    const pickupMs = new Date(reservation.pickup_date).getTime();
    expect([
      parseSofiaDate(RANGE_1.pickupDate, '10:00').getTime(),
      parseSofiaDate(RANGE_2.pickupDate, '10:00').getTime(),
    ]).toContain(pickupMs);

    // No ghost: single booking block, equal to the reservation range, none left at ORIGINAL.
    expectSingleBlockMatchesReservation(blocks, reservation);
    expect(blocks[0].block_type).toBe('booking');
    const originalStartMs = parseSofiaDate(ORIGINAL.pickupDate, '10:00').getTime();
    expect(blocks.some((b) => new Date(b.start_date).getTime() === originalStartMs)).toBe(false);
  });
});
