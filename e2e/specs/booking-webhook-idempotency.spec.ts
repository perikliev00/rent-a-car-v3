import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationByStripeSessionId,
  countOrdersForCar,
  countOrdersByGuestEmail,
  countProcessedStripeEvents,
  eurosToStripeCents,
} from '../helpers/db';
import {
  allocateFutureRange,
  uniqueEmail,
  E2E_GUEST,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  continueToCheckoutAndFillGuest,
} from '../helpers/booking';
import {
  buildCheckoutCompletedEvent,
  postSignedWebhook,
  replaySignedWebhook,
} from '../helpers/stripe-webhook';

const CAR_NAME = `E2E Webhook Idempotency ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Webhook replay idempotency (81)', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 150, nights: 2 });
  const guestEmail = uniqueEmail('wh-idem');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('replaying the same event.id leaves one confirmed order', async ({ page, request }) => {
    await cleanupReservationsForCar(carId);

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

    const eventId = `evt_e2e_idem_${Date.now()}`;
    const event = buildCheckoutCompletedEvent({
      eventId,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId: reservation.car_id,
      sessionIdMeta: reservation.session_id,
      amountTotal: eurosToStripeCents(Number(reservation.total_price)),
    });

    const first = await postSignedWebhook(request, event);
    expect(first.status()).toBe(200);
    expect(await first.json()).toEqual({ received: true });

    const second = await replaySignedWebhook(request, event);
    expect(second.status()).toBe(200);
    expect(await second.json()).toEqual({ received: true });

    const confirmed = await getReservationByStripeSessionId(stripeSessionId);
    expect(confirmed.status).toBe('confirmed');
    expect(await countOrdersForCar(carId)).toBe(1);
    expect(await countOrdersByGuestEmail(guestEmail)).toBe(1);
    expect(await countProcessedStripeEvents(eventId)).toBe(1);

    await page.goto('/login');
    await page.getByLabel(/^email$/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL(/\/admin/);
    await page.goto('/admin/orders');
    await expect(page.getByText(guestEmail)).toHaveCount(1);
  });
});
