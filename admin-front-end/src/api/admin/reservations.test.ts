// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();
// Create the mock api form data constant.
const mockApiFormData = vi.fn();

// Call vi.mock to perform this step.
vi.mock('../client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
  // Provide the api form data field value.
  apiFormData: (...args: unknown[]) => mockApiFormData(...args),
}));

// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  changeReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  getReservationDetail,
  // Contribute this line to the enclosing declaration or statement.
  getReservationOpsDashboard,
  // Contribute this line to the enclosing declaration or statement.
  listCancellationRequests,
  // Contribute this line to the enclosing declaration or statement.
  reviewCancellationRequest,
  // Contribute this line to the enclosing declaration or statement.
  submitPickupChecklist,
// Contribute this line to the enclosing declaration or statement.
} from './reservations';

// Declare a test suite grouping related cases.
describe('admin reservations API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
    // Call mockApiFormData.mockReset to perform this step.
    mockApiFormData.mockReset();
  });

  // Define a single test case and its expectations.
  it('getReservationOpsDashboard includes limit query', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ today: '2026-08-04', limit: 10, widgets: {} });
    // Wait until the asynchronous operation resolves.
    await getReservationOpsDashboard(10);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/ops-dashboard?limit=10');
  });

  // Define a single test case and its expectations.
  it('getReservationDetail fetches by id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ reservation: { id: '5' }, history: [] });
    // Wait until the asynchronous operation resolves.
    await getReservationDetail('5');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/5');
  });

  // Define a single test case and its expectations.
  it('changeReservationStatus posts status body', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ changed: true, oldStatus: 'confirmed', newStatus: 'car_prepared' });
    // Wait until the asynchronous operation resolves.
    await changeReservationStatus('5', { status: 'car_prepared', reason: 'ready' });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/5/status', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({ status: 'car_prepared', reason: 'ready' }),
    });
  });

  // Define a single test case and its expectations.
  it('listCancellationRequests hits list endpoint', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ requests: [] });
    // Wait until the asynchronous operation resolves.
    await listCancellationRequests();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/cancellation-requests');
  });

  // Define a single test case and its expectations.
  it('reviewCancellationRequest posts approve flag', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ request: { id: 1, status: 'approved' } });
    // Wait until the asynchronous operation resolves.
    await reviewCancellationRequest(1, { approve: true, adminNote: 'ok' });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/reservations/cancellation-requests/1/review', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({ approve: true, adminNote: 'ok' }),
    });
  });

  // Define a single test case and its expectations.
  it('submitPickupChecklist sends multipart form data', async () => {
    // Call mockApiFormData.mockResolvedValue to perform this step.
    mockApiFormData.mockResolvedValue({ checklist: { id: 1 } });
    // Wait until the asynchronous operation resolves.
    await submitPickupChecklist('5', { fuelLevel: 'full', mileage: 1000 });

    // Assert that the value matches the intended expectation.
    expect(mockApiFormData).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      '/api/admin/reservations/5/pickup-checklist',
      // Call expect.any to perform this step.
      expect.any(FormData)
    );
    // Create the form data constant.
    const formData = mockApiFormData.mock.calls[0][1] as FormData;
    // Assert that the value matches the intended expectation.
    expect(formData.get('fuelLevel')).toBe('full');
    // Assert that the value matches the intended expectation.
    expect(formData.get('mileage')).toBe('1000');
  });
});
