import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageLoader, Skeleton, Spinner } from './Loading';

describe('Loading', () => {
  it('renders Spinner', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders Skeleton', () => {
    const { container } = render(<Skeleton className="h-8" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders PageLoader', () => {
    const { container } = render(<PageLoader />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
