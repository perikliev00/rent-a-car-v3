// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('./client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './cars'.
import { buildSearchQuery, getCar, getCars, searchCars } from './cars';

// Declare a test suite grouping related cases.
describe('cars API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('getCars calls /api/cars with filter query params', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ cars: [], pagination: {} });
    // Wait until the asynchronous operation resolves.
    await getCars({ page: 2, categoryId: 3, transmission: 'auto' });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/cars?page=2&categoryId=3&transmission=auto');
  });

  // Define a single test case and its expectations.
  it('getCars calls /api/cars without query when no filters', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ cars: [] });
    // Wait until the asynchronous operation resolves.
    await getCars();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/cars');
  });

  // Define a single test case and its expectations.
  it('searchCars builds search query string', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ cars: [] });
    // Create the search constant.
    const search = {
      // Provide the pickup location field value.
      pickupLocation: 'airport' as const,
      // Provide the return location field value.
      returnLocation: 'downtown' as const,
      // Provide the pickup date field value.
      pickupDate: '2026-07-10',
      // Provide the return date field value.
      returnDate: '2026-07-15',
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '18:00',
    };

    // Wait until the asynchronous operation resolves.
    await searchCars(search, { page: 1 });

    // Create the url constant.
    const url = mockApi.mock.calls[0][0] as string;
    // Assert that the value matches the intended expectation.
    expect(url).toMatch(/^\/api\/cars\/search\?/);
    // Assert that the value matches the intended expectation.
    expect(url).toContain('pickup-date=2026-07-10');
    // Assert that the value matches the intended expectation.
    expect(url).toContain('return-location=downtown');
    // Assert that the value matches the intended expectation.
    expect(url).toContain('page=1');
  });

  // Define a single test case and its expectations.
  it('getCar fetches a single car by id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ car: { id: '42' } });
    // Wait until the asynchronous operation resolves.
    await getCar('42');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/cars/42');
  });

  // Define a single test case and its expectations.
  it('buildSearchQuery merges search and filter params', () => {
    // Create the params constant.
    const params = buildSearchQuery(
      {
        // Provide the pickup location field value.
        pickupLocation: 'airport',
        // Provide the return location field value.
        returnLocation: 'airport',
        // Provide the pickup date field value.
        pickupDate: '2026-07-01',
        // Provide the return date field value.
        returnDate: '2026-07-05',
        // Provide the pickup time field value.
        pickupTime: '09:00',
        // Provide the return time field value.
        returnTime: '17:00',
      },
      // Contribute this line to the enclosing declaration or statement.
      { fuelType: 'electric' },
    );

    // Assert that the value matches the intended expectation.
    expect(params.get('pickup-location')).toBe('airport');
    // Assert that the value matches the intended expectation.
    expect(params.get('fuelType')).toBe('electric');
  });
});
