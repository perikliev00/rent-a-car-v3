import { test, expect } from '../fixtures/base';
import { ADMIN_BASE_URL } from '../helpers/test-env';
import { insertTestAdmin } from '../helpers/db';
import { apiGet } from '../helpers/csrf';
import {
  cleanupTestStaff,
  getRoleBySlug,
  getRolePermissionKeysViaApi,
  insertTestStaff,
  loginAsStaff,
  STAFF_PASSWORD,
  updateRolePermissionsViaApi,
} from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });

test.describe('Roles UI permission revoke (95)', () => {
  test.setTimeout(180_000);

  let supportEmail: string | null = null;
  let supportRoleId: number | null = null;
  let originalKeys: string[] = [];

  test.afterAll(async ({ request }) => {
    if (supportRoleId != null && originalKeys.length) {
      await updateRolePermissionsViaApi(request, supportRoleId, originalKeys).catch(() => undefined);
    }
    if (supportEmail) await cleanupTestStaff(supportEmail).catch(() => undefined);
  });

  test('revoking support can_view_orders kills stale session and nav until restored', async ({
    adminPage,
    browser,
    request,
  }) => {
    await insertTestAdmin();
    const supportRole = await getRoleBySlug('support');
    expect(supportRole).toBeTruthy();
    supportRoleId = supportRole!.id;
    originalKeys = await getRolePermissionKeysViaApi(request, supportRoleId);
    expect(originalKeys).toContain('can_view_orders');

    const support = await insertTestStaff({ roleSlug: 'support' });
    supportEmail = support.email;

    const supportSession = await loginAsStaff(request, support);
    const before = await apiGet(request, '/api/admin/orders', supportSession);
    expect(before.ok(), await before.text()).toBeTruthy();

    await adminPage.goto('/admin/roles');
    await expect(adminPage.getByRole('heading', { name: 'Roles' })).toBeVisible({
      timeout: 15_000,
    });
    await adminPage.getByRole('button', { name: supportRole!.name, exact: true }).click();
    const ordersPerm = adminPage.locator('label').filter({ hasText: 'can_view_orders' });
    await expect(ordersPerm).toBeVisible();
    const checkbox = ordersPerm.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await adminPage.getByRole('button', { name: 'Save permissions' }).click();
    await expect(adminPage.getByText('Role permissions saved')).toBeVisible({ timeout: 15_000 });

    const after = await apiGet(request, '/api/admin/orders', supportSession);
    expect([401, 403]).toContain(after.status());

    const ctx1 = await browser.newContext({ baseURL: ADMIN_BASE_URL });
    const page1 = await ctx1.newPage();
    try {
      await page1.goto('/login');
      await page1.getByLabel('Email').fill(support.email);
      await page1.getByLabel('Password', { exact: true }).fill(STAFF_PASSWORD);
      await page1.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
      await page1.waitForURL(/\/admin/, { timeout: 15_000 });
      await expect(page1.getByRole('link', { name: 'Orders' })).toHaveCount(0);
    } finally {
      await ctx1.close();
    }

    const restored = await updateRolePermissionsViaApi(request, supportRoleId, originalKeys);
    expect(restored.ok, JSON.stringify(restored.body)).toBeTruthy();

    const ctx2 = await browser.newContext({ baseURL: ADMIN_BASE_URL });
    const page2 = await ctx2.newPage();
    try {
      await page2.goto('/login');
      await page2.getByLabel('Email').fill(support.email);
      await page2.getByLabel('Password', { exact: true }).fill(STAFF_PASSWORD);
      await page2.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
      await page2.waitForURL(/\/admin/, { timeout: 15_000 });
      await expect(page2.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
    } finally {
      await ctx2.close();
    }
  });
});
