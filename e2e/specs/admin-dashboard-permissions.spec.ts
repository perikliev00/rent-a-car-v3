import { test, expect } from '../fixtures/base';
import { loginAsAdmin, apiGet } from '../helpers/csrf';
import { loginAsStaff } from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-022 Dashboard counters + permission masking', () => {
  test.setTimeout(90_000);

  test('owner sees numeric counters', async ({ adminPage, request }) => {
    await adminPage.goto('/admin');
    await expect(adminPage.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByText('Total orders')).toBeVisible();

    const session = await loginAsAdmin(request);
    const res = await apiGet(request, '/api/admin/dashboard', session);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const stats = body?.data?.stats ?? body?.stats;
    expect(stats.totalOrders).not.toBeNull();
    expect(typeof stats.totalOrders).toBe('number');
    expect(stats.totalRevenue).not.toBeNull();
  });
});

test.describe('ADMIN-022 cleaner masked stats', () => {
  test.use({ role: 'cleaner' });
  test.setTimeout(90_000);

  test('cleaner dashboard masks orders/revenue as em dash', async ({
    staffPage,
    staffUser,
    request,
  }) => {
    const session = await loginAsStaff(request, staffUser);
    const res = await apiGet(request, '/api/admin/dashboard', session);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const stats = body?.data?.stats ?? body?.stats;
    expect(stats.totalOrders).toBeNull();
    expect(stats.pendingOrders).toBeNull();
    expect(stats.totalRevenue).toBeNull();

    await staffPage.goto('/admin');
    await expect(staffPage.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const ordersCard = staffPage
      .locator('div.rounded-2xl')
      .filter({ hasText: 'Total orders' })
      .first();
    await expect(ordersCard.getByText('—', { exact: true })).toBeVisible();

    const revenueCard = staffPage
      .locator('div.rounded-2xl')
      .filter({ hasText: 'Total revenue' })
      .first();
    await expect(revenueCard.getByText('—', { exact: true })).toBeVisible();
    await expect(revenueCard.getByText(/€0/)).toHaveCount(0);
  });
});
