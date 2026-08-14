import { test, expect } from '@playwright/test';
import { withDb, countOrdersByGuestEmail } from '../helpers/db';

test.describe.configure({ mode: 'serial' });

test.describe('Checkout success invalid session (87)', () => {
  test.setTimeout(60_000);

  test('missing session_id shows clear error and no confirmed booking', async ({ page }) => {
    const confirmedBefore = await withDb(async (client) => {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'confirmed'`
      );
      return result.rows[0].count as number;
    });

    await page.goto('/checkout/success');
    await expect(page.getByRole('heading', { name: 'No payment session' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Go home' }).first()).toBeVisible();

    const confirmedAfter = await withDb(async (client) => {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'confirmed'`
      );
      return result.rows[0].count as number;
    });
    expect(confirmedAfter).toBe(confirmedBefore);
  });

  test('bad session_id fails verification without Booking Confirmed', async ({ page }) => {
    await page.goto('/checkout/success?session_id=cs_test_not_a_real_session_xyz');
    await expect(page.getByRole('heading', { name: 'Payment verification failed' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Go home' }).first()).toBeVisible();
    expect(await countOrdersByGuestEmail('no-such-guest@example.com')).toBe(0);
  });
});
