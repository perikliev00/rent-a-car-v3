const { claimReservationsForUser } = require('../../src/services/account/accountClaimService');

jest.mock('../../src/services/sql/reservationSqlService', () => ({
  claimByEmail: jest.fn().mockResolvedValue({ reservations: 3, orders: 2 }),
}));

const reservationSql = require('../../src/services/sql/reservationSqlService');

describe('accountClaimService', () => {
  test('delegates claim to reservationSql.claimByEmail', async () => {
    const result = await claimReservationsForUser(5, 'a@b.com');
    expect(reservationSql.claimByEmail).toHaveBeenCalledWith(5, 'a@b.com');
    expect(result).toEqual({ reservations: 3, orders: 2 });
  });
});
