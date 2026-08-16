import { test, expect } from '../fixtures/base';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationByStripeSessionId,
  getReservationById,
  countOrdersForCar,
  setHoldExpired,
  insertDateBlock,
  deleteDateBlocksForCar,
  eurosToStripeCents,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  continueToCheckoutAndFillGuest,
} from '../helpers/booking';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';

const CAR_NAME = `E2E Late Webhook ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Late webhook after hold expiry (80)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 140, nights: 3 });

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  async function checkoutToProcessing(page: import('@playwright/test').Page, email: string) {
    await page.goto('/');
    await cleanupReservationsForCar(carId);
    await deleteDateBlocksForCar(carId);
    await openOrderAndResolveConflict(page, carId, range);
    await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
      timeout: 20_000,
    });
    await continueToCheckoutAndFillGuest(page, carId, {
      ...E2E_GUEST,
      email,
      hotelName: '',
    });
    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });
    const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    expect(stripeSessionId).toMatch(/^cs_test_/);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation?.status).toBe('processing_payment');
    return { stripeSessionId, reservation };
  }

  test('4a: late paid webhook with free slot confirms', async ({ page, request }) => {
    const email = uniqueEmail('late-free');
    const { stripeSessionId, reservation } = await checkoutToProcessing(page, email);

    await setHoldExpired(reservation.id);

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_e2e_late_free_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId: reservation.car_id,
      sessionIdMeta: reservation.session_id,
      amountTotal: eurosToStripeCents(Number(reservation.total_price)),
    });
    const res = await postSignedWebhook(request, event);
    expect(res.status()).toBe(200);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('confirmed');
    expect(await countOrdersForCar(carId)).toBe(1);
  });

  test('4b: late paid webhook with overlap goes to manual_review (no double book)', async ({
    browser,
    request,
    adminPage,
  }) => {
    const email = uniqueEmail('late-overlap');
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
    const { stripeSessionId, reservation } = await checkoutToProcessing(page, email);

    await setHoldExpired(reservation.id);
    await insertDateBlock(
      carId,
      range.pickupDate,
      range.returnDate,
      range.pickupTime,
      range.returnTime
    );

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_e2e_late_overlap_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId: reservation.car_id,
      sessionIdMeta: reservation.session_id,
      amountTotal: eurosToStripeCents(Number(reservation.total_price)),
    });
    const res = await postSignedWebhook(request, event);
    expect(res.status()).toBe(200);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('manual_review');
    expect(await countOrdersForCar(carId)).toBe(0);

    await adminPage.goto('/admin/reservations');
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
      timeout: 15_000,
    });
    await adminPage.getByRole('button', { name: 'Refresh' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Manual Review', exact: true })).toBeVisible();
    await expect(
      adminPage.getByRole('button', { name: String(reservation.id), exact: true }).first()
    ).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });
});
