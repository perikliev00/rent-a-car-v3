// Import named exports from '@testing-library/react'.
import { screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './Input'.
import { Input } from './Input';

// Declare a test suite grouping related cases.
describe('Input', () => {
  // Define a single test case and its expectations.
  it('renders label and input', () => {
    renderWithRouter(<Input label="Email" value="test@example.com" readOnly />);
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com');
  });

  // Define a single test case and its expectations.
  it('renders error message', () => {
    renderWithRouter(<Input label="Email" error="Required" />);
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
