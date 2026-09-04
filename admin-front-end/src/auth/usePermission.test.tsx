import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthContext } from './auth-context';
import { useAnyPermission, useIsStaff, usePermission } from './usePermission';

function wrapper(user: {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'staff';
  permissions?: string[];
  roles?: string[];
} | null) {
  return function AuthWrapper({ children }: { children: ReactNode }) {
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

describe('usePermission hooks', () => {
  it('usePermission checks single key', () => {
    const { result } = renderHook(() => usePermission('can_view_orders'), {
      wrapper: wrapper({
        id: '1',
        email: 'a@b.com',
        role: 'admin',
        permissions: ['can_view_orders'],
      }),
    });
    expect(result.current).toBe(true);
  });

  it('useAnyPermission is true when any key matches', () => {
    const { result } = renderHook(
      () => useAnyPermission(['can_manage_cars', 'can_view_orders']),
      {
        wrapper: wrapper({
          id: '1',
          email: 'a@b.com',
          role: 'staff',
          permissions: ['can_view_orders'],
        }),
      }
    );
    expect(result.current).toBe(true);
  });

  it('useIsStaff is false for customers', () => {
    const { result } = renderHook(() => useIsStaff(), {
      wrapper: wrapper({ id: '2', email: 'c@d.com', role: 'user' }),
    });
    expect(result.current).toBe(false);
  });
});
