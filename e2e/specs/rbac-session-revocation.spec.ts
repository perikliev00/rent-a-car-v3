import { test, expect } from '../fixtures/base';
import { insertTestAdmin } from '../helpers/db';
import { apiGet } from '../helpers/csrf';
import { loginAsStaff, putUserRolesViaApi } from '../helpers/rbac';

test.describe.configure({ mode: 'serial' });
test.use({ role: 'receptionist' });

test.describe('AUTH-002 Revoked permission stops active session', () => {
  test.setTimeout(90_000);

  test('clearing staff roles destroys session; next API is unauthorized', async ({
    staffUser,
    request,
  }) => {
    await insertTestAdmin();
    const session = await loginAsStaff(request, staffUser);

    const before = await apiGet(request, '/api/admin/reservations/ops-dashboard', session);
    expect(before.ok(), await before.text()).toBeTruthy();

    const cleared = await putUserRolesViaApi(request, staffUser.userId, []);
    expect(cleared.ok, JSON.stringify(cleared.body)).toBeTruthy();

    const after = await apiGet(request, '/api/admin/reservations/ops-dashboard', session);
    expect([401, 403]).toContain(after.status());
  });
});
