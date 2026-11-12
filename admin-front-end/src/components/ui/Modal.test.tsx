// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '@testing-library/react'.
import { fireEvent, render, screen } from '@testing-library/react';
// Import named exports from './Modal'.
import { Modal } from './Modal';

// Declare a test suite grouping related cases.
describe('Modal', () => {
  // Define a single test case and its expectations.
  it('renders nothing when closed', () => {
    // Destructure object properties into local variables.
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} title="Hidden">
        Body
      </Modal>
    );
    // Assert that the value matches the intended expectation.
    expect(container).toBeEmptyDOMElement();
  });

  // Define a single test case and its expectations.
  it('renders dialog when open and closes via button', () => {
    // Create the on close constant.
    const onClose = vi.fn();

    // Call render to perform this step.
    render(
      <Modal open onClose={onClose} title="Confirm">
        Are you sure?
      </Modal>
    );

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();

    // Create the close buttons constant.
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    // Call fireEvent.click to perform this step.
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    // Assert that the value matches the intended expectation.
    expect(onClose).toHaveBeenCalled();
  });
});
