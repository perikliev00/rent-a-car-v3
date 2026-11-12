// Import named exports from '@testing-library/react'.
import { render, screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Contribute this line to the enclosing declaration or statement.
import type { PriceBreakdown } from '../../types/api';
// Import named exports from './PriceBreakdownView'.
import { PriceBreakdownView } from './PriceBreakdownView';

// Declare a test suite grouping related cases.
describe('PriceBreakdownView', () => {
  // Define a single test case and its expectations.
  it('renders price lines, discount, total and deposit', () => {
    // Continue the surrounding logic with this statement.
    const breakdown: PriceBreakdown = {
      // Provide the lines field value.
      lines: [
        {
          // Provide the code field value.
          code: 'base',
          // Provide the label field value.
          label: 'Base rental',
          // Provide the amount field value.
          amount: 200,
          // Provide the type field value.
          type: 'base',
        },
        {
          // Provide the code field value.
          code: 'discount',
          // Provide the label field value.
          label: 'Discount',
          // Provide the amount field value.
          amount: -20,
          // Provide the type field value.
          type: 'discount',
        },
      ],
      // Provide the total price field value.
      totalPrice: 180,
      // Provide the deposit field value.
      deposit: 100,
      // Provide the currency field value.
      currency: 'EUR',
    };

    render(<PriceBreakdownView breakdown={breakdown} />);

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Base rental')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Discount')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Total')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Deposit (at pickup)')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('does not render deposit when deposit is zero', () => {
    // Continue the surrounding logic with this statement.
    const breakdown: PriceBreakdown = {
      // Provide the lines field value.
      lines: [],
      // Provide the total price field value.
      totalPrice: 180,
      // Provide the deposit field value.
      deposit: 0,
      // Provide the currency field value.
      currency: 'EUR',
    };

    render(<PriceBreakdownView breakdown={breakdown} />);

    // Assert that the value matches the intended expectation.
    expect(screen.queryByText('Deposit (at pickup)')).not.toBeInTheDocument();
  });
});
