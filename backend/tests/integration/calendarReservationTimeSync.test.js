/**
 * B5: calendar move/resize must keep reservations/orders pickup_time / return_time
 * (Sofia HH:MM text) aligned with the new pickup_date / return_date timestamps.
 */
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const {
  createSessionAgent,
  loginAsAdmin,
  withCsrf,
} = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertLinkedBooking,
  getReservationById,
  getOrderByReservationId,
  cleanupTestCar,
} = require('./helpers/dbFixtures');
const { parseSofiaDate } = require('../../src/utils/date/timezone');
const { pool } = require('../helpers/dbTestHarness');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

/**
 * PDFKit writes each text run as a `[<hex> kern <hex> ...] TJ` array. Return one string per run.
 */
function pdfTextRuns(buffer) {
  const raw = Buffer.from(buffer).toString('latin1');
  const runs = [];
  for (const match of raw.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
    const text = [...match[1].matchAll(/<([0-9A-Fa-f]*)>/g)]
      .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))
      .join('');
    runs.push(text);
  }
  return runs;
}

/** Value printed after a `Label:` run (field() writes label and value as consecutive runs). */
function pdfFieldValue(runs, label) {
  const idx = runs.findIndex((run) => run.trim() === `${label}:`);
  return idx >= 0 ? runs[idx + 1] : undefined;
}

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

async function signupAgent(app, email, password = 'Customer123!') {
  const agent = await createSessionAgent(app);
  const res = await withCsrf(agent, agent.post('/api/auth/signup')).send({ email, password });
  expect(res.status).toBe(201);
  agent.csrfToken = res.body.data?.csrfToken || agent.csrfToken;
  return { agent, userId: Number(res.body.data.user.id), email };
}

function calendarPatch(admin, reservationId, mode, body) {
  return withCsrf(
    admin,
    admin.patch(`/api/admin/calendar/events/reservation:${reservationId}/${mode}`)
  ).send(body);
}

describeIf('B5: calendarReservationTimeSync', () => {
  jest.setTimeout(60_000);

  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'B5 Time Sync Car', price: 55 });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  async function seedOwned(label) {
    const email = `b5-${label}-${Date.now()}@example.com`;
    const { agent, userId } = await signupAgent(app, email);
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      userId,
      pickupDate: '2031-07-01',
      returnDate: '2031-07-04',
      pickupTime: '10:00',
      returnTime: '10:00',
      guest: { email, fullName: 'B5 Guest' },
    });
    return { agent, seeded };
  }

  test('control: unchanged times stay 10:00 after a same-time date resize', async () => {
    const { agent, seeded } = await seedOwned('control');
    const admin = await loginAsAdmin(app);

    const res = await calendarPatch(admin, seeded.reservationId, 'resize', {
      start: parseSofiaDate('2031-07-01', '10:00').toISOString(),
      end: parseSofiaDate('2031-07-05', '10:00').toISOString(),
    });
    expect(res.status).toBe(200);

    const row = await getReservationById(seeded.reservationId);
    expect(row.pickup_time).toBe('10:00');
    expect(row.return_time).toBe('10:00');
    const detail = await agent.get(`/api/account/reservations/${seeded.reservationId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.reservation.returnTime).toBe('10:00');
  });

  test('resize end to 14:00 Sofia updates reservation, order, account API and rental PDF', async () => {
    const { agent, seeded } = await seedOwned('resize');
    const admin = await loginAsAdmin(app);

    const newEnd = parseSofiaDate('2031-07-04', '14:00');
    const res = await calendarPatch(admin, seeded.reservationId, 'resize', {
      start: parseSofiaDate('2031-07-01', '10:00').toISOString(),
      end: newEnd.toISOString(),
    });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });

    // DB: timestamp and text agree.
    const row = await getReservationById(seeded.reservationId);
    expect(new Date(row.return_date).toISOString()).toBe(newEnd.toISOString());
    expect(row.pickup_time).toBe('10:00');
    expect(row.return_time).toBe('14:00');

    // Linked order carries the same text times.
    const order = await getOrderByReservationId(seeded.reservationId);
    const orderTimes = await pool.query(
      'SELECT pickup_time, return_time FROM orders WHERE id = $1',
      [order.id]
    );
    expect(orderTimes.rows[0].pickup_time).toBe('10:00');
    expect(orderTimes.rows[0].return_time).toBe('14:00');

    // Customer account API.
    const detail = await agent.get(`/api/account/reservations/${seeded.reservationId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.reservation.pickupTime).toBe('10:00');
    expect(detail.body.data.reservation.returnTime).toBe('14:00');

    // Rental agreement PDF.
    const pdf = await agent
      .get(`/api/account/reservations/${seeded.reservationId}/pdf/rental_agreement`)
      .buffer(true)
      .parse(binaryParser);
    expect(pdf.status).toBe(200);
    const runs = pdfTextRuns(pdf.body);
    expect(pdfFieldValue(runs, 'Return')).toMatch(/14:00/);
    expect(pdfFieldValue(runs, 'Return')).not.toMatch(/10:00/);
    expect(pdfFieldValue(runs, 'Pickup')).toMatch(/10:00/);
  });

  test('move to a new start/end derives both Sofia times (summer DST, not UTC)', async () => {
    const { agent, seeded } = await seedOwned('move');
    const admin = await loginAsAdmin(app);

    const newStart = parseSofiaDate('2031-08-10', '08:30');
    const newEnd = parseSofiaDate('2031-08-13', '16:45');
    const res = await calendarPatch(admin, seeded.reservationId, 'move', {
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
    });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });

    const row = await getReservationById(seeded.reservationId);
    expect(row.pickup_time).toBe('08:30');
    expect(row.return_time).toBe('16:45');

    const detail = await agent.get(`/api/account/reservations/${seeded.reservationId}`);
    expect(detail.body.data.reservation.pickupTime).toBe('08:30');
    expect(detail.body.data.reservation.returnTime).toBe('16:45');
  });
});
