// Import named exports from '@testing-library/react'.
import { screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './Card'.
import { Card, CardBody, CardHeader } from './Card';

// Declare a test suite grouping related cases.
describe('Card', () => {
  // Define a single test case and its expectations.
  it('renders card sections', () => {
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <Card>
        <CardHeader>Header</CardHeader>
        <CardBody>Body content</CardBody>
      </Card>,
    );

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Header')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});
