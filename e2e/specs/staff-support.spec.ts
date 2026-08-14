import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import { apiGet, apiPost } from '../helpers/csrf';
import { createCalendarTaskViaApi, loginAsStaff } from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });
test.use({ role: 'support' });

test.describe('STAFF-006 Support scope', () => {
  test.setTimeout(90_000);

  test('support orders/contacts/calendar; no tasks or payments', async ({
    staffPage,
    staffUser,
    request,
  }) => {
    await insertTestAdmin();

    await expect(staffPage.getByRole('link', { name: 'Orders' })).toBeVisible({ timeout: 15_000 });
    await expect(staffPage.getByRole('link', { name: 'Contacts' })).toBeVisible();
    await expect(staffPage.getByRole('link', { name: 'Calendar' })).toBeVisible();

    await expect(staffPage.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'My tasks' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Payments' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await expect(staffPage.getByRole('link', { name: 'Cars' })).toHaveCount(0);

    const session = await loginAsStaff(request, staffUser);
    const orders = await apiGet(request, '/api/admin/orders', session);
    expect(orders.ok(), await orders.text()).toBeTruthy();

    const contacts = await apiGet(request, '/api/admin/contacts', session);
    expect(contacts.ok(), await contacts.text()).toBeTruthy();

    const refund = await apiPost(request, '/api/admin/payments/reconcile', { dryRun: true }, session);
    expect(refund.status()).toBe(403);

    const tasks = await createCalendarTaskViaApi(
      request,
      {
        title: 'support blocked',
        taskType: 'document_check',
        startsAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
      },
      session
    );
    expect(tasks.status).toBe(403);

    const users = await apiGet(request, '/api/admin/users', session);
    expect(users.status()).toBe(403);
  });
});
