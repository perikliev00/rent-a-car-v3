import { test, expect } from '../fixtures/base';
import { loginAsAdmin, apiGet } from '../helpers/csrf';
import { loginAsStaff } from '../helpers/rbac';
import { updateContactStatusViaApi, deleteContactViaApi } from '../helpers/contacts';
import { uniqueEmail } from '../helpers/test-env';

test.use({ role: 'support' });

test.describe.configure({ mode: 'serial' });

test.describe('CROSS-005 Contact → support inbox lifecycle', () => {
  test.setTimeout(120_000);

  test('guest submit → new → ready → done → delete', async ({ page, staffPage, staffUser, request }) => {
    const subject = `E2E Contact ${Date.now()}`;
    const email = uniqueEmail('contact');

    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: /Contact/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel('Name').fill('Contact Guest');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Subject').fill(subject);
    await page.getByLabel('Message').fill('Please help with my booking question.');
    await page.getByRole('button', { name: /Send|Submit/i }).click();
    await expect(page.getByText(/Message sent|get back to you/i)).toBeVisible({
      timeout: 15_000,
    });

    await staffPage.goto('/admin/contacts');
    await expect(staffPage.getByRole('heading', { name: /Contacts/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(staffPage.getByText(subject)).toBeVisible({ timeout: 15_000 });

    const session = await loginAsStaff(request, staffUser);
    const listed = await apiGet(request, '/api/admin/contacts', session);
    expect(listed.ok()).toBeTruthy();
    const body = await listed.json();
    const contacts = body?.data?.contacts ?? body?.contacts ?? [];
    const row = contacts.find((c: { subject?: string; email?: string }) => c.subject === subject || c.email === email);
    expect(row).toBeTruthy();
    const contactId = Number(row.id);
    expect(row.status).toBe('new');

    const ready = await updateContactStatusViaApi(request, session, contactId, 'ready');
    expect(ready.status, JSON.stringify(ready.body)).toBe(200);

    const done = await updateContactStatusViaApi(request, session, contactId, 'done');
    expect(done.status, JSON.stringify(done.body)).toBe(200);

    await staffPage.reload();
    await expect(staffPage.getByText(subject)).toBeVisible();
    const select = staffPage
      .locator('tr, div')
      .filter({ hasText: subject })
      .locator('select')
      .first();
    await expect(select).toHaveValue('done');

    const deleted = await deleteContactViaApi(request, session, contactId);
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);

    await staffPage.reload();
    await expect(staffPage.getByText(subject)).toHaveCount(0);

    // Optional audit via owner session
    const owner = await loginAsAdmin(request);
    const audit = await apiGet(
      request,
      '/api/admin/audit-logs?actionPrefix=admin&limit=50',
      owner
    );
    if (audit.ok()) {
      const auditBody = await audit.json();
      const logs = auditBody?.data?.logs ?? auditBody?.logs ?? [];
      const actions = logs.map((l: { action?: string }) => l.action);
      expect(
        actions.some(
          (a: string) =>
            a === 'admin.updated_contact_status' || a === 'admin.deleted_contact'
        )
      ).toBeTruthy();
    }
  });
});
