import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  countActiveReservationsForCar,
  countOrdersForCar,
  getReservationByStripeSessionId,
  getActiveReservationForCar,
  eurosToStripeCents,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST, API_URL } from '../helpers/test-env';
import {
  continueToCheckoutAndFillGuest,
  buildOrderUrl,
  fillHomeSearch,
} from '../helpers/booking';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import { searchPublicCars } from '../helpers/fleet';
import { raceGuestHoldsViaApi } from '../helpers/hold-race';
import { applySessionCookies } from '../helpers/account';

const CAR_NAME = `E2E Concurrent Hold ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('CROSS concurrent hold race (78)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 120, nights: 3 });

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('exactly one guest wins the hold; loser cannot book; winner confirms', async ({
    browser,
    request,
  }) => {
    await cleanupReservationsForCar(carId);

    const { winner, loser } = await raceGuestHoldsViaApi(request, carId, range);
    expect(winner.body?.success).toBe(true);
    expect(loser.body?.success).toBe(false);
    expect(loser.body?.error?.code).toBe('CONFLICT');
    expect(await countActiveReservationsForCar(carId)).toBe(1);

    const hold = await getActiveReservationForCar(carId);
    expect(hold).toBeTruthy();

    const winnerContext = await browser.newContext();
    const loserContext = await browser.newContext();
    const winnerPage = await winnerContext.newPage();
    const loserPage = await loserContext.newPage();

    try {
      await applySessionCookies(winnerPage, winner.session);
      // Also set cookies for API origin used by the SPA.
      const pairs = winner.session.cookieHeader
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((pair) => {
          const eq = pair.indexOf('=');
          return {
            name: eq > 0 ? pair.slice(0, eq) : pair,
            value: eq > 0 ? pair.slice(eq + 1) : '',
            url: API_URL,
          };
        });
      if (pairs.length) await winnerContext.addCookies(pairs);

      await winnerPage.goto(buildOrderUrl(carId, range));
      await expect(winnerPage.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
        timeout: 20_000,
      });

      const winnerEmail = uniqueEmail('hold-win');
      await continueToCheckoutAndFillGuest(winnerPage, carId, {
        ...E2E_GUEST,
        email: winnerEmail,
        hotelName: '',
      });
      await winnerPage.getByRole('button', { name: 'Pay with Stripe' }).click();
      await winnerPage.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

      const stripeSessionId =
        new URL(winnerPage.url()).searchParams.get('session_id') || '';
      expect(stripeSessionId).toMatch(/^cs_test_/);

      const reservation = await getReservationByStripeSessionId(stripeSessionId);
      expect(reservation?.status).toBe('processing_payment');

      const webhookEvent = buildCheckoutCompletedEvent({
        eventId: `evt_e2e_concurrent_${Date.now()}`,
        sessionId: stripeSessionId,
        reservationId: reservation.id,
        carId: reservation.car_id,
        sessionIdMeta: reservation.session_id,
        amountTotal: eurosToStripeCents(Number(reservation.total_price)),
      });
      const webhookRes = await postSignedWebhook(request, webhookEvent);
      expect(webhookRes.status()).toBe(200);

      const confirmed = await getReservationByStripeSessionId(stripeSessionId);
      expect(confirmed.status).toBe('confirmed');
      expect(await countOrdersForCar(carId)).toBe(1);
      expect(await countActiveReservationsForCar(carId)).toBe(0);

      await applySessionCookies(loserPage, loser.session);
      await loserPage.goto(buildOrderUrl(carId, range));
      await expect(loserPage.getByRole('heading', { name: 'Review your booking' })).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect(
        loserPage.getByText(/already reserved|different dates|different car/i).first()
      ).toBeVisible({ timeout: 15_000 });

      await fillHomeSearch(loserPage, range);
      await expect(loserPage.getByRole('heading', { name: CAR_NAME })).toHaveCount(0);

      const search = await searchPublicCars(request, {
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
      });
      expect(search.status).toBe(200);
      expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(false);
    } finally {
      await winnerContext.close();
      await loserContext.close();
    }
  });
});
