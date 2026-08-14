import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationByStripeSessionId,
  assertReservationTotalPrice,
  eurosToStripeCents,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import {
  fillHomeSearch,
  openOrderAndResolveConflict,
  continueToCheckoutAndFillGuest,
  parseDisplayedPrice,
  readOrderSummaryTotal,
} from '../helpers/booking';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';

const CAR_NAME = `E2E Price Consistency ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('MONEY-005 Same price search→Stripe→DB', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 95, nights: 4 });
  const guestEmail = uniqueEmail('price-consistency');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('search, order, and Stripe amounts match reservation snapshot', async ({ page, request }) => {
    await fillHomeSearch(page, range);
    await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });

    const card = page.locator('article').filter({ hasText: CAR_NAME });
    const searchTotal = parseDisplayedPrice(
      await card.locator('.font-display.text-2xl').innerText()
    );

    await openOrderAndResolveConflict(page, carId, range);
    const orderTotal = await readOrderSummaryTotal(page);
    expect(orderTotal).toBeCloseTo(searchTotal, 2);

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
    expect(reservation).toBeTruthy();
    await assertReservationTotalPrice(Number(reservation.id), orderTotal);

    const amountTotal = eurosToStripeCents(orderTotal);
    const webhookEvent = buildCheckoutCompletedEvent({
      eventId: `evt_price_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId: reservation.car_id,
      sessionIdMeta: reservation.session_id,
      amountTotal,
    });
    expect((await postSignedWebhook(request, webhookEvent)).status()).toBe(200);

    const confirmed = await getReservationByStripeSessionId(stripeSessionId);
    expect(confirmed.status).toBe('confirmed');
    await assertReservationTotalPrice(Number(confirmed.id), orderTotal);
  });
});
