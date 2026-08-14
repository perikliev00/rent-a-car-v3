import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getActiveReservationForCar,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import { openOrderAndResolveConflict } from '../helpers/booking';

const CAR_NAME = `E2E Checkout Retry ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('GUEST-005 Checkout validation retry', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 130, nights: 3 });
  const guestEmail = uniqueEmail('checkout-retry');

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

  test('empty submit keeps hold; then filled Pay reaches stub success', async ({ page }) => {
    await openOrderAndResolveConflict(page, carId, range);
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    await page.waitForURL(new RegExp(`/checkout/${carId}`));

    const holdBefore = await getActiveReservationForCar(carId);
    expect(holdBefore).toBeTruthy();
    expect(['pending_payment', 'processing_payment']).toContain(holdBefore.status);

    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await expect(page).toHaveURL(new RegExp(`/checkout/${carId}`));

    const holdAfterEmpty = await getActiveReservationForCar(carId);
    expect(holdAfterEmpty).toBeTruthy();
    expect(Number(holdAfterEmpty.id)).toBe(Number(holdBefore.id));
    expect(['pending_payment', 'processing_payment']).toContain(holdAfterEmpty.status);

    await page.getByLabel('Full name').fill(E2E_GUEST.fullName);
    await page.getByLabel('Phone number').fill(E2E_GUEST.phoneNumber);
    await page.getByLabel('Email').fill(guestEmail);
    await page.getByLabel('Address').fill(E2E_GUEST.address);

    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get('session_id')).toMatch(/^cs_test_/);
  });
});
