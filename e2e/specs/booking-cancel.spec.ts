import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationByStripeSessionId,
  countActiveReservationsForCar,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  continueToCheckoutAndFillGuest,
} from '../helpers/booking';

const CAR_NAME = `E2E Cancel Car ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Booking cancel path', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 85, nights: 3 });
  const guestEmail = uniqueEmail('cancel');

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

  test('guest can cancel checkout and release the hold', async ({ page }) => {
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
    expect(reservation).toBeTruthy();
    expect(reservation.status).toBe('processing_payment');

    await page.goto('/checkout/cancel');
    await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
      timeout: 15_000,
    });

    const afterCancel = await getReservationByStripeSessionId(stripeSessionId);
    expect(afterCancel.status).toBe('cancelled');
    expect(await countActiveReservationsForCar(carId)).toBe(0);
  });
});
