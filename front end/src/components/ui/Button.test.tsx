// Import named exports from '@testing-library/react'.
import { screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './Button'.
import { Button } from './Button';

// Declare a test suite grouping related cases.
describe('Button', () => {
  // Define a single test case and its expectations.
  it('renders children', () => {
    renderWithRouter(<Button>Click me</Button>);
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('shows loading state', () => {
    renderWithRouter(<Button loading>Save</Button>);
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
