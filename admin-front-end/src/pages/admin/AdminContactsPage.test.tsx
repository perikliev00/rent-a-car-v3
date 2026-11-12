// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/contacts'.
import { getContacts } from '../../api/admin/contacts';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminContactsPage'.
import { AdminContactsPage } from './AdminContactsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/contacts', () => ({
  // Provide the get contacts field value.
  getContacts: vi.fn(),
  // Provide the update contact status field value.
  updateContactStatus: vi.fn(),
  // Provide the delete contact field value.
  deleteContact: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('AdminContactsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getContacts).mockResolvedValue({ contacts: [] });
  });

  // Define a single test case and its expectations.
  it('renders contacts inbox', async () => {
    renderWithRouter(<AdminContactsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Contacts' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Customer messages inbox')).toBeInTheDocument();
  });
});
