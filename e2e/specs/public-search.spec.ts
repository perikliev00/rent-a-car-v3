// Import named exports from '@playwright/test'.
import { expect, test } from '@playwright/test';
// Import named exports from '../helpers/booking'.
import { buildSearchQuery } from '../helpers/booking';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/test-env'.
import { allocateFutureRange } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("public-search-filters", () => {
  // Create the prefix constant.
  const PREFIX = `E2E Filters ${Date.now()}`;
  // Create the manual name constant.
  const MANUAL_NAME = `${PREFIX} Manual`;
  // Create the auto name constant.
  const AUTO_NAME = `${PREFIX} Auto`;
  // Create the page prefix constant.
  const PAGE_PREFIX = `${PREFIX} Page`;

  // Call test.describe to perform this step.
  test.describe('GUEST-001 Public search filters', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let manualCarId: number;
    // Contribute this line to the enclosing declaration or statement.
    let autoCarId: number;
    // Continue the surrounding logic with this statement.
    const pageCarIds: number[] = [];
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 100, nights: 3 });

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await insertTestAdmin();
      // seats=8 isolates filter cars from the seeded fleet (mostly 4–5 seats).
      manualCarId = await insertIsolatedTestCar(MANUAL_NAME, 55, {
        // Provide the transmission field value.
        transmission: 'Manual',
        // Provide the fuel type field value.
        fuelType: 'Petrol',
        // Provide the seats field value.
        seats: 8,
      });
      // Store the awaited result in autoCarId.
      autoCarId = await insertIsolatedTestCar(AUTO_NAME, 55, {
        // Provide the transmission field value.
        transmission: 'Automatic',
        // Provide the fuel type field value.
        fuelType: 'Petrol',
        // Provide the seats field value.
        seats: 8,
      });
      // Iterate using the loop initializer, condition, and step.
      for (let i = 0; i < 4; i += 1) {
        // Call pageCarIds.push to perform this step.
        pageCarIds.push(
          // Wait until the asynchronous operation resolves.
          await insertIsolatedTestCar(`${PAGE_PREFIX} ${i}`, 60, {
            // Provide the transmission field value.
            transmission: 'Automatic',
            // Provide the fuel type field value.
            fuelType: 'Diesel',
            // Provide the seats field value.
            seats: 9,
          })
        );
      }
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Iterate using the loop initializer, condition, and step.
      for (const id of [...pageCarIds, manualCarId, autoCarId]) {
        // Wait until the asynchronous operation resolves.
        await cleanupReservationsForCar(id);
        // Wait until the asynchronous operation resolves.
        await cleanupTestCar(id);
      }
    });

    // Define a single test case and its expectations.
    test('fleet filter, pagination, and View details preserve booking query', async ({ page }) => {
      // Create the base constant.
      const base = buildSearchQuery(range);

      // Wait until the asynchronous operation resolves.
      await page.goto(`/search?${base}&seatsMin=8&seatsMax=8`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: MANUAL_NAME })).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: AUTO_NAME })).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Transmission').selectOption('Manual');
      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/transmission=Manual/);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: MANUAL_NAME })).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: AUTO_NAME })).toHaveCount(0);

      // Create the card constant.
      const card = page.locator('article').filter({ hasText: MANUAL_NAME });
      // Wait until the asynchronous operation resolves.
      await card.getByRole('link', { name: /^View$/ }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(new RegExp(`/cars/${manualCarId}`));
      // Create the detail url constant.
      const detailUrl = new URL(page.url());
      // Assert that the value matches the intended expectation.
      expect(detailUrl.searchParams.get('pickup-date')).toBe(range.pickupDate);
      // Assert that the value matches the intended expectation.
      expect(detailUrl.searchParams.get('return-date')).toBe(range.returnDate);
      // Assert that the value matches the intended expectation.
      expect(detailUrl.searchParams.get('pickup-location')).toBe('office');
      // Assert that the value matches the intended expectation.
      expect(detailUrl.searchParams.get('return-location')).toBe('office');
      // Assert that the value matches the intended expectation.
      expect(detailUrl.searchParams.get('transmission')).toBe('Manual');
      // Assert that the value matches the intended expectation.
      expect(detailUrl.searchParams.get('seatsMin')).toBe('8');

      // Wait until the asynchronous operation resolves.
      await page.goto(`/search?${base}&seatsMin=9&seatsMax=9`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible({ timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Next' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page).toHaveURL(/page=2/);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: new RegExp(PAGE_PREFIX) }).first()).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
    });
  });
});

// Call test.describe to perform this step.
test.describe("public-search-validation", () => {
  // Call test.describe to perform this step.
  test.describe('GUEST-002 Public search validation', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(60_000);

    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 105, nights: 2 });

    // Define a single test case and its expectations.
    test('invalid search params show recovery CTA', async ({ page }) => {
      // Wait until the asynchronous operation resolves.
      await page.goto('/search');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('Invalid search parameters.')).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('link', { name: 'Go back home' })).toBeVisible();
    });

    // Define a single test case and its expectations.
    test('impossible filters show empty fleet state', async ({ page }) => {
      // Create the qs constant.
      const qs = new URLSearchParams(buildSearchQuery(range));
      // Call qs.set to perform this step.
      qs.set('transmission', 'Manual');
      // Call qs.set to perform this step.
      qs.set('fuelType', 'Electric');
      // Call qs.set to perform this step.
      qs.set('seatsMin', '9');
      // Call qs.set to perform this step.
      qs.set('seatsMax', '2');
      // Wait until the asynchronous operation resolves.
      await page.goto(`/search?${qs.toString()}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText('No cars available')).toBeVisible({ timeout: 15_000 });
    });

    // Define a single test case and its expectations.
    test('unknown car detail shows not found', async ({ page }) => {
      // Wait until the asynchronous operation resolves.
      await page.goto(`/cars/999999999?${buildSearchQuery(range)}`);
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(/Car not found|not found/i)).toBeVisible({ timeout: 15_000 });
    });
  });
});
