import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getActiveReservationForCar,
} from '../helpers/db';
import { allocateFutureRange } from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  readOrderSummaryTotal,
} from '../helpers/booking';

const CAR_NAME = `E2E Addons ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('GUEST-003 Booking add-ons', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 110, nights: 3 });

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

  test('toggling insurance and hotel delivery updates total, URL, and hold', async ({ page }) => {
    await openOrderAndResolveConflict(page, carId, range);
    await expect(page.getByRole('heading', { name: 'Add-ons & options' })).toBeVisible({
      timeout: 15_000,
    });

    const baseTotal = await readOrderSummaryTotal(page);

    await page.locator('label').filter({ hasText: /Basic insurance/i }).click();
    await expect(page).toHaveURL(/extras=.*insurance_basic/);
    await expect
      .poll(async () => readOrderSummaryTotal(page), { timeout: 15_000 })
      .toBeGreaterThan(baseTotal);

    const afterInsurance = await readOrderSummaryTotal(page);

    await page.locator('label').filter({ hasText: /Hotel delivery/i }).click();
    await expect(page).toHaveURL(/hotelDelivery=1/);
    await expect
      .poll(async () => readOrderSummaryTotal(page), { timeout: 15_000 })
      .toBeGreaterThan(afterInsurance);

    const withHotel = await readOrderSummaryTotal(page);
    expect(withHotel).toBeGreaterThan(baseTotal);

    await expect
      .poll(async () => {
        const hold = await getActiveReservationForCar(carId);
        if (!hold) return null;
        const extras = hold.selected_extras;
        const codes = Array.isArray(extras)
          ? extras
          : typeof extras === 'string'
            ? JSON.parse(extras)
            : extras;
        return {
          hotel: Boolean(hold.hotel_delivery),
          hasInsurance: Array.isArray(codes) && codes.includes('insurance_basic'),
          total: Number(hold.total_price),
        };
      }, { timeout: 15_000 })
      .toEqual(
        expect.objectContaining({
          hotel: true,
          hasInsurance: true,
          total: withHotel,
        })
      );
  });
});
