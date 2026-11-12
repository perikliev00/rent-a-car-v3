// Import named exports from '../fixtures/base'.
import { test, expect } from '../fixtures/base';
// Import named exports from '../helpers/test-env'.
import { ADMIN_BASE_URL } from '../helpers/test-env';
// Import named exports from '../helpers/db'.
import { insertTestAdmin } from '../helpers/db';
// Import named exports from '../helpers/csrf'.
import { apiGet } from '../helpers/csrf';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  getRoleBySlug,
  // Contribute this line to the enclosing declaration or statement.
  getRolePermissionKeysViaApi,
  // Contribute this line to the enclosing declaration or statement.
  insertTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  loginAsStaff,
  // Contribute this line to the enclosing declaration or statement.
  STAFF_PASSWORD,
  // Contribute this line to the enclosing declaration or statement.
  updateRolePermissionsViaApi,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/rbac';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe('Roles UI permission revoke (95)', () => {
  // Call test.setTimeout to perform this step.
  test.setTimeout(180_000);

  // Continue the surrounding logic with this statement.
  let supportEmail: string | null = null;
  // Continue the surrounding logic with this statement.
  let supportRoleId: number | null = null;
  // Continue the surrounding logic with this statement.
  let originalKeys: string[] = [];

  // Call test.afterAll to perform this step.
  test.afterAll(async ({ request }) => {
    // Evaluate the condition and enter the branch when it is true.
    if (supportRoleId != null && originalKeys.length) {
      // Wait until the asynchronous operation resolves.
      await updateRolePermissionsViaApi(request, supportRoleId, originalKeys).catch(() => undefined);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (supportEmail) await cleanupTestStaff(supportEmail).catch(() => undefined);
  });

  // Define a single test case and its expectations.
  test('revoking support can_view_orders kills stale session and nav until restored', async ({
    // Contribute this line to the enclosing declaration or statement.
    adminPage,
    // Contribute this line to the enclosing declaration or statement.
    browser,
    // Contribute this line to the enclosing declaration or statement.
    request,
  // Continue the surrounding logic with this statement.
  }) => {
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
    // Create the support role constant.
    const supportRole = await getRoleBySlug('support');
    // Assert that the value matches the intended expectation.
    expect(supportRole).toBeTruthy();
    // Update supportRoleId with the right-hand side value.
    supportRoleId = supportRole!.id;
    // Store the awaited result in originalKeys.
    originalKeys = await getRolePermissionKeysViaApi(request, supportRoleId);
    // Assert that the value matches the intended expectation.
    expect(originalKeys).toContain('can_view_orders');

    // Create the support constant.
    const support = await insertTestStaff({ roleSlug: 'support' });
    // Update supportEmail with the right-hand side value.
    supportEmail = support.email;

    // Create the support session constant.
    const supportSession = await loginAsStaff(request, support);
    // Create the before constant.
    const before = await apiGet(request, '/api/admin/orders', supportSession);
    // Assert that the value matches the intended expectation.
    expect(before.ok(), await before.text()).toBeTruthy();

    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/roles');
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Roles' })).toBeVisible({
      // Provide the timeout field value.
      timeout: 15_000,
    });
    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: supportRole!.name, exact: true }).click();
    // Create the orders perm constant.
    const ordersPerm = adminPage.locator('label').filter({ hasText: 'can_view_orders' });
    // Wait until the asynchronous operation resolves.
    await expect(ordersPerm).toBeVisible();
    // Create the checkbox constant.
    const checkbox = ordersPerm.locator('input[type="checkbox"]');
    // Wait until the asynchronous operation resolves.
    await expect(checkbox).toBeChecked();
    // Wait until the asynchronous operation resolves.
    await checkbox.uncheck();
    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: 'Save permissions' }).click();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByText('Role permissions saved')).toBeVisible({ timeout: 15_000 });

    // Create the after constant.
    const after = await apiGet(request, '/api/admin/orders', supportSession);
    // Assert that the value matches the intended expectation.
    expect([401, 403]).toContain(after.status());

    // Create the ctx1 constant.
    const ctx1 = await browser.newContext({ baseURL: ADMIN_BASE_URL });
    // Create the page1 constant.
    const page1 = await ctx1.newPage();
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await page1.goto('/login');
      // Wait until the asynchronous operation resolves.
      await page1.getByLabel('Email').fill(support.email);
      // Wait until the asynchronous operation resolves.
      await page1.getByLabel('Password', { exact: true }).fill(STAFF_PASSWORD);
      // Wait until the asynchronous operation resolves.
      await page1.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
      // Wait until the asynchronous operation resolves.
      await page1.waitForURL(/\/admin/, { timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page1.getByRole('link', { name: 'Orders' })).toHaveCount(0);
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await ctx1.close();
    }

    // Create the restored constant.
    const restored = await updateRolePermissionsViaApi(request, supportRoleId, originalKeys);
    // Assert that the value matches the intended expectation.
    expect(restored.ok, JSON.stringify(restored.body)).toBeTruthy();

    // Create the ctx2 constant.
    const ctx2 = await browser.newContext({ baseURL: ADMIN_BASE_URL });
    // Create the page2 constant.
    const page2 = await ctx2.newPage();
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await page2.goto('/login');
      // Wait until the asynchronous operation resolves.
      await page2.getByLabel('Email').fill(support.email);
      // Wait until the asynchronous operation resolves.
      await page2.getByLabel('Password', { exact: true }).fill(STAFF_PASSWORD);
      // Wait until the asynchronous operation resolves.
      await page2.getByRole('main').getByRole('button', { name: /log in|sign in/i }).click();
      // Wait until the asynchronous operation resolves.
      await page2.waitForURL(/\/admin/, { timeout: 15_000 });
      // Wait until the asynchronous operation resolves.
      await expect(page2.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Wait until the asynchronous operation resolves.
      await ctx2.close();
    }
  });
});
