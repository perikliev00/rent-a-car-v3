/**
 * H3: extending a paid reservation must not present the new total as already paid.
 */
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { loginAsAdmin, withCsrf } = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertLinkedBooking,
  getReservationById,
  getOrderByReservationId,
  cleanupTestCar,
} = require('./helpers/dbFixtures');
const { pool } = require('../helpers/dbTestHarness');
const {
  getSofiaIsoDateString,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  parseSofiaDate,
} = require('../../src/utils/date/timezone');
const { generatePdf } = require('../../src/services/pdf/pdfDocumentService');
const reservationRepository = require('../../src/repositories/reservationRepository');

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

function pdfText(buffer) {
  const raw = Buffer.from(buffer).toString('latin1');
  // PDFKit emits WinAnsi text as hex strings like <455552203230302e3030> ("EUR 200.00").
  return raw.replace(/<([0-9A-Fa-f]+)>/g, (_match, hex) => {
    if (hex.length % 2 !== 0) return '';
    return Buffer.from(hex, 'hex').toString('latin1');
  });
}

describeIf('H3: calendar resize paid amount integrity', () => {
  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Paid Resize Car', price: 50 });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('resize after paid checkout keeps paid_amount and shows balance due on invoice', async () => {
    const pickupDate = '2033-04-01';
    const returnDate = '2033-04-05'; // 4 rental days × €50 = €200 → 20000 cents? check rentalDaysBetween
    const pickupTime = '10:00';
    const returnTime = '10:00';
    const dayPrice = 50;

    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      dayPrice,
      guest: { email: `paid-resize-${Date.now()}@example.com`, fullName: 'Paid Resize Guest' },
    });

    const before = await getReservationById(seeded.reservationId);
    const totalBefore = Number(before.total_price);
    const paidCents = Math.round(totalBefore * 100);

    await pool.query(
      `
      UPDATE reservations
      SET paid_amount_cents = $2,
          paid_currency = 'eur',
          stripe_session_id = COALESCE(stripe_session_id, $3),
          updated_at = NOW()
      WHERE id = $1
      `,
      [seeded.reservationId, paidCents, `cs_test_paid_resize_${seeded.reservationId}`]
    );

    const longerReturn = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(returnDate, '00:00'), 3)
    );

    const admin = await loginAsAdmin(app);
    const resizeRes = await withCsrf(
      admin,
      admin.patch(`/api/admin/calendar/events/reservation:${seeded.reservationId}/resize`)
    ).send({
      start: toSofiaIso(pickupDate, pickupTime),
      end: toSofiaIso(longerReturn, returnTime),
      carId,
    });
    expect(resizeRes.status).toBe(200);

    const after = await getReservationById(seeded.reservationId);
    const totalAfter = Number(after.total_price);
    expect(getSofiaIsoDateString(new Date(after.return_date))).toBe(longerReturn);
    expect(totalAfter).toBeGreaterThan(totalBefore);
    expect(Number(after.paid_amount_cents)).toBe(paidCents);
    expect(String(after.paid_currency).toLowerCase()).toBe('eur');

    const order = await getOrderByReservationId(seeded.reservationId);
    expect(Number(order.total_price)).toBe(totalAfter);

    const reservationDoc = await reservationRepository.findById(seeded.reservationId);
    const invoiceDoc = await generatePdf('invoice', reservationDoc);
    const invoice = pdfText(invoiceDoc.buffer);
    const receiptDoc = await generatePdf('receipt', reservationDoc);
    const receipt = pdfText(receiptDoc.buffer);

    const paidEuros = (paidCents / 100).toFixed(2);
    const totalEuros = Number(totalAfter).toFixed(2);
    const balanceEuros = (Number(totalAfter) - paidCents / 100).toFixed(2);

    expect(invoice).toMatch(new RegExp(paidEuros.replace('.', '\\.')));
    expect(invoice).toMatch(/Amount paid|Paid amount|Paid\b/i);
    expect(invoice).toMatch(/Balance due|Amount due|Outstanding/i);
    expect(invoice).toMatch(new RegExp(balanceEuros.replace('.', '\\.')));
    // Must not claim the new total alone is the amount already paid.
    expect(invoice).not.toContain(`Amount due / paid`);
    expect(invoice).toMatch(new RegExp(totalEuros.replace('.', '\\.')));
    expect(receipt).toMatch(new RegExp(paidEuros.replace('.', '\\.')));
  });
});
