// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from './permissions'.
import { hasAnyPermission, hasPermission, isStaffUser } from './permissions';

// Declare a test suite grouping related cases.
describe('permissions helpers', () => {
  // Define a single test case and its expectations.
  it('detects staff via roles', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call isStaffUser to perform this step.
      isStaffUser({
        // Provide the roles field value.
        roles: ['driver'],
        // Provide the permissions field value.
        permissions: ['can_view_reservations_ops'],
      })
    // Continue the surrounding logic with this statement.
    ).toBe(true);
  });

  // Define a single test case and its expectations.
  it('denies stale legacy admin/staff without RBAC roles', () => {
    // Assert that the value matches the intended expectation.
    expect(isStaffUser({ role: 'admin', roles: [], permissions: [] } as never)).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isStaffUser({ role: 'staff', roles: [], permissions: [] } as never)).toBe(false);
  });

  // Define a single test case and its expectations.
  it('denies plain customers', () => {
    // Assert that the value matches the intended expectation.
    expect(isStaffUser({ roles: [], permissions: [] })).toBe(false);
  });

  // Define a single test case and its expectations.
  it('owner bypasses permission checks', () => {
    // Assert that the value matches the intended expectation.
    expect(hasPermission({ roles: ['owner'], permissions: [] }, 'can_manage_users')).toBe(true);
  });

  // Define a single test case and its expectations.
  it('checks concrete permissions', () => {
    // Create the user constant.
    const user = { roles: ['receptionist'], permissions: ['can_view_orders'] };
    // Assert that the value matches the intended expectation.
    expect(hasPermission(user, 'can_view_orders')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(hasPermission(user, 'can_manage_users')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(hasAnyPermission(user, ['can_manage_users', 'can_view_orders'])).toBe(true);
  });
});
