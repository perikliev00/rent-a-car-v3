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
  findOpenPhysicalRental,
  // Contribute this line to the enclosing declaration or statement.
  OPEN_PHYSICAL_RENTAL_STATUSES,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/sql/reservation/reservationReadRepository');

// Declare a test suite grouping related cases.
describe('findOpenPhysicalRental', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('queries picked_up and active_rental only', async () => {
    // Call clientQuery.mockResolvedValue to perform this step.
    clientQuery.mockResolvedValue({ rows: [] });

    // Wait until the asynchronous operation resolves.
    await findOpenPhysicalRental(7);

    // Assert that the value matches the intended expectation.
    expect(clientQuery).toHaveBeenCalledTimes(1);
    // Destructure array values into local variables.
    const [, sql, params] = clientQuery.mock.calls[0];
    // Assert that the value matches the intended expectation.
    expect(sql).toMatch(/r\.status = ANY/);
    // Assert that the value matches the intended expectation.
    expect(params[0]).toBe(7);
    // Assert that the value matches the intended expectation.
    expect(params[1]).toEqual([...OPEN_PHYSICAL_RENTAL_STATUSES]);
    // Assert that the value matches the intended expectation.
    expect(OPEN_PHYSICAL_RENTAL_STATUSES).toEqual(['picked_up', 'active_rental']);
  });

  // Define a single test case and its expectations.
  test('excludes a reservation id when provided', async () => {
    // Call clientQuery.mockResolvedValue to perform this step.
    clientQuery.mockResolvedValue({ rows: [] });

    // Wait until the asynchronous operation resolves.
    await findOpenPhysicalRental(7, null, { excludeReservationId: 99 });

    // Destructure array values into local variables.
    const [, sql, params] = clientQuery.mock.calls[0];
    // Assert that the value matches the intended expectation.
    expect(sql).toMatch(/r\.id <>/);
    // Assert that the value matches the intended expectation.
    expect(params[2]).toBe(99);
  });

  // Define a single test case and its expectations.
  test('returns null for invalid car id', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(findOpenPhysicalRental(null)).resolves.toBeNull();
    // Assert that the value matches the intended expectation.
    expect(clientQuery).not.toHaveBeenCalled();
  });
});
