// Import named exports from '@testing-library/react'.
import { screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './Textarea'.
import { Textarea } from './Textarea';

// Declare a test suite grouping related cases.
describe('Textarea', () => {
  // Define a single test case and its expectations.
  it('renders label and textarea', () => {
    renderWithRouter(<Textarea label="Message" value="Hello there" readOnly />);
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Message')).toHaveValue('Hello there');
  });

  // Define a single test case and its expectations.
  it('renders error message', () => {
    renderWithRouter(<Textarea label="Message" error="Required" />);
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
