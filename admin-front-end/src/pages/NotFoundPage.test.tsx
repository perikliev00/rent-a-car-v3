// Import named exports from '@testing-library/react'.
import { screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from '../test/test-utils'.
import { renderWithRouter } from '../test/test-utils';
// Import named exports from './NotFoundPage'.
import { NotFoundPage } from './NotFoundPage';

// Declare a test suite grouping related cases.
describe('NotFoundPage', () => {
  // Define a single test case and its expectations.
  it('renders 404 message', () => {
    renderWithRouter(<NotFoundPage />);

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('404')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toBeInTheDocument();
  });
});
