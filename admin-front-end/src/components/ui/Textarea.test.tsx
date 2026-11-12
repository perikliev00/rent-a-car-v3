import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '../../test/test-utils';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders label and textarea', () => {
    renderWithRouter(<Textarea label="Message" value="Hello there" readOnly />);
    expect(screen.getByLabelText('Message')).toHaveValue('Hello there');
  });

  it('renders error message', () => {
    renderWithRouter(<Textarea label="Message" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
