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
  bumpSeasonSurcharge,
  type PricingConfigSnapshot,
} from '../helpers/pricing-config';

const CAR_NAME = `E2E Season Snapshot ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Season pricing snapshot immutability (90)', () => {
  test.setTimeout(120_000);

  let carId: number;
  let pricingSnapshot: PricingConfigSnapshot | null = null;
  const range = allocateFutureRange({ fromDaysAhead: 250, nights: 3 });

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    if (pricingSnapshot) {
      await restorePricingConfig(pricingSnapshot);
    }
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('held snapshot stays fixed after season bump; new quote sees new price', async ({
    page,
  }) => {
    await cleanupReservationsForCar(carId);
    pricingSnapshot = await snapshotPricingConfig();

    try {
      await openOrderAndResolveConflict(page, carId, range);
      const heldTotal = await readOrderSummaryTotal(page);
      const hold = await getActiveReservationForCar(carId);
      expect(hold).toBeTruthy();
      await assertReservationTotalPrice(Number(hold.id), heldTotal);

      const { after, before } = await bumpSeasonSurcharge(25);
      expect(after).toBeGreaterThan(before);

      const holdAfterBump = await getActiveReservationForCar(carId);
      expect(Number(holdAfterBump.id)).toBe(Number(hold.id));
      await assertReservationTotalPrice(Number(holdAfterBump.id), heldTotal);

      await cleanupReservationsForCar(carId);
      await openOrderAndResolveConflict(page, carId, range);
      await expect(page.getByText('Total', { exact: true })).toBeVisible({ timeout: 15_000 });
      const liveTotal = await readOrderSummaryTotal(page);
      expect(liveTotal).toBeGreaterThan(heldTotal);
    } finally {
      if (pricingSnapshot) {
        await restorePricingConfig(pricingSnapshot);
        pricingSnapshot = null;
      }
    }
  });
});
