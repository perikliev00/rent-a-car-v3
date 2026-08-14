import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  countActiveReservationsForCar,
  getActiveReservationForCar,
  assertReservationStatus,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  continueToCheckoutAndFillGuest,
  fillHomeSearch,
} from '../helpers/booking';
import { searchPublicCars } from '../helpers/fleet';

const CAR_NAME = `E2E Stripe Cancel ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Stripe cancel mid-checkout (86)', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 220, nights: 2 });
  const guestEmail = uniqueEmail('stripe-cancel');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('cancel URL releases pending_payment hold and frees search', async ({ page, request }) => {
    await cleanupReservationsForCar(carId);

    await openOrderAndResolveConflict(page, carId, range);
    await continueToCheckoutAndFillGuest(page, carId, {
      ...E2E_GUEST,
      email: guestEmail,
      hotelName: '',
    });

    const hold = await getActiveReservationForCar(carId);
    expect(hold).toBeTruthy();
    expect(hold.status).toBe('pending_payment');
    const reservationId = Number(hold.id);

    // Simulate Stripe back/cancel without completing payment (stub has no cancel_url UI).
    await page.goto('/checkout/cancel');
    await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/hold has been released/i).first()).toBeVisible();

    await assertReservationStatus(reservationId, 'cancelled');
    expect(await countActiveReservationsForCar(carId)).toBe(0);

    const search = await searchPublicCars(request, {
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
    });
    expect(search.status).toBe(200);
    expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(true);

    await fillHomeSearch(page, range);
    await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });
  });
});
