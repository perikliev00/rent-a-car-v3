// Import named exports from '@testing-library/react'.
import { renderHook } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from './useAuth'.
import { useAuth } from './useAuth';

// Declare a test suite grouping related cases.
describe('useAuth', () => {
  // Define a single test case and its expectations.
  it('throws when used outside AuthProvider', () => {
    // Assert that the value matches the intended expectation.
    expect(() => renderHook(() => useAuth())).toThrow(
      // Supply the literal value used by the enclosing expression.
      'useAuth must be used within AuthProvider',
    );
  });
});
