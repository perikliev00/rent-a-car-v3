// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();
// Create the mock api form data constant.
const mockApiFormData = vi.fn();

// Call vi.mock to perform this step.
vi.mock('./client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
  // Provide the api form data field value.
  apiFormData: (...args: unknown[]) => mockApiFormData(...args),
  // Provide the api base field value.
  API_BASE: 'http://localhost:3000',
}));

// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  deleteCustomerDocument,
  // Contribute this line to the enclosing declaration or statement.
  getAccountDashboard,
  // Contribute this line to the enclosing declaration or statement.
  getAccountReservation,
  // Contribute this line to the enclosing declaration or statement.
  listAccountReservations,
  // Contribute this line to the enclosing declaration or statement.
  listCustomerDocuments,
  // Contribute this line to the enclosing declaration or statement.
  requestCancellation,
  // Contribute this line to the enclosing declaration or statement.
  updateTravelDetails,
  // Contribute this line to the enclosing declaration or statement.
  uploadCustomerDocument,
// Contribute this line to the enclosing declaration or statement.
} from './account';

// Declare a test suite grouping related cases.
describe('account API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
    // Call mockApiFormData.mockReset to perform this step.
    mockApiFormData.mockReset();
  });

  // Define a single test case and its expectations.
  it('getAccountDashboard fetches dashboard', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ counts: { total: 0, active: 0, completed: 0 } });
    // Wait until the asynchronous operation resolves.
    await getAccountDashboard();
    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/account/dashboard');
  });

  // Define a single test case and its expectations.
  it('listAccountReservations fetches reservations', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ reservations: [] });
    // Wait until the asynchronous operation resolves.
    await listAccountReservations();
    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations');
  });

  // Define a single test case and its expectations.
  it('getAccountReservation fetches by id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ reservation: { id: '10' } });
    // Wait until the asynchronous operation resolves.
    await getAccountReservation('10');
    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations/10');
  });

  // Define a single test case and its expectations.
  it('updateTravelDetails patches travel body', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ reservation: { id: '10' } });
    // Wait until the asynchronous operation resolves.
    await updateTravelDetails('10', { flightNumber: 'FR1' });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations/10/travel', {
      // Provide the method field value.
      method: 'PATCH',
      // Provide the body field value.
      body: JSON.stringify({ flightNumber: 'FR1' }),
    });
  });

  // Define a single test case and its expectations.
  it('requestCancellation posts reason', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ immediate: false });
    // Wait until the asynchronous operation resolves.
    await requestCancellation('10', 'Plans changed');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/account/reservations/10/cancel-request', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({ reason: 'Plans changed' }),
    });
  });

  // Define a single test case and its expectations.
  it('listCustomerDocuments fetches documents', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ documents: [] });
    // Wait until the asynchronous operation resolves.
    await listCustomerDocuments();
    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/account/documents');
  });

  // Define a single test case and its expectations.
  it('uploadCustomerDocument posts form data', async () => {
    // Call mockApiFormData.mockResolvedValue to perform this step.
    mockApiFormData.mockResolvedValue({ document: { id: 1 } });
    // Create the form data constant.
    const formData = new FormData();
    // Wait until the asynchronous operation resolves.
    await uploadCustomerDocument(formData);

    // Assert that the value matches the intended expectation.
    expect(mockApiFormData).toHaveBeenCalledWith('/api/account/documents', formData);
  });

  // Define a single test case and its expectations.
  it('deleteCustomerDocument deletes by id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ document: { id: 5 } });
    // Wait until the asynchronous operation resolves.
    await deleteCustomerDocument(5);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/account/documents/5', { method: 'DELETE' });
  });
});
