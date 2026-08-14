import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  getReservationById,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';

const CAR_NAME = `E2E Cancel Noop ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Checkout cancel with nothing to cancel (102)', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 80, nights: 2 });
  const foreignEmail = uniqueEmail('foreign-hold');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('cold cancel shows calm message and does not touch foreign hold', async ({ page }) => {
    const foreign = await seedLinkedBooking({
      carId,
      status: 'pending_payment',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      guest: { ...E2E_GUEST, email: foreignEmail, fullName: 'Foreign Hold' },
    });

    await page.goto('/checkout/cancel');
    await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/No active reservation hold to cancel/i)).toBeVisible({
      timeout: 15_000,
    });

    await assertReservationStatus(foreign.reservationId, 'pending_payment');
    const row = await getReservationById(foreign.reservationId);
    expect(row.status).toBe('pending_payment');
  });

  test('cancel after confirmed booking does not cancel that reservation', async ({ page }) => {
    const confirmed = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      guest: { ...E2E_GUEST, email: uniqueEmail('confirmed-noop'), fullName: 'Confirmed Noop' },
    });

    await page.goto('/checkout/cancel');
    await expect(page.getByText(/No active reservation hold to cancel/i)).toBeVisible({
      timeout: 15_000,
    });
    await assertReservationStatus(confirmed.reservationId, 'confirmed');
  });
});
