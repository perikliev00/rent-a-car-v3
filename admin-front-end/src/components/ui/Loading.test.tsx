// Import named exports from '@testing-library/react'.
import { render } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from './Loading'.
import { PageLoader, Skeleton, Spinner } from './Loading';

// Declare a test suite grouping related cases.
describe('Loading', () => {
  // Define a single test case and its expectations.
  it('renders Spinner', () => {
    const { container } = render(<Spinner />);
    // Assert that the value matches the intended expectation.
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('renders Skeleton', () => {
    const { container } = render(<Skeleton className="h-8" />);
    // Assert that the value matches the intended expectation.
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('renders PageLoader', () => {
    const { container } = render(<PageLoader />);
    // Assert that the value matches the intended expectation.
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
