import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();
const mockApiFormData = vi.fn();

vi.mock('../client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  apiFormData: (...args: unknown[]) => mockApiFormData(...args),
}));

import {
  changeReservationStatus,
  getReservationDetail,
  getReservationOpsDashboard,
  listCancellationRequests,
  reviewCancellationRequest,
  submitPickupChecklist,
} from './reservations';

describe('admin reservations API', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApiFormData.mockReset();
  });

  it('getReservationOpsDashboard includes limit query', async () => {
    mockApi.mockResolvedValue({ today: '2026-08-04', limit: 10, widgets: {} });
    await getReservationOpsDashboard(10);

    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/ops-dashboard?limit=10');
  });

  it('getReservationDetail fetches by id', async () => {
    mockApi.mockResolvedValue({ reservation: { id: '5' }, history: [] });
    await getReservationDetail('5');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/5');
  });

  it('changeReservationStatus posts status body', async () => {
    mockApi.mockResolvedValue({ changed: true, oldStatus: 'confirmed', newStatus: 'car_prepared' });
    await changeReservationStatus('5', { status: 'car_prepared', reason: 'ready' });

    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/5/status', {
      method: 'POST',
      body: JSON.stringify({ status: 'car_prepared', reason: 'ready' }),
    });
  });

  it('listCancellationRequests hits list endpoint', async () => {
    mockApi.mockResolvedValue({ requests: [] });
    await listCancellationRequests();

    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/cancellation-requests');
  });

  it('reviewCancellationRequest posts approve flag', async () => {
    mockApi.mockResolvedValue({ request: { id: 1, status: 'approved' } });
    await reviewCancellationRequest(1, { approve: true, adminNote: 'ok' });

    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/cancellation-requests/1/review', {
      method: 'POST',
      body: JSON.stringify({ approve: true, adminNote: 'ok' }),
    });
  });

  it('submitPickupChecklist sends multipart form data', async () => {
    mockApiFormData.mockResolvedValue({ checklist: { id: 1 } });
    await submitPickupChecklist('5', { fuelLevel: 'full', mileage: 1000 });

    expect(mockApiFormData).toHaveBeenCalledWith(
      '/api/admin/reservations/5/pickup-checklist',
      expect.any(FormData)
    );
    const formData = mockApiFormData.mock.calls[0][1] as FormData;
    expect(formData.get('fuelLevel')).toBe('full');
    expect(formData.get('mileage')).toBe('1000');
  });
});
