// Call jest.mock to perform this step.
jest.mock('../../../src/db/transaction', () => ({
  // Provide the client query field value.
  clientQuery: jest.fn(),
}));

// Destructure object properties into local variables.
const { clientQuery } = require('../../../src/db/transaction');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  updateRefundOperation,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/sql/refundOperationSqlService');

// Declare a test suite grouping related cases.
describe('updateRefundOperation', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('failed status SQL includes status <> succeeded; 0 rows maps to null', async () => {
    // Call clientQuery.mockResolvedValue to perform this step.
    clientQuery.mockResolvedValue({ rows: [] });

    // Create the result constant.
    const result = await updateRefundOperation(10, {
      // Provide the status field value.
      status: 'failed',
      // Provide the stripe raw status field value.
      stripeRawStatus: 'failed',
    });

    // Assert that the value matches the intended expectation.
    expect(result).toBeNull();
    // Assert that the value matches the intended expectation.
    expect(clientQuery.mock.calls[0][1]).toMatch(/status <> 'succeeded'/);
  });

  // Define a single test case and its expectations.
  test('pending raw status SQL includes status <> succeeded', async () => {
    // Call clientQuery.mockResolvedValue to perform this step.
    clientQuery.mockResolvedValue({ rows: [] });

    // Wait until the asynchronous operation resolves.
    await updateRefundOperation(10, {
      // Provide the status field value.
      status: 'pending',
      // Provide the stripe raw status field value.
      stripeRawStatus: 'pending',
    });

    // Assert that the value matches the intended expectation.
    expect(clientQuery.mock.calls[0][1]).toMatch(/status <> 'succeeded'/);
  });

  // Define a single test case and its expectations.
  test('succeeded status and metadata-only patches are unguarded', async () => {
    // Call clientQuery.mockResolvedValue to perform this step.
    clientQuery.mockResolvedValue({
      // Provide the rows field value.
      rows: [
        {
          // Provide the id field value.
          id: 10,
          // Provide the reservation id field value.
          reservation_id: 1,
          // Provide the status field value.
          status: 'succeeded',
          // Provide the failure code field value.
          failure_code: 'DOMAIN_TRANSITION_FAILED',
        },
      ],
    });

    // Wait until the asynchronous operation resolves.
    await updateRefundOperation(10, { status: 'succeeded' });
    // Assert that the value matches the intended expectation.
    expect(clientQuery.mock.calls[0][1]).not.toMatch(/status <> 'succeeded'/);

    // Call clientQuery.mockClear to perform this step.
    clientQuery.mockClear();
    // Wait until the asynchronous operation resolves.
    await updateRefundOperation(10, { failureCode: 'DOMAIN_TRANSITION_FAILED' });
    // Assert that the value matches the intended expectation.
    expect(clientQuery.mock.calls[0][1]).not.toMatch(/status <> 'succeeded'/);
  });
});
