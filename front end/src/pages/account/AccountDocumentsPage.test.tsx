// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '@testing-library/react'.
import { render, screen } from '@testing-library/react';
// Import named exports from 'react-router-dom'.
import { MemoryRouter, Route, Routes } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import named exports from '../../auth/auth-context'.
import { AuthContext } from '../../auth/auth-context';
// Import named exports from './AccountDocumentsPage'.
import { AccountDocumentsPage } from './AccountDocumentsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/account', () => ({
  // Provide the list customer documents field value.
  listCustomerDocuments: vi.fn().mockResolvedValue({
    // Provide the documents field value.
    documents: [
      {
        // Provide the id field value.
        id: 1,
        // Provide the doc type field value.
        docType: 'driver_license',
        // Provide the original filename field value.
        originalFilename: 'license.pdf',
        // Provide the mime type field value.
        mimeType: 'application/pdf',
        // Provide the size bytes field value.
        sizeBytes: 1024,
        // Provide the reservation id field value.
        reservationId: null,
        // Provide the created at field value.
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
  }),
  // Provide the upload customer document field value.
  uploadCustomerDocument: vi.fn(),
  // Provide the delete customer document field value.
  deleteCustomerDocument: vi.fn(),
  // Provide the download customer document field value.
  downloadCustomerDocument: vi.fn(),
}));

// Define the renderPage function.
function renderPage() {
  // Create the query client constant.
  const queryClient = new QueryClient({
    // Provide the default options field value.
    defaultOptions: { queries: { retry: false } },
  });

  // Return the resulting value to the caller.
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: { id: '1', email: 'demo@luxride.local', role: 'user' },
          isLoading: false,
          login: vi.fn(),
          signup: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={['/account/documents']}>
          <Routes>
            <Route path="/account/documents" element={<AccountDocumentsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

// Declare a test suite grouping related cases.
describe('AccountDocumentsPage', () => {
  // Define a single test case and its expectations.
  it('renders documents list', async () => {
    // Call renderPage to perform this step.
    renderPage();

    // Assert that the value matches the intended expectation.
    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('license.pdf')).toBeInTheDocument();
  });
});
