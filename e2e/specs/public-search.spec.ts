import { expect, test } from '@playwright/test';
import { buildSearchQuery } from '../helpers/booking';
import {
  cleanupReservationsForCar,
  cleanupTestCar,
  insertIsolatedTestCar,
  insertTestAdmin,
} from '../helpers/db';
import { allocateFutureRange } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("public-search-filters", () => {
  const PREFIX = `E2E Filters ${Date.now()}`;
  const MANUAL_NAME = `${PREFIX} Manual`;
  const AUTO_NAME = `${PREFIX} Auto`;
  const PAGE_PREFIX = `${PREFIX} Page`;

  test.describe('GUEST-001 Public search filters', () => {
    test.setTimeout(120_000);

    let manualCarId: number;
    let autoCarId: number;
    const pageCarIds: number[] = [];
    const range = allocateFutureRange({ fromDaysAhead: 100, nights: 3 });

    test.beforeAll(async () => {
      await insertTestAdmin();
      // seats=8 isolates filter cars from the seeded fleet (mostly 4–5 seats).
      manualCarId = await insertIsolatedTestCar(MANUAL_NAME, 55, {
        transmission: 'Manual',
        fuelType: 'Petrol',
        seats: 8,
      });
      autoCarId = await insertIsolatedTestCar(AUTO_NAME, 55, {
        transmission: 'Automatic',
        fuelType: 'Petrol',
        seats: 8,
      });
      for (let i = 0; i < 4; i += 1) {
        pageCarIds.push(
          await insertIsolatedTestCar(`${PAGE_PREFIX} ${i}`, 60, {
            transmission: 'Automatic',
            fuelType: 'Diesel',
            seats: 9,
          })
        );
      }
    });

    test.afterAll(async () => {
      for (const id of [...pageCarIds, manualCarId, autoCarId]) {
        await cleanupReservationsForCar(id);
        await cleanupTestCar(id);
      }
    });

    test('fleet filter, pagination, and View details preserve booking query', async ({ page }) => {
      const base = buildSearchQuery(range);

      await page.goto(`/search?${base}&seatsMin=8&seatsMax=8`);
      await expect(page.getByRole('heading', { name: MANUAL_NAME })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: AUTO_NAME })).toBeVisible();

      await page.getByLabel('Transmission').selectOption('Manual');
      await expect(page).toHaveURL(/transmission=Manual/);
      await expect(page.getByRole('heading', { name: MANUAL_NAME })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: AUTO_NAME })).toHaveCount(0);

      const card = page.locator('article').filter({ hasText: MANUAL_NAME });
      await card.getByRole('link', { name: /^View$/ }).click();
      await expect(page).toHaveURL(new RegExp(`/cars/${manualCarId}`));
      const detailUrl = new URL(page.url());
      expect(detailUrl.searchParams.get('pickup-date')).toBe(range.pickupDate);
      expect(detailUrl.searchParams.get('return-date')).toBe(range.returnDate);
      expect(detailUrl.searchParams.get('pickup-location')).toBe('office');
      expect(detailUrl.searchParams.get('return-location')).toBe('office');
      expect(detailUrl.searchParams.get('transmission')).toBe('Manual');
      expect(detailUrl.searchParams.get('seatsMin')).toBe('8');

      await page.goto(`/search?${base}&seatsMin=9&seatsMax=9`);
      await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page.getByRole('heading', { name: new RegExp(PAGE_PREFIX) }).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});

test.describe("public-search-validation", () => {
  test.describe('GUEST-002 Public search validation', () => {
    test.setTimeout(60_000);

    const range = allocateFutureRange({ fromDaysAhead: 105, nights: 2 });

    test('invalid search params show recovery CTA', async ({ page }) => {
      await page.goto('/search');
      await expect(page.getByText('Invalid search parameters.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Go back home' })).toBeVisible();
    });

    test('impossible filters show empty fleet state', async ({ page }) => {
      const qs = new URLSearchParams(buildSearchQuery(range));
      qs.set('transmission', 'Manual');
      qs.set('fuelType', 'Electric');
      qs.set('seatsMin', '9');
      qs.set('seatsMax', '2');
      await page.goto(`/search?${qs.toString()}`);
      await expect(page.getByText('No cars available')).toBeVisible({ timeout: 15_000 });
    });

    test('unknown car detail shows not found', async ({ page }) => {
      await page.goto(`/cars/999999999?${buildSearchQuery(range)}`);
      await expect(page.getByText(/Car not found|not found/i)).toBeVisible({ timeout: 15_000 });
    });
  });
});
