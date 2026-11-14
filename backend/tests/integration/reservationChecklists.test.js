const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const {
  loginAsAdmin,
  postAdminReservationStatus,
  withCsrf,
} = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertLinkedBooking,
  getReservationById,
  getStatusHistory,
  cleanupTestCar,
} = require('./helpers/dbFixtures');
const refundOpSql = require('../../src/services/sql/refundOperationSqlService');
const { pool } = require('../helpers/dbTestHarness');
const {
  ADVISORY_LOCK_NS,
  waitUntilAdvisoryLockWaiters,
} = require('./helpers/lockBarrier');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

async function postChecklist(agent, reservationId, kind, fields) {
  let req = withCsrf(agent, agent.post(`/api/admin/reservations/${reservationId}/${kind}`));
  for (const [key, value] of Object.entries(fields)) {
    req = req.field(key, String(value));
  }
  return req;
}

const pickup = (agent, id, extra = {}) =>
  postChecklist(agent, id, 'pickup-checklist', {
    fuelLevel: 'full',
    mileage: 12345,
    ...extra,
  });

const ret = (agent, id, extra = {}) =>
  postChecklist(agent, id, 'return-checklist', {
    fuelLevel: 'half',
    mileage: 12500,
    ...extra,
  });

async function countRows(table, reservationId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ${table} WHERE reservation_id = $1`,
    [reservationId]
  );
  return r.rows[0].count;
}

async function getCarMileage(carId) {
  const r = await pool.query('SELECT mileage, fuel_level FROM cars WHERE id = $1', [carId]);
  return r.rows[0];
}

describeIf('OPS-P1: reservationChecklists', () => {
  let app;
  let admin;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
    admin = await loginAsAdmin(app);
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Checklist Car' });
  });

  afterEach(async () => {
    await pool.query(
      `DELETE FROM reservation_pickup_checklists
       WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)`,
      [carId]
    );
    await pool.query(
      `DELETE FROM reservation_return_checklists
       WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)`,
      [carId]
    );
    await pool.query('DELETE FROM car_damage_reports WHERE car_id = $1', [carId]);
    await cleanupTestCar(carId);
  });

  test('second pickup is refused while the first rental is still open', async () => {
    const first = await insertLinkedBooking({
      carId,
      status: 'picked_up',
      pickupDate: '2031-03-01',
      returnDate: '2031-03-04',
      guest: { email: `chk-first-${Date.now()}@example.com` },
    });
    const second = await insertLinkedBooking({
      carId,
      status: 'car_prepared',
      pickupDate: '2031-07-01',
      returnDate: '2031-07-04',
      guest: { email: `chk-second-${Date.now()}@example.com` },
    });
    const carBefore = await getCarMileage(carId);
    const historyBefore = await getStatusHistory(second.reservationId);

    const res = await pickup(admin, second.reservationId);
    expect(res.status).toBe(409);
    expect(res.body.error?.code || res.body.code).toBe('OPEN_PHYSICAL_RENTAL');

    expect((await getReservationById(second.reservationId)).status).toBe('car_prepared');
    expect((await getReservationById(first.reservationId)).status).toBe('picked_up');
    expect(await countRows('reservation_pickup_checklists', second.reservationId)).toBe(0);
    expect(await getCarMileage(carId)).toEqual(carBefore);
    expect((await getStatusHistory(second.reservationId)).length).toBe(historyBefore.length);
  });

  test('pickup of the already-open reservation is not blocked by itself', async () => {
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2031-03-01',
      returnDate: '2031-03-04',
      guest: { email: `chk-self-${Date.now()}@example.com` },
    });
    const res = await pickup(admin, seeded.reservationId);
    expect(res.status).toBe(201);
    expect((await getReservationById(seeded.reservationId)).status).toBe('picked_up');
    expect(await countRows('reservation_pickup_checklists', seeded.reservationId)).toBe(1);
  });

  test('after first return, second reservation pickup succeeds', async () => {
    const first = await insertLinkedBooking({
      carId,
      status: 'picked_up',
      pickupDate: '2031-03-01',
      returnDate: '2031-03-04',
      guest: { email: `chk-ret-first-${Date.now()}@example.com` },
    });
    const second = await insertLinkedBooking({
      carId,
      status: 'car_prepared',
      pickupDate: '2031-07-01',
      returnDate: '2031-07-04',
      guest: { email: `chk-ret-second-${Date.now()}@example.com` },
    });

    expect((await pickup(admin, second.reservationId)).status).toBe(409);

    const returned = await ret(admin, first.reservationId, {
      newDamages: 'None noted',
      extraFees: 0,
    });
    expect(returned.status).toBe(201);
    expect((await getReservationById(first.reservationId)).status).toBe('returned');

    const secondPickup = await pickup(admin, second.reservationId);
    expect(secondPickup.status).toBe(201);
    expect((await getReservationById(second.reservationId)).status).toBe('picked_up');
    expect(await countRows('reservation_pickup_checklists', second.reservationId)).toBe(1);

    const open = await pool.query(
      `SELECT COUNT(*)::int AS count FROM reservations
       WHERE car_id = $1 AND status IN ('picked_up', 'active_rental')`,
      [carId]
    );
    expect(open.rows[0].count).toBe(1);
  });

  test('pickup during a pending refund returns REFUND_IN_PROGRESS with no side effects', async () => {
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2031-03-01',
      returnDate: '2031-03-04',
      guest: { email: `chk-refund-${Date.now()}@example.com` },
    });
    await refundOpSql.insertRefundOperation({
      reservationId: seeded.reservationId,
      stripePaymentIntentId: `pi_chk_${Date.now()}`,
      amountCents: 1000,
      status: 'pending',
      idempotencyKey: `chk-refund-${seeded.reservationId}-${Date.now()}`,
    });
    const carBefore = await getCarMileage(carId);
    const historyBefore = await getStatusHistory(seeded.reservationId);

    const res = await pickup(admin, seeded.reservationId);
    expect(res.status).toBe(409);
    expect(res.body.error?.code || res.body.code).toBe('REFUND_IN_PROGRESS');

    expect((await getReservationById(seeded.reservationId)).status).toBe('confirmed');
    expect(await countRows('reservation_pickup_checklists', seeded.reservationId)).toBe(0);
    expect(await getCarMileage(carId)).toEqual(carBefore);
    expect((await getStatusHistory(seeded.reservationId)).length).toBe(historyBefore.length);
  });

  test('return checklist retry is idempotent (one checklist, one damage report, one transition)', async () => {
    const seeded = await insertLinkedBooking({
      carId,
      status: 'picked_up',
      pickupDate: '2031-03-01',
      returnDate: '2031-03-04',
      guest: { email: `chk-return-${Date.now()}@example.com` },
    });
    const fields = { newDamages: 'Scratch on rear bumper', extraFees: 40 };

    const first = await ret(admin, seeded.reservationId, fields);
    expect(first.status).toBe(201);
    expect((await getReservationById(seeded.reservationId)).status).toBe('returned');
    const historyAfterFirst = (await getStatusHistory(seeded.reservationId)).length;

    const retry = await ret(admin, seeded.reservationId, fields);
    expect(retry.status).toBe(201);

    expect((await getReservationById(seeded.reservationId)).status).toBe('returned');
    expect(await countRows('reservation_return_checklists', seeded.reservationId)).toBe(1);
    const damages = await pool.query(
      'SELECT id, description FROM car_damage_reports WHERE car_id = $1 AND reservation_id = $2',
      [carId, seeded.reservationId]
    );
    expect(damages.rows).toHaveLength(1);
    expect(damages.rows[0].description).toBe('Scratch on rear bumper');
    expect((await getStatusHistory(seeded.reservationId)).length).toBe(historyAfterFirst);
  });

  test('admin status picked_up is refused while another rental is still open', async () => {
    const first = await insertLinkedBooking({
      carId,
      status: 'picked_up',
      pickupDate: '2031-03-01',
      returnDate: '2031-03-04',
      guest: { email: `chk-status-first-${Date.now()}@example.com` },
    });
    const second = await insertLinkedBooking({
      carId,
      status: 'car_prepared',
      pickupDate: '2031-07-01',
      returnDate: '2031-07-04',
      guest: { email: `chk-status-second-${Date.now()}@example.com` },
    });
    const historyBefore = await getStatusHistory(second.reservationId);

    const res = await postAdminReservationStatus(admin, second.reservationId, {
      status: 'picked_up',
      reason: 'handover_attempt',
    });
    expect(res.status).toBe(409);
    expect(res.body.error?.code || res.body.code).toBe('OPEN_PHYSICAL_RENTAL');

    expect((await getReservationById(second.reservationId)).status).toBe('car_prepared');
    expect((await getReservationById(first.reservationId)).status).toBe('picked_up');
    expect((await getStatusHistory(second.reservationId)).length).toBe(historyBefore.length);

    const open = await pool.query(
      `SELECT COUNT(*)::int AS count FROM reservations
       WHERE car_id = $1 AND status IN ('picked_up', 'active_rental')`,
      [carId]
    );
    expect(open.rows[0].count).toBe(1);
  });

  test('after first return, admin status picked_up on the second reservation succeeds', async () => {
    const first = await insertLinkedBooking({
      carId,
      status: 'picked_up',
      pickupDate: '2031-03-01',
      returnDate: '2031-03-04',
      guest: { email: `chk-status-ret-first-${Date.now()}@example.com` },
    });
    const second = await insertLinkedBooking({
      carId,
      status: 'car_prepared',
      pickupDate: '2031-07-01',
      returnDate: '2031-07-04',
      guest: { email: `chk-status-ret-second-${Date.now()}@example.com` },
    });

    expect(
      (
        await postAdminReservationStatus(admin, second.reservationId, {
          status: 'picked_up',
        })
      ).status
    ).toBe(409);

    expect((await ret(admin, first.reservationId)).status).toBe(201);
    expect((await getReservationById(first.reservationId)).status).toBe('returned');

    const secondPickup = await postAdminReservationStatus(admin, second.reservationId, {
      status: 'picked_up',
      reason: 'handover_after_return',
    });
    expect(secondPickup.status).toBe(200);
    expect((await getReservationById(second.reservationId)).status).toBe('picked_up');

    const open = await pool.query(
      `SELECT COUNT(*)::int AS count FROM reservations
       WHERE car_id = $1 AND status IN ('picked_up', 'active_rental')`,
      [carId]
    );
    expect(open.rows[0].count).toBe(1);
  });

  test('concurrent pickup checklists leave only one open physical rental', async () => {
    const first = await insertLinkedBooking({
      carId,
      status: 'car_prepared',
      pickupDate: '2031-03-01',
      returnDate: '2031-03-04',
      guest: { email: `chk-conc-a-${Date.now()}@example.com` },
    });
    const second = await insertLinkedBooking({
      carId,
      status: 'car_prepared',
      pickupDate: '2031-07-01',
      returnDate: '2031-07-04',
      guest: { email: `chk-conc-b-${Date.now()}@example.com` },
    });

    const holder = await pool.connect();
    let results;
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT pg_advisory_xact_lock($1, $2)', [
        ADVISORY_LOCK_NS.CAR,
        Number(carId),
      ]);

      const p1 = pickup(admin, first.reservationId);
      const p2 = pickup(admin, second.reservationId);
      await waitUntilAdvisoryLockWaiters(ADVISORY_LOCK_NS.CAR, Number(carId), 1, {
        timeoutMs: 10_000,
      });

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

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const conflict = results.find((r) => r.status === 409);
    expect(conflict.body.error?.code || conflict.body.code).toBe('OPEN_PHYSICAL_RENTAL');

    const open = await pool.query(
      `SELECT id, status FROM reservations
       WHERE car_id = $1 AND status IN ('picked_up', 'active_rental')
       ORDER BY id`,
      [carId]
    );
    expect(open.rows).toHaveLength(1);
  });
});
