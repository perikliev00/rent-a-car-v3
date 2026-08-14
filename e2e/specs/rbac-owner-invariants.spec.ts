import { test, expect } from '../fixtures/base';
import { insertTestAdmin, withDb } from '../helpers/db';
import { apiGet, loginAsAdmin } from '../helpers/csrf';
import {
  cleanupTestStaff,
  getRoleBySlug,
  insertTestStaff,
  putUserRolesViaApi,
  updateRolePermissionsViaApi,
} from '../helpers/rbac';
import { ADMIN_EMAIL } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe('AUTH-005 Owner / last-owner protection', () => {
  test.setTimeout(90_000);

  let secondOwnerEmail: string | null = null;

  test.afterAll(async () => {
    if (secondOwnerEmail) await cleanupTestStaff(secondOwnerEmail).catch(() => undefined);
    // Always restore owner on the shared admin account.
    await insertTestAdmin();
  });

  test('cannot remove last owner or edit owner permissions', async ({ request }) => {
    await insertTestAdmin();
    const ownerRole = await getRoleBySlug('owner');
    const supportRole = await getRoleBySlug('support');
    expect(ownerRole).toBeTruthy();
    expect(supportRole).toBeTruthy();

    const adminSession = await loginAsAdmin(request);
    const usersRes = await apiGet(request, '/api/admin/users', adminSession);
    const usersBody = await usersRes.json();
    const users = usersBody?.data?.users || [];

    // Demote any leftover e2e owners so ADMIN_EMAIL is the sole owner.
    for (const u of users) {
      const email = String(u.email || '').toLowerCase();
      if (email === ADMIN_EMAIL.toLowerCase()) continue;
      const slugs = (u.roles || []).map((r: { slug?: string }) => r.slug);
      if (slugs.includes('owner')) {
        await putUserRolesViaApi(request, u.id, [supportRole!.id], adminSession);
      }
    }

    const adminUser = users.find(
      (u: { email?: string }) => String(u.email).toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
    expect(adminUser).toBeTruthy();

    const ownerCount = await withDb(async (client) => {
      const result = await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE r.slug = 'owner'
        `
      );
      return Number(result.rows[0].count);
    });
    expect(ownerCount).toBe(1);

    const removeLast = await putUserRolesViaApi(request, adminUser.id, [], adminSession);
    expect(removeLast.status).toBe(409);
    expect(removeLast.body?.error?.code).toBe('LAST_OWNER');

    const locked = await updateRolePermissionsViaApi(
      request,
      ownerRole!.id,
      ['can_view_orders'],
      adminSession
    );
    expect(locked.status).toBe(409);
    expect(locked.body?.error?.code).toBe('OWNER_LOCKED');

    const second = await insertTestStaff({ roleSlug: 'owner' });
    secondOwnerEmail = second.email;
    const demoteSecond = await putUserRolesViaApi(
      request,
      second.userId,
      [supportRole!.id],
      adminSession
    );
    expect(demoteSecond.ok, JSON.stringify(demoteSecond.body)).toBeTruthy();

    const stillOwner = await putUserRolesViaApi(request, adminUser.id, [], adminSession);
    expect(stillOwner.status).toBe(409);
    expect(stillOwner.body?.error?.code).toBe('LAST_OWNER');
  });
});
