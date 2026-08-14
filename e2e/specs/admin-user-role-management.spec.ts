import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import { apiGet, loginAsAdmin } from '../helpers/csrf';
import {
  cleanupTestStaff,
  createStaffUserViaApi,
  getRoleBySlug,
  loginAsStaff,
  putUserRolesViaApi,
  STAFF_PASSWORD,
  uniqueStaffEmail,
} from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });

test.describe('AUTH-004 Owner creates staff; role change on new session', () => {
  test.setTimeout(120_000);

  const email = uniqueStaffEmail('created');

  test.afterAll(async () => {
    await cleanupTestStaff(email).catch(() => undefined);
  });

  test('owner creates support staff; role change reflected on new login', async ({
    adminPage,
    request,
    browser,
  }) => {
    await insertTestAdmin();
    const support = await getRoleBySlug('support');
    const cleaner = await getRoleBySlug('cleaner');
    expect(support).toBeTruthy();
    expect(cleaner).toBeTruthy();

    await adminPage.goto('/admin/users');
    await expect(adminPage.getByRole('heading', { name: 'Users' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByRole('heading', { name: 'Create staff user' })).toBeVisible();

    const created = await createStaffUserViaApi(request, {
      email,
      password: STAFF_PASSWORD,
      roleIds: [support!.id],
    });
    expect(created.ok, JSON.stringify(created.body)).toBeTruthy();
    const userId = Number(created.body?.data?.user?.id || created.body?.data?.id);
    expect(userId).toBeTruthy();

    const session = await loginAsStaff(request, { email, password: STAFF_PASSWORD });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(STAFF_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL(/\/admin/, { timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Contacts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cars' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Payments' })).toHaveCount(0);

    const adminSession = await loginAsAdmin(request);
    const changed = await putUserRolesViaApi(request, userId, [cleaner!.id], adminSession);
    expect(changed.ok, JSON.stringify(changed.body)).toBeTruthy();

    const stale = await apiGet(request, '/api/admin/orders', session);
    expect([401, 403]).toContain(stale.status());

    await page.goto('/login');
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(STAFF_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL(/\/admin/, { timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Cars' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Fleet alerts' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Orders' })).toHaveCount(0);
    await context.close();
  });
});
