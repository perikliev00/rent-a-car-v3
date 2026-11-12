// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '@testing-library/react'.
import { renderHook } from '@testing-library/react';
// Contribute this line to the enclosing declaration or statement.
import type { ReactNode } from 'react';
// Import named exports from './auth-context'.
import { AuthContext } from './auth-context';
// Import named exports from './usePermission'.
import { useAnyPermission, useIsStaff, usePermission } from './usePermission';

// Define the wrapper function.
function wrapper(user: {
  // Provide the id field value.
  id: string;
  // Provide the email field value.
  email: string;
  // Provide the role field value.
  role: 'user' | 'admin' | 'staff';
  // Contribute this line to the enclosing declaration or statement.
  permissions?: string[];
  // Contribute this line to the enclosing declaration or statement.
  roles?: string[];
// Continue the surrounding logic with this statement.
} | null) {
  // Return the resulting value to the caller.
  return function AuthWrapper({ children }: { children: ReactNode }) {
    // Return control to the caller with the following value.
    return (
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          login: vi.fn(),
          signup: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };
}

// Declare a test suite grouping related cases.
describe('usePermission hooks', () => {
  // Define a single test case and its expectations.
  it('usePermission checks single key', () => {
    // Destructure object properties into local variables.
    const { result } = renderHook(() => usePermission('can_view_orders'), {
      // Provide the wrapper field value.
      wrapper: wrapper({
        // Provide the id field value.
        id: '1',
        // Provide the email field value.
        email: 'a@b.com',
        // Provide the role field value.
        role: 'admin',
        // Provide the permissions field value.
        permissions: ['can_view_orders'],
      }),
    });
    // Assert that the value matches the intended expectation.
    expect(result.current).toBe(true);
  });

  // Define a single test case and its expectations.
  it('useAnyPermission is true when any key matches', () => {
    // Destructure object properties into local variables.
    const { result } = renderHook(
      // Continue the surrounding logic with this statement.
      () => useAnyPermission(['can_manage_cars', 'can_view_orders']),
      {
        // Provide the wrapper field value.
        wrapper: wrapper({
          // Provide the id field value.
          id: '1',
          // Provide the email field value.
          email: 'a@b.com',
          // Provide the role field value.
          role: 'staff',
          // Provide the permissions field value.
          permissions: ['can_view_orders'],
        }),
      }
    );
    // Assert that the value matches the intended expectation.
    expect(result.current).toBe(true);
  });

  // Define a single test case and its expectations.
  it('useIsStaff is false for customers', () => {
    // Destructure object properties into local variables.
    const { result } = renderHook(() => useIsStaff(), {
      // Provide the wrapper field value.
      wrapper: wrapper({ id: '2', email: 'c@d.com', role: 'user' }),
    });
    // Assert that the value matches the intended expectation.
    expect(result.current).toBe(false);
  });
});
