import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within AuthProvider',
    );
  });
});
