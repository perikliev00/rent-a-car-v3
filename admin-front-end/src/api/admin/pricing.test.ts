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
  createSeason,
  // Contribute this line to the enclosing declaration or statement.
  deleteExtra,
  // Contribute this line to the enclosing declaration or statement.
  getAdminPricing,
  // Contribute this line to the enclosing declaration or statement.
  previewPricing,
  // Contribute this line to the enclosing declaration or statement.
  updateDeliveryFees,
  // Contribute this line to the enclosing declaration or statement.
  updateDeposit,
// Contribute this line to the enclosing declaration or statement.
} from './pricing';

// Declare a test suite grouping related cases.
describe('admin pricing API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('getAdminPricing fetches /api/admin/pricing', async () => {
    // Create the data constant.
    const data = { pricing: { seasons: [], extras: [] } };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue(data);

    // Create the result constant.
    const result = await getAdminPricing();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing');
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(data);
  });

  // Define a single test case and its expectations.
  it('updateDeliveryFees puts fees payload', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ deliveryFees: [] });
    // Wait until the asynchronous operation resolves.
    await updateDeliveryFees([{ locationId: 'office', fee: 0 }]);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/delivery-fees', {
      // Provide the method field value.
      method: 'PUT',
      // Provide the body field value.
      body: JSON.stringify({ fees: [{ locationId: 'office', fee: 0 }] }),
    });
  });

  // Define a single test case and its expectations.
  it('createSeason posts season body', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ season: { id: 1 } });
    // Wait until the asynchronous operation resolves.
    await createSeason({
      // Provide the name field value.
      name: 'Summer',
      // Provide the start month field value.
      startMonth: 6,
      // Provide the start day field value.
      startDay: 1,
      // Provide the end month field value.
      endMonth: 8,
      // Provide the end day field value.
      endDay: 31,
      // Provide the adj type field value.
      adjType: 'percent',
      // Provide the adj value field value.
      adjValue: 10,
      // Provide the active field value.
      active: true,
    });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/seasons', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: expect.stringContaining('"name":"Summer"'),
    });
  });

  // Define a single test case and its expectations.
  it('updateDeposit puts deposit payload', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ depositRule: { id: 1, defaultAmount: 200 } });
    // Wait until the asynchronous operation resolves.
    await updateDeposit({ id: 1, defaultAmount: 200, name: 'Standard' });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/deposit', {
      // Provide the method field value.
      method: 'PUT',
      // Provide the body field value.
      body: JSON.stringify({ id: 1, defaultAmount: 200, name: 'Standard' }),
    });
  });

  // Define a single test case and its expectations.
  it('deleteExtra deletes by id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ deleted: true });
    // Wait until the asynchronous operation resolves.
    await deleteExtra(4);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/extras/4', { method: 'DELETE' });
  });

  // Define a single test case and its expectations.
  it('previewPricing posts preview body', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ car: { id: 1 }, pricing: { totalPrice: 100 } });
    // Wait until the asynchronous operation resolves.
    await previewPricing({
      // Provide the car id field value.
      carId: 1,
      // Provide the pickup date field value.
      pickupDate: '2026-08-10',
      // Provide the return date field value.
      returnDate: '2026-08-12',
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
    });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/preview', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: expect.stringContaining('"carId":1'),
    });
  });
});
