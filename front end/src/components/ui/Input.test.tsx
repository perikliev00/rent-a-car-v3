import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '../../test/test-utils';
import { Input } from './Input';

describe('Input', () => {
  it('renders label and input', () => {
    renderWithRouter(<Input label="Email" value="test@example.com" readOnly />);
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com');
  });

  it('renders error message', () => {
    renderWithRouter(<Input label="Email" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
