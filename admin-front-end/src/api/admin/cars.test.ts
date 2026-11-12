import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();
const mockApiFormData = vi.fn();

vi.mock('../client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  apiFormData: (...args: unknown[]) => mockApiFormData(...args),
}));

import {
  changeCarFleetStatus,
  checkCarAvailability,
  createAdminCar,
  deleteAdminCar,
  getAdminCar,
  getAdminCars,
  getCarServiceRecords,
  getFleetAlerts,
  updateAdminCar,
} from './cars';

describe('admin cars API', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApiFormData.mockReset();
  });

  it('getAdminCars fetches /api/admin/cars', async () => {
    mockApi.mockResolvedValue({ cars: [] });
    await getAdminCars();

    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars');
  });

  it('getAdminCar fetches car by id', async () => {
    mockApi.mockResolvedValue({ car: { id: '5' } });
    await getAdminCar('5');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/5');
  });

  it('createAdminCar uses apiFormData with POST', async () => {
    const formData = new FormData();
    formData.append('name', 'Tesla');
    mockApiFormData.mockResolvedValue({ car: { id: '9' } });

    await createAdminCar(formData);

    expect(mockApiFormData).toHaveBeenCalledWith('/api/admin/cars', formData);
  });

  it('updateAdminCar uses apiFormData with PUT', async () => {
    const formData = new FormData();
    mockApiFormData.mockResolvedValue({ car: { id: '9' } });

    await updateAdminCar('9', formData);

    expect(mockApiFormData).toHaveBeenCalledWith('/api/admin/cars/9', formData, 'PUT');
  });

  it('deleteAdminCar sends DELETE request', async () => {
    mockApi.mockResolvedValue({ deleted: true, id: 9 });
    await deleteAdminCar('9');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/9', { method: 'DELETE' });
  });

  it('changeCarFleetStatus posts status', async () => {
    mockApi.mockResolvedValue({ car: { id: '9' }, newStatus: 'damaged' });
    await changeCarFleetStatus('9', { status: 'damaged', reason: 'scratch' });

    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/9/status', {
      method: 'POST',
      body: JSON.stringify({ status: 'damaged', reason: 'scratch' }),
    });
  });

  it('getCarServiceRecords fetches service records', async () => {
    mockApi.mockResolvedValue({ records: [] });
    await getCarServiceRecords('9');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/9/service-records');
  });

  it('getFleetAlerts fetches fleet alerts', async () => {
    mockApi.mockResolvedValue({ summary: { total: 0 }, alerts: [] });
    await getFleetAlerts();

    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/fleet-alerts');
  });

  it('checkCarAvailability builds availability query params', async () => {
    mockApi.mockResolvedValue({ available: true, conflicts: [] });
    await checkCarAvailability('4', {
      pickupDate: '2026-07-01',
      returnDate: '2026-07-05',
      pickupTime: '09:00',
    });

    const url = mockApi.mock.calls[0][0] as string;
    expect(url).toContain('/api/admin/cars/4/availability?');
    expect(url).toContain('pickupDate=2026-07-01');
    expect(url).toContain('pickupTime=09%3A00');
  });
});
