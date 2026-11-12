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
  changeCarFleetStatus,
  // Contribute this line to the enclosing declaration or statement.
  checkCarAvailability,
  // Contribute this line to the enclosing declaration or statement.
  createAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  getAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  getAdminCars,
  // Contribute this line to the enclosing declaration or statement.
  getCarServiceRecords,
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  updateAdminCar,
// Contribute this line to the enclosing declaration or statement.
} from './cars';

// Declare a test suite grouping related cases.
describe('admin cars API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
    // Call mockApiFormData.mockReset to perform this step.
    mockApiFormData.mockReset();
  });

  // Define a single test case and its expectations.
  it('getAdminCars fetches /api/admin/cars', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ cars: [] });
    // Wait until the asynchronous operation resolves.
    await getAdminCars();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars');
  });

  // Define a single test case and its expectations.
  it('getAdminCar fetches car by id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ car: { id: '5' } });
    // Wait until the asynchronous operation resolves.
    await getAdminCar('5');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/5');
  });

  // Define a single test case and its expectations.
  it('createAdminCar uses apiFormData with POST', async () => {
    // Create the form data constant.
    const formData = new FormData();
    // Call formData.append to perform this step.
    formData.append('name', 'Tesla');
    // Call mockApiFormData.mockResolvedValue to perform this step.
    mockApiFormData.mockResolvedValue({ car: { id: '9' } });

    // Wait until the asynchronous operation resolves.
    await createAdminCar(formData);

    // Assert that the value matches the intended expectation.
    expect(mockApiFormData).toHaveBeenCalledWith('/api/admin/cars', formData);
  });

  // Define a single test case and its expectations.
  it('updateAdminCar uses apiFormData with PUT', async () => {
    // Create the form data constant.
    const formData = new FormData();
    // Call mockApiFormData.mockResolvedValue to perform this step.
    mockApiFormData.mockResolvedValue({ car: { id: '9' } });

    // Wait until the asynchronous operation resolves.
    await updateAdminCar('9', formData);

    // Assert that the value matches the intended expectation.
    expect(mockApiFormData).toHaveBeenCalledWith('/api/admin/cars/9', formData, 'PUT');
  });

  // Define a single test case and its expectations.
  it('deleteAdminCar sends DELETE request', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ deleted: true, id: 9 });
    // Wait until the asynchronous operation resolves.
    await deleteAdminCar('9');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/9', { method: 'DELETE' });
  });

  // Define a single test case and its expectations.
  it('changeCarFleetStatus posts status', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ car: { id: '9' }, newStatus: 'damaged' });
    // Wait until the asynchronous operation resolves.
    await changeCarFleetStatus('9', { status: 'damaged', reason: 'scratch' });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/9/status', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({ status: 'damaged', reason: 'scratch' }),
    });
  });

  // Define a single test case and its expectations.
  it('getCarServiceRecords fetches service records', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ records: [] });
    // Wait until the asynchronous operation resolves.
    await getCarServiceRecords('9');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/9/service-records');
  });

  // Define a single test case and its expectations.
  it('getFleetAlerts fetches fleet alerts', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ summary: { total: 0 }, alerts: [] });
    // Wait until the asynchronous operation resolves.
    await getFleetAlerts();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/cars/fleet-alerts');
  });

  // Define a single test case and its expectations.
  it('checkCarAvailability builds availability query params', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ available: true, conflicts: [] });
    // Wait until the asynchronous operation resolves.
    await checkCarAvailability('4', {
      // Provide the pickup date field value.
      pickupDate: '2026-07-01',
      // Provide the return date field value.
      returnDate: '2026-07-05',
      // Provide the pickup time field value.
      pickupTime: '09:00',
    });

    // Create the url constant.
    const url = mockApi.mock.calls[0][0] as string;
    // Assert that the value matches the intended expectation.
    expect(url).toContain('/api/admin/cars/4/availability?');
    // Assert that the value matches the intended expectation.
    expect(url).toContain('pickupDate=2026-07-01');
    // Assert that the value matches the intended expectation.
    expect(url).toContain('pickupTime=09%3A00');
  });
});
