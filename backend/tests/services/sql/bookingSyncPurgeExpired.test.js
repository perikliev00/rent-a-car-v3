// Call jest.mock to perform this step.
jest.mock('../../../src/db/transaction', () => ({
  // Provide the client query field value.
  clientQuery: jest.fn(),
  // Provide the is car date block overlap violation field value.
  isCarDateBlockOverlapViolation: jest.fn(),
}));

// Destructure object properties into local variables.
const { clientQuery, isCarDateBlockOverlapViolation } = require('../../../src/db/transaction');
// Destructure object properties into local variables.
const { purgeExpired } = require('../../../src/services/sql/bookingSyncSqlService');

// Declare a test suite grouping related cases.
describe('purgeExpired open physical rental retention', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call clientQuery.mockResolvedValue to perform this step.
    clientQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    // Call isCarDateBlockOverlapViolation.mockReturnValue to perform this step.
    isCarDateBlockOverlapViolation.mockReturnValue(false);
  });

  // Define a single test case and its expectations.
  test('extends, clamps closed rentals, then deletes expired ones (all cars)', async () => {
    // Wait until the asynchronous operation resolves.
    await purgeExpired();

    // Assert that the value matches the intended expectation.
    expect(clientQuery).toHaveBeenCalledTimes(3);

    // Destructure array values into local variables.
    const [extendCall, clampCall, deleteCall] = clientQuery.mock.calls;
    // Assert that the value matches the intended expectation.
    expect(extendCall[1]).toMatch(/UPDATE car_date_blocks/);
    // Assert that the value matches the intended expectation.
    expect(extendCall[1]).toMatch(/picked_up/);
    // Assert that the value matches the intended expectation.
    expect(extendCall[1]).toMatch(/active_rental/);
    // Assert that the value matches the intended expectation.
    expect(extendCall[2][0]).toBeInstanceOf(Date);

    // Assert that the value matches the intended expectation.
    expect(clampCall[1]).toMatch(/UPDATE car_date_blocks/);
    // Assert that the value matches the intended expectation.
    expect(clampCall[1]).toMatch(/clamp_end/);
    // Assert that the value matches the intended expectation.
    expect(clampCall[1]).toMatch(/NOT IN/);
    // Assert that the value matches the intended expectation.
    expect(clampCall[2][0]).toBeInstanceOf(Date);

    // Assert that the value matches the intended expectation.
    expect(deleteCall[1]).toMatch(/DELETE FROM car_date_blocks/);
    // Assert that the value matches the intended expectation.
    expect(deleteCall[1]).toMatch(/end_date <= \$1/);
    // Assert that the value matches the intended expectation.
    expect(deleteCall[1]).toMatch(/picked_up/);
    // Assert that the value matches the intended expectation.
    expect(deleteCall[1]).toMatch(/NOT EXISTS/);
    // Assert that the value matches the intended expectation.
    expect(deleteCall[2][0]).toBeInstanceOf(Date);
    // Extended end is strictly after purge "now" so extended rows survive the delete.
    expect(extendCall[2][0].getTime()).toBeGreaterThan(deleteCall[2][0].getTime());
  });

  // Define a single test case and its expectations.
  test('extends, clamps, then deletes for a single car', async () => {
    // Wait until the asynchronous operation resolves.
    await purgeExpired(42);

    // Assert that the value matches the intended expectation.
    expect(clientQuery).toHaveBeenCalledTimes(3);
    // Destructure array values into local variables.
    const [extendCall, clampCall, deleteCall] = clientQuery.mock.calls;

    // Assert that the value matches the intended expectation.
    expect(extendCall[1]).toMatch(/UPDATE car_date_blocks/);
    // Assert that the value matches the intended expectation.
    expect(extendCall[2][0]).toBe(42);
    // Assert that the value matches the intended expectation.
    expect(clampCall[1]).toMatch(/clamp_end/);
    // Assert that the value matches the intended expectation.
    expect(clampCall[2][0]).toBe(42);
    // Assert that the value matches the intended expectation.
    expect(deleteCall[1]).toMatch(/DELETE FROM car_date_blocks/);
    // Assert that the value matches the intended expectation.
    expect(deleteCall[1]).toMatch(/car_id = \$1/);
    // Assert that the value matches the intended expectation.
    expect(deleteCall[1]).toMatch(/NOT EXISTS/);
    // Assert that the value matches the intended expectation.
    expect(deleteCall[2][0]).toBe(42);
  });

  // Define a single test case and its expectations.
  test('continues to clamp and guarded delete when extend hits a GiST overlap', async () => {
    // Create the overlap err constant.
    const overlapErr = Object.assign(new Error('overlap'), { code: '23P01' });
    // Call isCarDateBlockOverlapViolation.mockReturnValue to perform this step.
    isCarDateBlockOverlapViolation.mockReturnValue(true);
    // Reference the identifier used by the enclosing expression.
    clientQuery
      // Call .mockRejectedValueOnce to perform this step.
      .mockRejectedValueOnce(overlapErr)
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    // Wait until the asynchronous operation resolves.
    await purgeExpired(9);

    // Assert that the value matches the intended expectation.
    expect(clientQuery).toHaveBeenCalledTimes(3);
    // Assert that the value matches the intended expectation.
    expect(clientQuery.mock.calls[1][1]).toMatch(/clamp_end/);
    // Assert that the value matches the intended expectation.
    expect(clientQuery.mock.calls[2][1]).toMatch(/NOT EXISTS/);
  });

  // Define a single test case and its expectations.
  test('no-ops on invalid car id', async () => {
    // Wait until the asynchronous operation resolves.
    await purgeExpired('not-a-car');
    // Assert that the value matches the intended expectation.
    expect(clientQuery).not.toHaveBeenCalled();
  });
});
