import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createContact } from '../../api/contacts';
import { toast } from '../../components/ui/toastStore';
import { renderWithRouter } from '../../test/test-utils';
import { ContactPage } from './StaticPages';

vi.mock('../../api/contacts', () => ({
  createContact: vi.fn(),
}));

vi.mock('../../components/ui/toastStore', () => ({
  toast: vi.fn(),
}));

describe('ContactPage form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders contact form fields', () => {
    renderWithRouter(<ContactPage />);

    expect(screen.getByRole('heading', { name: 'Contact Us' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
  });

  it('shows validation errors and does not submit when fields are empty', async () => {
    renderWithRouter(<ContactPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Please enter your name')).toBeInTheDocument();
    expect(screen.getByText('Please enter your email')).toBeInTheDocument();
    expect(screen.getByText('Please enter a subject')).toBeInTheDocument();
    expect(screen.getByText('Please enter a message')).toBeInTheDocument();
    expect(createContact).not.toHaveBeenCalled();
  });

  it('submits valid form, shows toast, and clears fields', async () => {
    vi.mocked(createContact).mockResolvedValue({
      contact: {
        id: '9',
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Booking question',
        message: 'I would like availability details.',
        status: 'new',
        createdAt: '2026-07-31T10:00:00.000Z',
        updatedAt: '2026-07-31T10:00:00.000Z',
      },
    });

    renderWithRouter(<ContactPage />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Booking question' } });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I would like availability details.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(createContact).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Booking question',
        message: 'I would like availability details.',
      });
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        'Message sent. We will get back to you soon.',
        'success',
      );
    });

    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Subject')).toHaveValue('');
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });
});
