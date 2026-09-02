jest.mock('../../../src/db/transaction', () => ({
  clientQuery: jest.fn(),
}));

const { clientQuery } = require('../../../src/db/transaction');
const {
  findOpenPhysicalRental,
  OPEN_PHYSICAL_RENTAL_STATUSES,
} = require('../../../src/services/sql/reservation/reservationReadRepository');

describe('findOpenPhysicalRental', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('queries picked_up and active_rental only', async () => {
    clientQuery.mockResolvedValue({ rows: [] });

    await findOpenPhysicalRental(7);

    expect(clientQuery).toHaveBeenCalledTimes(1);
    const [, sql, params] = clientQuery.mock.calls[0];
    expect(sql).toMatch(/r\.status = ANY/);
    expect(params[0]).toBe(7);
    expect(params[1]).toEqual([...OPEN_PHYSICAL_RENTAL_STATUSES]);
    expect(OPEN_PHYSICAL_RENTAL_STATUSES).toEqual(['picked_up', 'active_rental']);
  });

  test('excludes a reservation id when provided', async () => {
    clientQuery.mockResolvedValue({ rows: [] });

    await findOpenPhysicalRental(7, null, { excludeReservationId: 99 });

    const [, sql, params] = clientQuery.mock.calls[0];
    expect(sql).toMatch(/r\.id <>/);
    expect(params[2]).toBe(99);
  });

  test('returns null for invalid car id', async () => {
    await expect(findOpenPhysicalRental(null)).resolves.toBeNull();
    expect(clientQuery).not.toHaveBeenCalled();
  });
});
