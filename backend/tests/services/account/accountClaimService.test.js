// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/userSqlService', () => ({
  // Provide the find user by id field value.
  findUserById: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  // Provide the claim by email field value.
  claimByEmail: jest.fn(),
}));

// Require the '../../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../../src/services/sql/userSqlService');
// Require the '../../../src/services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../../src/services/sql/reservationSqlService');
// Destructure object properties into local variables.
const { claimReservationsForUser } = require('../../../src/services/account/accountClaimService');

// Declare a test suite grouping related cases.
describe('accountClaimService', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('skips claim when the user email is not verified', async () => {
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue({
      // Provide the id field value.
      id: '7',
      // Provide the email field value.
      email: 'guest@example.com',
      // Provide the email verified at field value.
      emailVerifiedAt: null,
    });

    // Create the result constant.
    const result = await claimReservationsForUser(7, 'guest@example.com');

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ reservations: 0, orders: 0, skipped: true });
    // Assert that the value matches the intended expectation.
    expect(reservationSql.claimByEmail).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('claims by email when the user is verified', async () => {
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue({
      // Provide the id field value.
      id: '7',
      // Provide the email field value.
      email: 'guest@example.com',
      // Provide the email verified at field value.
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    // Call reservationSql.claimByEmail.mockResolvedValue to perform this step.
    reservationSql.claimByEmail.mockResolvedValue({ reservations: 2, orders: 1 });

    // Create the result constant.
    const result = await claimReservationsForUser(7, 'guest@example.com');

    // Assert that the value matches the intended expectation.
    expect(reservationSql.claimByEmail).toHaveBeenCalledWith(7, 'guest@example.com');
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ reservations: 2, orders: 1 });
  });
});
