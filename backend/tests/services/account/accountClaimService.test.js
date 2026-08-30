jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserById: jest.fn(),
}));
jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  claimByEmail: jest.fn(),
}));

const userSql = require('../../../src/services/sql/userSqlService');
const reservationSql = require('../../../src/services/sql/reservationSqlService');
const { claimReservationsForUser } = require('../../../src/services/account/accountClaimService');

describe('accountClaimService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('skips claim when the user email is not verified', async () => {
    userSql.findUserById.mockResolvedValue({
      id: '7',
      email: 'guest@example.com',
      emailVerifiedAt: null,
    });

    const result = await claimReservationsForUser(7, 'guest@example.com');

    expect(result).toEqual({ reservations: 0, orders: 0, skipped: true });
    expect(reservationSql.claimByEmail).not.toHaveBeenCalled();
  });

  test('claims by email when the user is verified', async () => {
    userSql.findUserById.mockResolvedValue({
      id: '7',
      email: 'guest@example.com',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    reservationSql.claimByEmail.mockResolvedValue({ reservations: 2, orders: 1 });

    const result = await claimReservationsForUser(7, 'guest@example.com');

    expect(reservationSql.claimByEmail).toHaveBeenCalledWith(7, 'guest@example.com');
    expect(result).toEqual({ reservations: 2, orders: 1 });
  });
});
