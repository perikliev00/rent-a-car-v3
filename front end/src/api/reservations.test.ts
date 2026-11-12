// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('./client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './reservations'.
import { releaseAndRehold, releaseReservation } from './reservations';

// Declare a test suite grouping related cases.
describe('reservations API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('releaseReservation posts to /api/reservations/release', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ released: true });

    // Create the result constant.
    const result = await releaseReservation();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/reservations/release', { method: 'POST' });
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ released: true });
  });

  // Define a single test case and its expectations.
  it('releaseAndRehold posts order body to release-and-rehold', async () => {
    // Create the body constant.
    const body = {
      // Provide the car id field value.
      carId: '3',
      // Provide the pickup date field value.
      pickupDate: '2026-08-01',
      // Provide the return date field value.
      returnDate: '2026-08-05',
      // Provide the pickup location field value.
      pickupLocation: 'airport',
      // Provide the return location field value.
      returnLocation: 'downtown',
      // Provide the full name field value.
      fullName: 'Alex',
      // Provide the phone number field value.
      phoneNumber: '+111',
      // Provide the email field value.
      email: 'alex@example.com',
      // Provide the address field value.
      address: '1 Road',
    };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ reheld: true });

    // Create the result constant.
    const result = await releaseAndRehold(body);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/reservations/release-and-rehold', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify(body),
    });
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ reheld: true });
  });
});
