import { test, expect } from '../fixtures/base';
import { loginAsAdmin, apiGet } from '../helpers/csrf';
import { loginAsStaff } from '../helpers/rbac';
import {
  createContactViaApi,
  updateContactStatusViaApi,
  deleteContactViaApi,
} from '../helpers/contacts';
import { uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-025 Audit logs', () => {
  test.setTimeout(90_000);

  test('owner sees audited contact mutation; staff without permission blocked', async ({
    adminPage,
    request,
  }) => {
    const subject = `E2E Audit Contact ${Date.now()}`;
    const email = uniqueEmail('audit-contact');
    const created = await createContactViaApi(request, {
      name: 'Audit Guest',
      email,
      subject,
      message: 'Audit trail fixture message.',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const contactId = created.contactId!;
    expect(contactId).toBeTruthy();

    const owner = await loginAsAdmin(request);
    const patched = await updateContactStatusViaApi(request, owner, contactId, 'ready');
    expect(patched.status, JSON.stringify(patched.body)).toBe(200);

    const list = await apiGet(
      request,
      '/api/admin/audit-logs?actionPrefix=admin&action=admin.updated_contact_status&limit=50',
      owner
    );
    expect(list.ok(), await list.text()).toBeTruthy();
    const body = await list.json();
    const logs = body?.data?.logs ?? body?.logs ?? [];
    const match = logs.find(
      (l: { action?: string; entityId?: string | number }) =>
        l.action === 'admin.updated_contact_status' &&
        String(l.entityId) === String(contactId)
    );
    expect(match).toBeTruthy();
    expect(match.actorType || match.adminUser).toBeTruthy();

    await adminPage.goto('/admin/audit-logs');
    await expect(adminPage.getByRole('heading', { name: 'Audit logs', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByText(/Updated contact status/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await deleteContactViaApi(request, owner, contactId);
  });
});

test.describe('ADMIN-025 audit logs denied for cleaner', () => {
  test.use({ role: 'cleaner' });
  test.setTimeout(90_000);

  test('cleaner cannot list or open audit logs', async ({ staffPage, staffUser, request }) => {
    const session = await loginAsStaff(request, staffUser);
    const res = await apiGet(request, '/api/admin/audit-logs?limit=10', session);
    expect(res.status()).toBe(403);

    await staffPage.goto('/admin');
    await expect(staffPage.getByRole('link', { name: 'Audit logs' })).toHaveCount(0);
  });
});
