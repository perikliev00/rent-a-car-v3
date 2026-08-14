import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../auth/auth-context';
import { AccountDocumentsPage } from './AccountDocumentsPage';

vi.mock('../../api/account', () => ({
  listCustomerDocuments: vi.fn().mockResolvedValue({
    documents: [
      {
        id: 1,
        docType: 'driver_license',
        originalFilename: 'license.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        reservationId: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
  }),
  uploadCustomerDocument: vi.fn(),
  deleteCustomerDocument: vi.fn(),
  downloadCustomerDocument: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

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

describe('AccountDocumentsPage', () => {
  it('renders documents list', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByText('license.pdf')).toBeInTheDocument();
  });
});
