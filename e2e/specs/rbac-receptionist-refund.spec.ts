import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import { apiPost } from '../helpers/csrf';
import { cleanupTestStaff, insertTestStaff, loginAsStaff } from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });
test.use({ role: 'receptionist' });

test.describe('AUTH-003 Receptionist ops ok, refund forbidden', () => {
  test.setTimeout(90_000);

  let accountantEmail: string | null = null;

  test.afterAll(async () => {
    if (accountantEmail) await cleanupTestStaff(accountantEmail).catch(() => undefined);
  });

  test('receptionist cannot reconcile; accountant can see Reconcile', async ({
    staffPage,
    staffUser,
    request,
    browser,
  }) => {
    await insertTestAdmin();

    await expect(staffPage.getByRole('link', { name: 'Ops' })).toBeVisible({ timeout: 15_000 });
    await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);

    const receptionSession = await loginAsStaff(request, staffUser);
    const forbidden = await apiPost(
      request,
      '/api/admin/payments/reconcile',
      { dryRun: true },
      receptionSession
    );
    expect(forbidden.status()).toBe(403);

    const accountant = await insertTestStaff({ roleSlug: 'accountant' });
    accountantEmail = accountant.email;
    const accountantSession = await loginAsStaff(request, accountant);
    const allowed = await apiPost(
      request,
      '/api/admin/payments/reconcile',
      { dryRun: true },
      accountantSession
    );
    expect(allowed.status()).not.toBe(403);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel(/^email$/i).fill(accountant.email);
    await page.getByLabel(/^password$/i).fill(accountant.password);
    await page.locator('form').getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL(/\/admin/, { timeout: 20_000 });
    await page.goto('/admin/payments');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Reconcile' })).toBeVisible();
    await context.close();
  });
});
