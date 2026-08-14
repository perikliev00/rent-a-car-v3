import { test, expect } from '@playwright/test';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
} from '../helpers/db';
import { allocateFutureRange } from '../helpers/test-env';
import { buildSearchQuery } from '../helpers/booking';

const CAR_NAME = `E2E Date Boundaries ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('MONEY-006 Date-boundary availability', () => {
  test.setTimeout(120_000);

  let carId: number;
  const booked = allocateFutureRange({ fromDaysAhead: 90, nights: 3 });
  // Adjacent half-open window: pickup at prior return instant is allowed.
  const adjacent = allocateFutureRange({ fromDaysAhead: 93, nights: 2 });
  const overlapping = {
    pickupDate: booked.pickupDate,
    returnDate: booked.returnDate,
    pickupTime: booked.pickupTime,
    returnTime: booked.returnTime,
  };

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
    await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: booked.pickupDate,
      returnDate: booked.returnDate,
      pickupTime: booked.pickupTime,
      returnTime: booked.returnTime,
    });
  });

  test('adjacent range still lists the car; overlapping range does not', async ({ page }) => {
    expect(adjacent.pickupDate).toBe(booked.returnDate);

    await page.goto(`/search?${buildSearchQuery(adjacent)}`);
    await expect(page.getByRole('heading', { name: CAR_NAME })).toBeVisible({ timeout: 15_000 });

    await page.goto(`/search?${buildSearchQuery(overlapping)}`);
    await expect(page.getByRole('heading', { name: CAR_NAME })).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
