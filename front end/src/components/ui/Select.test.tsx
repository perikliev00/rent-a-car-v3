// Import named exports from '@testing-library/react'.
import { screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './Select'.
import { Select } from './Select';

// Declare a test suite grouping related cases.
describe('Select', () => {
  // Define a single test case and its expectations.
  it('renders options', () => {
    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <Select
        label="Location"
        value="office"
        options={[
          { value: 'office', label: 'Office' },
          { value: 'airport', label: 'Airport' },
        ]}
        onChange={() => {}}
      />,
    );

    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('option', { name: 'Airport' })).toBeInTheDocument();
  });
});
