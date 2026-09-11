import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PriceBreakdown } from '../../types/api';
import { PriceBreakdownView } from './PriceBreakdownView';

describe('PriceBreakdownView', () => {
  it('renders price lines, discount, total and deposit', () => {
    const breakdown: PriceBreakdown = {
      lines: [
        {
          code: 'base',
          label: 'Base rental',
          amount: 200,
          type: 'base',
        },
        {
          code: 'discount',
          label: 'Discount',
          amount: -20,
          type: 'discount',
        },
      ],
      totalPrice: 180,
      deposit: 100,
      currency: 'EUR',
    };

    render(<PriceBreakdownView breakdown={breakdown} />);

    expect(screen.getByText('Base rental')).toBeInTheDocument();
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Deposit (at pickup)')).toBeInTheDocument();
  });

  it('does not render deposit when deposit is zero', () => {
    const breakdown: PriceBreakdown = {
      lines: [],
      totalPrice: 180,
      deposit: 0,
      currency: 'EUR',
    };

    render(<PriceBreakdownView breakdown={breakdown} />);

    expect(screen.queryByText('Deposit (at pickup)')).not.toBeInTheDocument();
  });
});
