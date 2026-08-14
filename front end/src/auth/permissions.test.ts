import { describe, expect, it } from 'vitest';
import { hasAnyPermission, hasPermission, isStaffUser } from './permissions';

describe('permissions helpers', () => {
  it('detects staff via roles', () => {
    expect(
      isStaffUser({
        role: 'staff',
        roles: ['driver'],
        permissions: ['can_view_reservations_ops'],
      })
    ).toBe(true);
  });

  it('detects legacy admin without roles array', () => {
    expect(isStaffUser({ role: 'admin', roles: [], permissions: [] })).toBe(true);
  });

  it('denies plain customers', () => {
    expect(isStaffUser({ role: 'user', roles: [], permissions: [] })).toBe(false);
  });

  it('owner bypasses permission checks', () => {
    expect(hasPermission({ roles: ['owner'], permissions: [] }, 'can_manage_users')).toBe(true);
  });

  it('checks concrete permissions', () => {
    const user = { roles: ['receptionist'], permissions: ['can_view_orders'] };
    expect(hasPermission(user, 'can_view_orders')).toBe(true);
    expect(hasPermission(user, 'can_manage_users')).toBe(false);
    expect(hasAnyPermission(user, ['can_manage_users', 'can_view_orders'])).toBe(true);
  });
});
