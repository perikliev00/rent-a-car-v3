// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('../client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  createAdminOrder,
  // Contribute this line to the enclosing declaration or statement.
  deleteAdminOrder,
  // Contribute this line to the enclosing declaration or statement.
  getAdminOrders,
  // Contribute this line to the enclosing declaration or statement.
  getDashboard,
  // Contribute this line to the enclosing declaration or statement.
  restoreAdminOrder,
// Contribute this line to the enclosing declaration or statement.
} from './orders';

// Declare a test suite grouping related cases.
describe('admin orders API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('getDashboard fetches /api/admin/dashboard', async () => {
    // Create the data constant.
    const data = { orders: [], stats: { totalOrders: 0, totalRevenue: '0', pendingOrders: 0 } };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue(data);

    // Create the result constant.
    const result = await getDashboard();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/dashboard');
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(data);
  });

  // Define a single test case and its expectations.
  it('getAdminOrders appends filter query params', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ orders: [], filters: {} });
    // Wait until the asynchronous operation resolves.
    await getAdminOrders({
      // Provide the status field value.
      status: 'pending',
      // Provide the start date field value.
      startDate: '2026-07-01',
      // Provide the search field value.
      search: 'john',
    });

    // Create the url constant.
    const url = mockApi.mock.calls[0][0] as string;
    // Assert that the value matches the intended expectation.
    expect(url).toContain('status=pending');
    // Assert that the value matches the intended expectation.
    expect(url).toContain('startDate=2026-07-01');
    // Assert that the value matches the intended expectation.
    expect(url).toContain('search=john');
  });

  // Define a single test case and its expectations.
  it('createAdminOrder posts body to /api/admin/orders', async () => {
    // Create the body constant.
    const body = {
      // Provide the car id field value.
      carId: '1',
      // Provide the pickup date field value.
      pickupDate: '2026-07-10',
      // Provide the return date field value.
      returnDate: '2026-07-12',
      // Provide the pickup location field value.
      pickupLocation: 'airport',
      // Provide the return location field value.
      returnLocation: 'airport',
      // Provide the full name field value.
      fullName: 'Admin User',
      // Provide the phone number field value.
      phoneNumber: '+999',
      // Provide the email field value.
      email: 'admin@example.com',
      // Provide the address field value.
      address: 'HQ',
    };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ created: true });

    // Wait until the asynchronous operation resolves.
    await createAdminOrder(body);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/orders', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify(body),
    });
  });

  // Define a single test case and its expectations.
  it('deleteAdminOrder sends DELETE to order id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ deleted: true, id: 12 });
    // Wait until the asynchronous operation resolves.
    await deleteAdminOrder('12');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/orders/12', { method: 'DELETE' });
  });

  // Define a single test case and its expectations.
  it('restoreAdminOrder posts to restore endpoint', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ restored: true, id: 12 });
    // Wait until the asynchronous operation resolves.
    await restoreAdminOrder('12');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/orders/12/restore', { method: 'POST' });
  });
});
