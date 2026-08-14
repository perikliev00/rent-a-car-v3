import { test, expect } from '@playwright/test';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getActiveReservationForCar,
  countActiveReservationsForCar,
  withDb,
} from '../helpers/db';
import { allocateFutureRange } from '../helpers/test-env';
import { buildOrderUrl, openOrderAndResolveConflict } from '../helpers/booking';
import { parseSofiaDate } from '../helpers/dates';

const CAR_NAME = `E2E Rehold ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('GUEST-004 Booking rehold success', () => {
  test.setTimeout(120_000);

  let carId: number;
  const rangeA = allocateFutureRange({ fromDaysAhead: 115, nights: 3 });
  const rangeB = allocateFutureRange({ fromDaysAhead: 125, nights: 2 });

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

  test('release & rehold moves active hold to the new date range', async ({ page }) => {
    await openOrderAndResolveConflict(page, carId, rangeA);
    await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible();

    const holdA = await getActiveReservationForCar(carId);
    expect(holdA).toBeTruthy();
    const holdAId = Number(holdA.id);

    await page.goto(buildOrderUrl(carId, rangeB));
    await expect(
      page.getByText(/already reserved|already booked|already have an active/i)
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Release & rehold this car' }).click({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible({
      timeout: 15_000,
    });

    await expect.poll(async () => countActiveReservationsForCar(carId)).toBe(1);

    const holdB = await getActiveReservationForCar(carId);
    expect(holdB).toBeTruthy();
    expect(Number(holdB.id)).not.toBe(holdAId);

    const pickupB = parseSofiaDate(rangeB.pickupDate, rangeB.pickupTime)!;
    const returnB = parseSofiaDate(rangeB.returnDate, rangeB.returnTime)!;
    expect(new Date(holdB.pickup_date).getTime()).toBe(pickupB.getTime());
    expect(new Date(holdB.return_date).getTime()).toBe(returnB.getTime());

    const prior = await withDb(async (client) => {
      const result = await client.query(
        `SELECT status FROM reservations WHERE id = $1`,
        [holdAId]
      );
      return result.rows[0]?.status as string;
    });
    expect(['cancelled', 'expired']).toContain(prior);
  });
});
