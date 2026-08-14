import { test, expect } from '../fixtures/base';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationByStripeSessionId,
  setHoldExpired,
  insertDateBlock,
  deleteDateBlocksForCar,
  eurosToStripeCents,
  assertReservationStatus,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  continueToCheckoutAndFillGuest,
} from '../helpers/booking';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import { loginAsAdmin } from '../helpers/csrf';
import { markStubSessionPaid } from '../helpers/payments';
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';

const CAR_NAME = `E2E Success Processing ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Checkout success processing then confirmed (88)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 230, nights: 2 });
  const guestEmail = uniqueEmail('success-proc');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('shows Payment Received while stuck, then Confirmed after resolve', async ({
    page,
    request,
    adminPage,
  }) => {
    await cleanupReservationsForCar(carId);
    await deleteDateBlocksForCar(carId);

    await openOrderAndResolveConflict(page, carId, range);
    await continueToCheckoutAndFillGuest(page, carId, {
      ...E2E_GUEST,
      email: guestEmail,
      hotelName: '',
    });
    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

    const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    expect(stripeSessionId).toMatch(/^cs_test_/);

    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation?.status).toBe('processing_payment');

    // Force paid-conflict path so success finalize cannot confirm yet.
    await setHoldExpired(Number(reservation.id));
    await insertDateBlock(
      carId,
      range.pickupDate,
      range.returnDate,
      range.pickupTime,
      range.returnTime
    );

    const adminSession = await loginAsAdmin(request);
    const marked = await markStubSessionPaid(request, adminSession, stripeSessionId);
    expect(marked.status, JSON.stringify(marked.body)).toBe(200);

    // Webhook (or success finalize) lands in manual_review — not silent confirmed.
    const event = buildCheckoutCompletedEvent({
      eventId: `evt_e2e_proc_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId: reservation.car_id,
      sessionIdMeta: reservation.session_id,
      amountTotal: eurosToStripeCents(Number(reservation.total_price)),
    });
    expect((await postSignedWebhook(request, event)).status()).toBe(200);

    await assertReservationStatus(Number(reservation.id), 'manual_review');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Payment Received' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toHaveCount(0);
    await expect(page.getByText(/confirming your booking/i)).toBeVisible();

    await adminPage.goto('/admin/reservations');
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
      timeout: 15_000,
    });
    await adminPage.getByRole('button', { name: 'Refresh' }).click();
    await expect(
      adminPage.getByRole('button', { name: String(reservation.id), exact: true }).first()
    ).toBeVisible({ timeout: 15_000 });

    await deleteDateBlocksForCar(carId);
    const confirm = await changeOpsStatusViaApi(
      request,
      reservation.id,
      'confirmed',
      adminSession
    );
    expect(confirm.ok, JSON.stringify(confirm.body)).toBeTruthy();

    await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toBeVisible({
      timeout: 20_000,
    });

    const confirmed = await getReservationByStripeSessionId(stripeSessionId);
    expect(confirmed.status).toBe('confirmed');
  });
});
