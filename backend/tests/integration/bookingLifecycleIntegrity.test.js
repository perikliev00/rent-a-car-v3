/**
 * Regression: calendar/order/checklist/RBAC guards that protect booking integrity.
 * Integration tests against real Postgres — move, soft-delete update, restore,
 * return checklist status gating, damage-report migration dedupe, and owner grant.
 */
const fs = require('fs');
const path = require('path');
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const {
  loginAsAdmin,
  loginAsStaff,
  putUserRoles,
  withCsrf,
} = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertTestStaff,
  insertLinkedBooking,
  cleanupTestCar,
  cleanupTestStaff,
  getDateBlocksForCar,
  getReservationById,
  getRoleBySlug,
  STAFF_PASSWORD,
} = require('./helpers/dbFixtures');
const { parseSofiaDate } = require('../../src/utils/date/timezone');
const { pool } = require('../helpers/dbTestHarness');
const orderAdmin = require('../../src/services/admin/order');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

async function moveCalendarReservation(admin, reservationId, body) {
  return withCsrf(
    admin,
    admin.patch(`/api/admin/calendar/events/reservation:${reservationId}/move`)
  ).send(body);
}

function postReturnChecklist(agent, reservationId, fields) {
  let req = withCsrf(
    agent,
    agent.post(`/api/admin/reservations/${reservationId}/return-checklist`)
  );
  for (const [key, value] of Object.entries({ fuelLevel: 'half', mileage: 12500, ...fields })) {
    req = req.field(key, String(value));
  }
  return Promise.resolve(req);
}

describeIf('booking lifecycle integrity', () => {
  jest.setTimeout(90_000);

  let app;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  test('calendar move of manual_review reservation is refused and creates no booking block', async () => {
    const carId = await insertIsolatedTestCar({ name: 'Lifecycle Manual Review Move Car' });
    try {
      const seeded = await insertLinkedBooking({
        carId,
        status: 'manual_review',
        withOrder: false,
        withBlock: false,
        pickupDate: '2031-08-01',
        returnDate: '2031-08-04',
        pickupTime: '10:00',
        returnTime: '10:00',
        guest: { email: `lifecycle-mr-move-${Date.now()}@example.com` },
      });

      const admin = await loginAsAdmin(app);
      const moved = await moveCalendarReservation(admin, seeded.reservationId, {
        start: parseSofiaDate('2031-08-02', '10:00').toISOString(),
        end: parseSofiaDate('2031-08-05', '10:00').toISOString(),
      });

      expect(moved.status).toBe(409);
      expect(moved.body?.error?.code || moved.body?.code).toBe('INVALID_STATUS_TRANSITION');
      expect(await getDateBlocksForCar(carId)).toHaveLength(0);
      expect((await getReservationById(seeded.reservationId)).status).toBe('manual_review');
    } finally {
      await cleanupTestCar(carId);
    }
  });

  test('updating a soft-deleted order is refused and does not steal another order booking block', async () => {
    const carId = await insertIsolatedTestCar({ name: 'Lifecycle Soft Delete Order Car' });
    try {
      const pickupDate = '2031-09-01';
      const returnDate = '2031-09-04';
      const pickupTime = '10:00';
      const returnTime = '10:00';

      const orderA = await insertLinkedBooking({
        carId,
        status: 'confirmed',
        withBlock: true,
        pickupDate,
        returnDate,
        pickupTime,
        returnTime,
        guest: { email: `lifecycle-sd-a-${Date.now()}@example.com` },
      });

      await orderAdmin.deleteOrder(orderA.orderId);
      expect(await getDateBlocksForCar(carId)).toHaveLength(0);

      const orderB = await insertLinkedBooking({
        carId,
        status: 'confirmed',
        withBlock: true,
        pickupDate,
        returnDate,
        pickupTime,
        returnTime,
        guest: { email: `lifecycle-sd-b-${Date.now()}@example.com` },
      });
      expect(await getDateBlocksForCar(carId)).toHaveLength(1);

      const result = await orderAdmin.updateOrder(orderA.orderId, {
        carId: String(carId),
        pickupDate,
        pickupTime,
        returnDate: '2031-09-06',
        returnTime,
        pickupLocation: 'office',
        returnLocation: 'office',
        fullName: 'Lifecycle Soft Delete Guest',
        phoneNumber: '+359888000001',
        email: `lifecycle-sd-update-${Date.now()}@example.com`,
        address: 'Test',
      });

      expect(result.success).toBe(false);
      expect(String(result.viewModel?.error || '')).toMatch(/soft-deleted|Restore/i);
      expect(await getDateBlocksForCar(carId)).toHaveLength(1);

      const liveB = await pool.query(`SELECT is_deleted FROM orders WHERE id = $1`, [
        orderB.orderId,
      ]);
      expect(liveB.rows[0].is_deleted).toBe(false);
    } finally {
      await cleanupTestCar(carId);
    }
  });

  test('restoring an order linked to a refunded reservation creates a fresh confirmed booking', async () => {
    const carId = await insertIsolatedTestCar({ name: 'Lifecycle Restore Refunded Car' });
    try {
      const seeded = await insertLinkedBooking({
        carId,
        status: 'refunded',
        withOrder: true,
        withBlock: false,
        pickupDate: '2031-10-01',
        returnDate: '2031-10-04',
        pickupTime: '10:00',
        returnTime: '10:00',
        guest: { email: `lifecycle-restore-${Date.now()}@example.com` },
      });
      await pool.query(
        `UPDATE orders SET is_deleted = TRUE, deleted_at = NOW() WHERE id = $1`,
        [seeded.orderId]
      );

      await orderAdmin.restoreOrder(seeded.orderId);

      const order = await pool.query(
        `SELECT is_deleted, reservation_id FROM orders WHERE id = $1`,
        [seeded.orderId]
      );
      const linkedId = Number(order.rows[0].reservation_id);
      const linked = await getReservationById(linkedId);
      const old = await getReservationById(seeded.reservationId);

      expect(order.rows[0].is_deleted).toBe(false);
      expect(linkedId).not.toBe(Number(seeded.reservationId));
      expect(linked.status).toBe('confirmed');
      expect(old.status).toBe('refunded');
      expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    } finally {
      await cleanupTestCar(carId);
    }
  });

  test('manager with can_manage_users cannot self-assign the owner role', async () => {
    const manager = await insertTestStaff({ roleSlug: 'manager' });
    try {
      const ownerRole = await getRoleBySlug('owner');
      const managerRole = await getRoleBySlug('manager');
      const managerSession = await loginAsStaff(app, {
        email: manager.email,
        password: STAFF_PASSWORD,
      });

      const escalate = await putUserRoles(managerSession, manager.userId, [
        ownerRole.id,
        managerRole.id,
      ]);

      const roles = await pool.query(
        `
        SELECT r.slug
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY r.slug
        `,
        [manager.userId]
      );
      const slugs = roles.rows.map((r) => r.slug);

      expect(escalate.status).toBe(403);
      expect(slugs).not.toContain('owner');
      expect(slugs).toContain('manager');
    } finally {
      await cleanupTestStaff(manager.email);
    }
  });

  test('return checklist on confirmed reservation is refused without mutating car or damages', async () => {
    const carId = await insertIsolatedTestCar({ name: 'Lifecycle Checklist Gate Car' });
    try {
      await pool.query(`UPDATE cars SET mileage = 1000, fuel_level = 'full' WHERE id = $1`, [
        carId,
      ]);
      const seeded = await insertLinkedBooking({
        carId,
        status: 'confirmed',
        guest: { email: `lifecycle-checklist-${Date.now()}@example.com` },
      });

      const admin = await loginAsAdmin(app);
      const response = await postReturnChecklist(admin, seeded.reservationId, {
        fuelLevel: 'empty',
        mileage: 99999,
        newDamages: 'lifecycle phantom scratch',
        extraFees: 50,
      });

      const car = await pool.query(`SELECT mileage, fuel_level FROM cars WHERE id = $1`, [carId]);
      const damages = await pool.query(
        `SELECT id FROM car_damage_reports WHERE car_id = $1 AND reservation_id = $2`,
        [carId, seeded.reservationId]
      );

      expect(response.status).toBe(422);
      expect(response.body?.error?.code || response.body?.code).toBe('INVALID_STATUS_TRANSITION');
      expect(Number(car.rows[0].mileage)).toBe(1000);
      expect(car.rows[0].fuel_level).toBe('full');
      expect(damages.rows).toHaveLength(0);
      expect((await getReservationById(seeded.reservationId)).status).toBe('confirmed');
    } finally {
      await pool.query('DELETE FROM car_damage_reports WHERE car_id = $1', [carId]);
      await pool.query(
        `DELETE FROM reservation_return_checklists
         WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)`,
        [carId]
      );
      await cleanupTestCar(carId);
    }
  });

  test('damage-report source migration collapses duplicate unresolved checklist rows before unique index', async () => {
    const carId = await insertIsolatedTestCar({ name: 'Lifecycle Damage Migration Car' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const reservation = await insertLinkedBooking({
        carId,
        status: 'returned',
        guest: { email: `lifecycle-dmg-mig-${Date.now()}@example.com` },
      });

      await client.query(
        `
        INSERT INTO reservation_return_checklists (
          reservation_id, fuel_level, mileage, new_damages, photos,
          late_return, extra_fees, customer_signature_key, employee_signature_key
        )
        VALUES ($1, 'half', 12000, 'duplicate scratch', '[]'::jsonb, FALSE, 0, 'sig-c', 'sig-e')
        ON CONFLICT (reservation_id) DO UPDATE
          SET new_damages = EXCLUDED.new_damages
        `,
        [reservation.reservationId]
      );

      await client.query(
        `DROP INDEX IF EXISTS idx_car_damage_one_auto_unresolved_per_reservation`
      );

      for (let i = 0; i < 2; i += 1) {
        await client.query(
          `
          INSERT INTO car_damage_reports (
            car_id, description, reservation_id, photos, repair_cost, status, source
          )
          VALUES ($1, 'duplicate scratch', $2, '[]'::jsonb, 25, 'unresolved', 'manual')
          `,
          [carId, reservation.reservationId]
        );
      }

      // Prove the pre-fix path fails: label all matching rows then create the unique index.
      await client.query('SAVEPOINT before_naive_backfill');
      let naiveFailed = false;
      try {
        await client.query(
          `
          UPDATE car_damage_reports d
          SET source = 'return_checklist'
          FROM reservation_return_checklists c
          WHERE d.reservation_id = c.reservation_id
            AND c.new_damages IS NOT NULL
            AND btrim(c.new_damages) <> ''
            AND d.description = c.new_damages
            AND d.status = 'unresolved'
            AND d.source = 'manual'
            AND d.reservation_id = $1
          `,
          [reservation.reservationId]
        );
        await client.query(
          `
          CREATE UNIQUE INDEX idx_car_damage_one_auto_unresolved_per_reservation_naive
          ON car_damage_reports (reservation_id)
          WHERE source = 'return_checklist'
            AND status = 'unresolved'
            AND reservation_id IS NOT NULL
          `
        );
      } catch (err) {
        naiveFailed = true;
        expect(String(err.message)).toMatch(/unique|duplicate/i);
        await client.query('ROLLBACK TO SAVEPOINT before_naive_backfill');
      }
      expect(naiveFailed).toBe(true);

      const migrationSql = fs.readFileSync(
        path.join(__dirname, '../../migrations/037_car_damage_report_source.sql'),
        'utf8'
      );
      const dedupeAndIndex = migrationSql.split('-- Collapse pre-fix duplicate')[1];
      expect(dedupeAndIndex).toBeTruthy();
      await client.query(`-- Collapse pre-fix duplicate${dedupeAndIndex}`);

      const unresolvedAuto = await client.query(
        `
        SELECT id, status, source
        FROM car_damage_reports
        WHERE reservation_id = $1
        ORDER BY id
        `,
        [reservation.reservationId]
      );
      const autoUnresolved = unresolvedAuto.rows.filter(
        (r) => r.source === 'return_checklist' && r.status === 'unresolved'
      );
      expect(autoUnresolved).toHaveLength(1);
      await client.query('ROLLBACK');
    } finally {
      client.release();
      await cleanupTestCar(carId);
    }
  });

  test.each(['picked_up', 'active_rental'])(
    'order update cannot reassign car while reservation is %s',
    async (physicalStatus) => {
      const carA = await insertIsolatedTestCar({ name: 'Lifecycle Order Physical Car A' });
      const carB = await insertIsolatedTestCar({ name: 'Lifecycle Order Physical Car B' });
      try {
        const pickupDate = '2031-11-01';
        const returnDate = '2031-11-04';
        const pickupTime = '10:00';
        const returnTime = '10:00';

        const seeded = await insertLinkedBooking({
          carId: carA,
          status: physicalStatus,
          withOrder: true,
          withBlock: true,
          pickupDate,
          returnDate,
          pickupTime,
          returnTime,
          guest: { email: `lifecycle-ord-phys-${physicalStatus}-${Date.now()}@example.com` },
        });

        expect(await getDateBlocksForCar(carA)).toHaveLength(1);
        expect(await getDateBlocksForCar(carB)).toHaveLength(0);

        const result = await orderAdmin.updateOrder(seeded.orderId, {
          carId: String(carB),
          pickupDate,
          pickupTime,
          returnDate,
          returnTime,
          pickupLocation: 'office',
          returnLocation: 'office',
          fullName: 'Lifecycle Physical Guest',
          phoneNumber: '+359888000099',
          email: `lifecycle-ord-phys-upd-${Date.now()}@example.com`,
          address: 'Test',
        });

        expect(result.success).toBe(false);
        expect(String(result.viewModel?.error || '')).toMatch(/picked up|active rental/i);

        expect(await getDateBlocksForCar(carA)).toHaveLength(1);
        expect(await getDateBlocksForCar(carB)).toHaveLength(0);

        const reservation = await getReservationById(seeded.reservationId);
        expect(Number(reservation.car_id)).toBe(Number(carA));
        expect(reservation.status).toBe(physicalStatus);

        const orderRow = await pool.query(`SELECT car_id FROM orders WHERE id = $1`, [
          seeded.orderId,
        ]);
        expect(Number(orderRow.rows[0].car_id)).toBe(Number(carA));
      } finally {
        await cleanupTestCar(carA);
        await cleanupTestCar(carB);
      }
    }
  );

  test('order update may reassign car while reservation is confirmed (control)', async () => {
    const carA = await insertIsolatedTestCar({ name: 'Lifecycle Order Confirmed Car A' });
    const carB = await insertIsolatedTestCar({ name: 'Lifecycle Order Confirmed Car B' });
    try {
      const pickupDate = '2031-12-01';
      const returnDate = '2031-12-04';
      const pickupTime = '10:00';
      const returnTime = '10:00';

      const seeded = await insertLinkedBooking({
        carId: carA,
        status: 'confirmed',
        withOrder: true,
        withBlock: true,
        pickupDate,
        returnDate,
        pickupTime,
        returnTime,
        guest: { email: `lifecycle-ord-conf-${Date.now()}@example.com` },
      });

      const result = await orderAdmin.updateOrder(seeded.orderId, {
        carId: String(carB),
        pickupDate,
        pickupTime,
        returnDate,
        returnTime,
        pickupLocation: 'office',
        returnLocation: 'office',
        fullName: 'Lifecycle Confirmed Guest',
        phoneNumber: '+359888000088',
        email: `lifecycle-ord-conf-upd-${Date.now()}@example.com`,
        address: 'Test',
      });

      expect(result.success).toBe(true);
      expect(await getDateBlocksForCar(carA)).toHaveLength(0);
      expect(await getDateBlocksForCar(carB)).toHaveLength(1);

      const reservation = await getReservationById(seeded.reservationId);
      expect(Number(reservation.car_id)).toBe(Number(carB));
    } finally {
      await cleanupTestCar(carA);
      await cleanupTestCar(carB);
    }
  });
});
