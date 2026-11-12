// Import named exports from '@testing-library/react'.
import { fireEvent, screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/contacts'.
import { createContact } from '../../api/contacts';
// Import named exports from '../../components/ui/toastStore'.
import { toast } from '../../components/ui/toastStore';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './StaticPages'.
import { ContactPage } from './StaticPages';

// Call vi.mock to perform this step.
vi.mock('../../api/contacts', () => ({
  // Provide the create contact field value.
  createContact: vi.fn(),
}));

// Call vi.mock to perform this step.
vi.mock('../../components/ui/toastStore', () => ({
  // Provide the toast field value.
  toast: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('ContactPage form', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.clearAllMocks to perform this step.
    vi.clearAllMocks();
  });

  // Define a single test case and its expectations.
  it('renders contact form fields', () => {
    renderWithRouter(<ContactPage />);

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('heading', { name: 'Contact Us' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Phone (optional)')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('shows validation errors and does not submit when fields are empty', async () => {
    renderWithRouter(<ContactPage />);

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    // Assert that the value matches the intended expectation.
    expect(await screen.findByText('Please enter your name')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Please enter your email')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Please enter a subject')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Please enter a message')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(createContact).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('submits valid form, shows toast, and clears fields', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(createContact).mockResolvedValue({
      // Provide the contact field value.
      contact: {
        // Provide the id field value.
        id: '9',
        // Provide the name field value.
        name: 'Jane Doe',
        // Provide the email field value.
        email: 'jane@example.com',
        // Provide the subject field value.
        subject: 'Booking question',
        // Provide the message field value.
        message: 'I would like availability details.',
        // Provide the status field value.
        status: 'new',
        // Provide the created at field value.
        createdAt: '2026-07-31T10:00:00.000Z',
        // Provide the updated at field value.
        updatedAt: '2026-07-31T10:00:00.000Z',
      },
    });

    renderWithRouter(<ContactPage />);

    // Call fireEvent.change to perform this step.
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } });
    // Call fireEvent.change to perform this step.
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    // Call fireEvent.change to perform this step.
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Booking question' } });
    // Call fireEvent.change to perform this step.
    fireEvent.change(screen.getByLabelText('Message'), {
      // Provide the target field value.
      target: { value: 'I would like availability details.' },
    });
    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(createContact).toHaveBeenCalledWith({
        // Provide the name field value.
        name: 'Jane Doe',
        // Provide the email field value.
        email: 'jane@example.com',
        // Provide the subject field value.
        subject: 'Booking question',
        // Provide the message field value.
        message: 'I would like availability details.',
      });
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(toast).toHaveBeenCalledWith(
        // Supply the literal value used by the enclosing expression.
        'Message sent. We will get back to you soon.',
        // Supply the literal value used by the enclosing expression.
        'success',
      );
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Name')).toHaveValue('');
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Email')).toHaveValue('');
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Subject')).toHaveValue('');
    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });
});
