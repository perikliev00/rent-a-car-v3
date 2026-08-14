import { test, expect } from '@playwright/test';
import { allocateFutureRange } from '../helpers/test-env';
import { buildSearchQuery } from '../helpers/booking';

test.describe.configure({ mode: 'serial' });

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
