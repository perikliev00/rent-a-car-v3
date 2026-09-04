import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '../../test/test-utils';
import { Card, CardBody, CardHeader } from './Card';

describe('Card', () => {
  it('renders card sections', () => {
    renderWithRouter(
      <Card>
        <CardHeader>Header</CardHeader>
        <CardBody>Body content</CardBody>
      </Card>,
    );

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});
