import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getActiveReservationForCar,
  assertReservationTotalPrice,
} from '../helpers/db';
import { allocateFutureRange } from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  readOrderSummaryTotal,
} from '../helpers/booking';
import {
  snapshotPricingConfig,
  restorePricingConfig,
  bumpHotelDeliveryFee,
  type PricingConfigSnapshot,
} from '../helpers/pricing-config';

const CAR_NAME = `E2E Snapshot Immutable ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('MONEY-012 Pricing snapshot immutability', () => {
  test.setTimeout(120_000);

  let carId: number;
  let pricingSnapshot: PricingConfigSnapshot | null = null;
  const range = allocateFutureRange({ fromDaysAhead: 135, nights: 3 });

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    if (pricingSnapshot) {
      await restorePricingConfig(pricingSnapshot);
    }
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('held snapshot stays fixed after live fee bump; new quote sees new price', async ({
    page,
  }) => {
    pricingSnapshot = await snapshotPricingConfig();

    try {
      await openOrderAndResolveConflict(page, carId, range, { hotelDelivery: true });
      const heldTotal = await readOrderSummaryTotal(page);
      const hold = await getActiveReservationForCar(carId);
      expect(hold).toBeTruthy();
      expect(Boolean(hold.hotel_delivery)).toBe(true);
      await assertReservationTotalPrice(Number(hold.id), heldTotal);

      const { before, after } = await bumpHotelDeliveryFee(100);
      expect(after).toBe(before + 100);

      const holdAfterBump = await getActiveReservationForCar(carId);
      expect(holdAfterBump).toBeTruthy();
      expect(Number(holdAfterBump.id)).toBe(Number(hold.id));
      await assertReservationTotalPrice(Number(holdAfterBump.id), heldTotal);

      // Clear the held reservation so a fresh quote uses live pricing config.
      await cleanupReservationsForCar(carId);
      await openOrderAndResolveConflict(page, carId, range, { hotelDelivery: true });
      await expect(page.getByText('Total', { exact: true })).toBeVisible({ timeout: 15_000 });
      const liveTotal = await readOrderSummaryTotal(page);
      expect(liveTotal).toBeGreaterThan(heldTotal);
      expect(liveTotal).toBeCloseTo(heldTotal + 100, 2);
    } finally {
      if (pricingSnapshot) {
        await restorePricingConfig(pricingSnapshot);
        pricingSnapshot = null;
      }
    }
  });
});
