import { test, expect } from '@playwright/test';

test.describe('Customer account portal auth', () => {
  test('unauthenticated visitor is redirected from account dashboard', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
  });

  test('customer can open account dashboard after signup', async ({ page }) => {
    const email = `portal-e2e-${Date.now()}@example.com`;
    const password = 'Customer123!';

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('customer is denied admin pricing page', async ({ page }) => {
    const email = `pricing-deny-${Date.now()}@example.com`;
    const password = 'Customer123!';

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('main').getByRole('button', { name: /sign up|create account/i }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    await page.goto('/admin/pricing');
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
      timeout: 15_000,
    });
  });
});
