import { describe, expect, it } from 'vitest';
import { isStaffUser } from './permissions';

describe('permissions helpers', () => {
  it('detects staff via roles', () => {
    expect(
      isStaffUser({
        roles: ['driver'],
        permissions: ['can_view_reservations_ops'],
      })
    ).toBe(true);
  });

  it('denies stale legacy admin/staff without RBAC roles', () => {
    expect(isStaffUser({ role: 'admin', roles: [], permissions: [] } as never)).toBe(false);
    expect(isStaffUser({ role: 'staff', roles: [], permissions: [] } as never)).toBe(false);
  });

  it('denies plain customers', () => {
    expect(isStaffUser({ roles: [], permissions: [] })).toBe(false);
  });
});
