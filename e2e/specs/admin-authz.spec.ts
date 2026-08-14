import { test, expect } from '@playwright/test';

test.describe('Admin authorization', () => {
  test('unauthenticated visitor is redirected away from admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /log in|login|create account/i })).toBeVisible();
  });

  test('customer cannot open admin dashboard', async ({ page }) => {
    const email = `customer-e2e-${Date.now()}@example.com`;
    const password = 'Customer123!';

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).not.toBeVisible();
  });
});
