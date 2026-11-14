/**
 * B6: submitting the return checklist more than once (retry / double click) must not
 * create duplicate damage reports, and must never delete manually-created reports.
 */
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { loginAsAdmin, withCsrf } = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertLinkedBooking,
  getReservationById,
  getStatusHistory,
  cleanupTestCar,
} = require('./helpers/dbFixtures');
const { pool } = require('../helpers/dbTestHarness');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

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

async function damageRows(carId, reservationId) {
  const result = await pool.query(
    `
    SELECT id, description, photos, repair_cost, status
    FROM car_damage_reports
    WHERE car_id = $1 AND reservation_id = $2
    ORDER BY id
    `,
    [carId, reservationId]
  );
  return result.rows;
}

describeIf('B6: returnChecklistIdempotency', () => {
  jest.setTimeout(60_000);

  let app;
  let admin;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
    admin = await loginAsAdmin(app);
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'B6 Return Idempotency Car' });
  });

  afterEach(async () => {
    await pool.query(
      `DELETE FROM reservation_return_checklists
       WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = $1)`,
      [carId]
    );
    await pool.query('DELETE FROM car_damage_reports WHERE car_id = $1', [carId]);
    await cleanupTestCar(carId);
  });

  async function seedPickedUp(label) {
    return insertLinkedBooking({
      carId,
      status: 'picked_up',
      pickupDate: '2031-03-01',
      returnDate: '2031-03-04',
      guest: { email: `b6-${label}-${Date.now()}@example.com` },
    });
  }

  test('sequential retry with identical payload leaves exactly one damage report', async () => {
    const seeded = await seedPickedUp('seq');
    const fields = { newDamages: 'Scratch on rear bumper', extraFees: 40 };

    expect((await postReturnChecklist(admin, seeded.reservationId, fields)).status).toBe(201);
    const historyAfterFirst = (await getStatusHistory(seeded.reservationId)).length;
    expect((await postReturnChecklist(admin, seeded.reservationId, fields)).status).toBe(201);
    expect((await postReturnChecklist(admin, seeded.reservationId, fields)).status).toBe(201);

    const rows = await damageRows(carId, seeded.reservationId);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('Scratch on rear bumper');
    expect(Number(rows[0].repair_cost)).toBe(40);
    expect((await getReservationById(seeded.reservationId)).status).toBe('returned');
    expect((await getStatusHistory(seeded.reservationId)).length).toBe(historyAfterFirst);
  });

  test('manually-created damage reports are never deleted or altered by checklist retries', async () => {
    const seeded = await seedPickedUp('manual');
    const manual = await pool.query(
      `
      INSERT INTO car_damage_reports (car_id, reservation_id, description, photos, repair_cost, status)
      VALUES ($1, $2, 'Manual: cracked mirror', '["manual-photo.jpg"]'::jsonb, 120, 'unresolved')
      RETURNING id
      `,
      [carId, seeded.reservationId]
    );
    const manualId = Number(manual.rows[0].id);
    const fields = { newDamages: 'Scratch on rear bumper', extraFees: 40 };

    await postReturnChecklist(admin, seeded.reservationId, fields);
    await postReturnChecklist(admin, seeded.reservationId, fields);

    const rows = await damageRows(carId, seeded.reservationId);
    expect(rows).toHaveLength(2);
    const manualRow = rows.find((r) => Number(r.id) === manualId);
    expect(manualRow).toBeTruthy();
    expect(manualRow.description).toBe('Manual: cracked mirror');
    expect(manualRow.photos).toEqual(['manual-photo.jpg']);
    expect(Number(manualRow.repair_cost)).toBe(120);
    expect(rows.filter((r) => r.description === 'Scratch on rear bumper')).toHaveLength(1);
  });

  test('a manual report with the same description stays untouched when the checklist is submitted', async () => {
    const seeded = await seedPickedUp('manual-same');
    const manual = await pool.query(
      `
      INSERT INTO car_damage_reports (car_id, reservation_id, description, photos, repair_cost, status)
      VALUES ($1, $2, 'Scratch on rear bumper', '["manual-photo.jpg"]'::jsonb, 120, 'unresolved')
      RETURNING id
      `,
      [carId, seeded.reservationId]
    );
    const manualId = Number(manual.rows[0].id);

    await postReturnChecklist(admin, seeded.reservationId, {
      newDamages: 'Scratch on rear bumper',
      extraFees: 40,
    });

    const rows = await damageRows(carId, seeded.reservationId);
    expect(rows).toHaveLength(2);
    const manualRow = rows.find((r) => Number(r.id) === manualId);
    expect(manualRow).toBeTruthy();
    expect(manualRow.photos).toEqual(['manual-photo.jpg']);
    expect(Number(manualRow.repair_cost)).toBe(120);
    const autoRows = rows.filter((r) => Number(r.id) !== manualId);
    expect(autoRows).toHaveLength(1);
    expect(autoRows[0].description).toBe('Scratch on rear bumper');
    expect(Number(autoRows[0].repair_cost)).toBe(40);
  });

  test('editing damage description and amount updates the single auto report to 110', async () => {
    const seeded = await seedPickedUp('edit-cost');
    expect(
      (
        await postReturnChecklist(admin, seeded.reservationId, {
          newDamages: 'Scratch on rear bumper',
          extraFees: 100,
        })
      ).status
    ).toBe(201);

    const afterFirst = await damageRows(carId, seeded.reservationId);
    expect(afterFirst).toHaveLength(1);
    expect(Number(afterFirst[0].repair_cost)).toBe(100);
    const autoId = Number(afterFirst[0].id);

    expect(
      (
        await postReturnChecklist(admin, seeded.reservationId, {
          newDamages: 'Scratch on rear bumper (deepened)',
          extraFees: 110,
        })
      ).status
    ).toBe(201);

    const afterEdit = await damageRows(carId, seeded.reservationId);
    expect(afterEdit).toHaveLength(1);
    expect(Number(afterEdit[0].id)).toBe(autoId);
    expect(afterEdit[0].description).toBe('Scratch on rear bumper (deepened)');
    expect(Number(afterEdit[0].repair_cost)).toBe(110);

    expect(
      (
        await postReturnChecklist(admin, seeded.reservationId, {
          newDamages: 'Scratch on rear bumper (deepened)',
          extraFees: 110,
        })
      ).status
    ).toBe(201);
    const afterRetry = await damageRows(carId, seeded.reservationId);
    expect(afterRetry).toHaveLength(1);
    expect(Number(afterRetry[0].repair_cost)).toBe(110);

    const sum = afterRetry.reduce((acc, row) => acc + Number(row.repair_cost || 0), 0);
    expect(sum).toBe(110);
  });

  test('amount-only correction updates the same auto report', async () => {
    const seeded = await seedPickedUp('amount-only');
    await postReturnChecklist(admin, seeded.reservationId, {
      newDamages: 'Dent on hood',
      extraFees: 100,
    });
    await postReturnChecklist(admin, seeded.reservationId, {
      newDamages: 'Dent on hood',
      extraFees: 110,
    });
    const rows = await damageRows(carId, seeded.reservationId);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].repair_cost)).toBe(110);
  });

  test('concurrent double submit leaves exactly one damage report', async () => {
    const seeded = await seedPickedUp('conc');
    const fields = { newDamages: 'Dent on left door', extraFees: 25 };

    // Hold a table lock that permits SELECT but blocks INSERT, so both requests perform
    // their existence check before either can write.
    const holder = await pool.connect();
    let results;
    try {
      await holder.query('BEGIN');
      await holder.query('LOCK TABLE car_damage_reports IN SHARE ROW EXCLUSIVE MODE');

      const p1 = postReturnChecklist(admin, seeded.reservationId, fields);
      const p2 = postReturnChecklist(admin, seeded.reservationId, fields);

      const started = Date.now();
      let blocked = 0;
      while (Date.now() - started < 10_000 && blocked < 1) {
        const r = await pool.query(
          `
          SELECT COUNT(*)::int AS n
          FROM pg_locks
          WHERE locktype = 'relation'
            AND granted = false
            AND relation = 'car_damage_reports'::regclass
          `
        );
        blocked = r.rows[0].n;
        if (blocked < 1) await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(blocked).toBeGreaterThanOrEqual(1);
      // Give the second request time to reach the same point (or queue behind a lock).
      await new Promise((resolve) => setTimeout(resolve, 750));

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
      expect({ status: res.status, body: res.body }).toMatchObject({ status: 201 });
    }
    const rows = await damageRows(carId, seeded.reservationId);
    expect(rows.map((r) => r.description)).toEqual(['Dent on left door']);
  });
});
