// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('./client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './locations'.
import { getCategories, getLocations, getPricingInfo } from './locations';

// Declare a test suite grouping related cases.
describe('locations API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('getLocations fetches /api/locations', async () => {
    // Create the data constant.
    const data = { locations: [], deliveryFees: {}, returnFees: {} };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue(data);

    // Create the result constant.
    const result = await getLocations();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/locations');
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(data);
  });

  // Define a single test case and its expectations.
  it('getPricingInfo fetches /api/pricing-info', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ deliveryFees: {}, returnFees: {}, priceTierExplanation: {} });
    // Wait until the asynchronous operation resolves.
    await getPricingInfo();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/pricing-info');
  });

  // Define a single test case and its expectations.
  it('getCategories fetches /api/categories', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ categories: [{ id: 1, name: 'SUV' }] });

    // Create the result constant.
    const result = await getCategories();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/categories');
    // Assert that the value matches the intended expectation.
    expect(result.categories[0].name).toBe('SUV');
  });
});
