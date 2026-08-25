import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();
const mockApiFormData = vi.fn();

vi.mock('./client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  apiFormData: (...args: unknown[]) => mockApiFormData(...args),
  API_BASE: 'http://localhost:3000',
}));

import {
  claimReservation,
  deleteCustomerDocument,
  getAccountDashboard,
  getAccountReservation,
  listAccountReservations,
  listCustomerDocuments,
  requestCancellation,
  requestClaimLink,
  updateTravelDetails,
  uploadCustomerDocument,
} from './account';

describe('account API', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApiFormData.mockReset();
  });

  it('getAccountDashboard fetches dashboard', async () => {
    mockApi.mockResolvedValue({ counts: { total: 0, active: 0, completed: 0 } });
    await getAccountDashboard();
    expect(mockApi).toHaveBeenCalledWith('/api/account/dashboard');
  });

  it('listAccountReservations fetches reservations', async () => {
    mockApi.mockResolvedValue({ reservations: [] });
    await listAccountReservations();
    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations');
  });

  it('getAccountReservation fetches by id', async () => {
    mockApi.mockResolvedValue({ reservation: { id: '10' } });
    await getAccountReservation('10');
    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations/10');
  });

  it('updateTravelDetails patches travel body', async () => {
    mockApi.mockResolvedValue({ reservation: { id: '10' } });
    await updateTravelDetails('10', { flightNumber: 'FR1' });

    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations/10/travel', {
      method: 'PATCH',
      body: JSON.stringify({ flightNumber: 'FR1' }),
    });
  });

  it('requestCancellation posts reason', async () => {
    mockApi.mockResolvedValue({ immediate: false });
    await requestCancellation('10', 'Plans changed');

    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations/10/cancel-request', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Plans changed' }),
    });
  });

  it('listCustomerDocuments fetches documents', async () => {
    mockApi.mockResolvedValue({ documents: [] });
    await listCustomerDocuments();
    expect(mockApi).toHaveBeenCalledWith('/api/account/documents');
  });

  it('uploadCustomerDocument posts form data', async () => {
    mockApiFormData.mockResolvedValue({ document: { id: 1 } });
    const formData = new FormData();
    await uploadCustomerDocument(formData);

    expect(mockApiFormData).toHaveBeenCalledWith('/api/account/documents', formData);
  });

  it('deleteCustomerDocument deletes by id', async () => {
    mockApi.mockResolvedValue({ document: { id: 5 } });
    await deleteCustomerDocument(5);

    expect(mockApi).toHaveBeenCalledWith('/api/account/documents/5', { method: 'DELETE' });
  });

  it('claimReservation posts the token to the reservation claim endpoint', async () => {
    mockApi.mockResolvedValue({ reservationId: '10', claimed: true, alreadyOwned: false });
    const token = 'b'.repeat(64);

    await claimReservation('10', token);

    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations/10/claim', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  });

  it('requestClaimLink posts reservation id and booking email', async () => {
    mockApi.mockResolvedValue({ requested: true });

    await requestClaimLink('10', 'guest@example.com');

    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations/claim-request', {
      method: 'POST',
      body: JSON.stringify({ reservationId: 10, bookingEmail: 'guest@example.com' }),
    });
  });
});
