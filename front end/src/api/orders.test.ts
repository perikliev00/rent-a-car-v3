// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('./client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './orders'.
import { createOrder } from './orders';

// Declare a test suite grouping related cases.
describe('orders API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('createOrder posts order body to /api/orders', async () => {
    // Create the body constant.
    const body = {
      // Provide the car id field value.
      carId: '7',
      // Provide the pickup date field value.
      pickupDate: '2026-07-10',
      // Provide the return date field value.
      returnDate: '2026-07-12',
      // Provide the pickup location field value.
      pickupLocation: 'airport',
      // Provide the return location field value.
      returnLocation: 'airport',
      // Provide the full name field value.
      fullName: 'Jane Doe',
      // Provide the phone number field value.
      phoneNumber: '+1234567890',
      // Provide the email field value.
      email: 'jane@example.com',
      // Provide the address field value.
      address: '123 Main St',
    };
    // Create the order data constant.
    const orderData = { order: { id: 1 }, car: { id: '7' } };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue(orderData);

    // Create the result constant.
    const result = await createOrder(body);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/orders', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify(body),
    });
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(orderData);
  });
});
