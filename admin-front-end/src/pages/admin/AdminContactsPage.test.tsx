import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getContacts } from '../../api/admin/contacts';
import { renderWithRouter } from '../../test/test-utils';
import { AdminContactsPage } from './AdminContactsPage';

vi.mock('../../api/admin/contacts', () => ({
  getContacts: vi.fn(),
  updateContactStatus: vi.fn(),
  deleteContact: vi.fn(),
}));

describe('AdminContactsPage', () => {
  beforeEach(() => {
    vi.mocked(getContacts).mockResolvedValue({ contacts: [] });
  });

  it('renders contacts inbox', async () => {
    renderWithRouter(<AdminContactsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Contacts' })).toBeInTheDocument();
    });

    expect(screen.getByText('Customer messages inbox')).toBeInTheDocument();
  });
});
