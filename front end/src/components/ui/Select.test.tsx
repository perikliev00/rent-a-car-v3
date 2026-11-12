import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '../../test/test-utils';
import { Select } from './Select';

describe('Select', () => {
  it('renders options', () => {
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

    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Airport' })).toBeInTheDocument();
  });
});
