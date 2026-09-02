jest.mock('../../../src/db/transaction', () => ({
  clientQuery: jest.fn(),
  isCarDateBlockOverlapViolation: jest.fn(),
}));

const { clientQuery, isCarDateBlockOverlapViolation } = require('../../../src/db/transaction');
const { purgeExpired } = require('../../../src/services/sql/bookingSyncSqlService');

describe('purgeExpired open physical rental retention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clientQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    isCarDateBlockOverlapViolation.mockReturnValue(false);
  });

  test('extends, clamps closed rentals, then deletes expired ones (all cars)', async () => {
    await purgeExpired();

    expect(clientQuery).toHaveBeenCalledTimes(3);

    const [extendCall, clampCall, deleteCall] = clientQuery.mock.calls;
    expect(extendCall[1]).toMatch(/UPDATE car_date_blocks/);
    expect(extendCall[1]).toMatch(/picked_up/);
    expect(extendCall[1]).toMatch(/active_rental/);
    expect(extendCall[2][0]).toBeInstanceOf(Date);

    expect(clampCall[1]).toMatch(/UPDATE car_date_blocks/);
    expect(clampCall[1]).toMatch(/clamp_end/);
    expect(clampCall[1]).toMatch(/NOT IN/);
    expect(clampCall[2][0]).toBeInstanceOf(Date);

    expect(deleteCall[1]).toMatch(/DELETE FROM car_date_blocks/);
    expect(deleteCall[1]).toMatch(/end_date <= \$1/);
    expect(deleteCall[1]).toMatch(/picked_up/);
    expect(deleteCall[1]).toMatch(/NOT EXISTS/);
    expect(deleteCall[2][0]).toBeInstanceOf(Date);
    // Extended end is strictly after purge "now" so extended rows survive the delete.
    expect(extendCall[2][0].getTime()).toBeGreaterThan(deleteCall[2][0].getTime());
  });

  test('extends, clamps, then deletes for a single car', async () => {
    await purgeExpired(42);

    expect(clientQuery).toHaveBeenCalledTimes(3);
    const [extendCall, clampCall, deleteCall] = clientQuery.mock.calls;

    expect(extendCall[1]).toMatch(/UPDATE car_date_blocks/);
    expect(extendCall[2][0]).toBe(42);
    expect(clampCall[1]).toMatch(/clamp_end/);
    expect(clampCall[2][0]).toBe(42);
    expect(deleteCall[1]).toMatch(/DELETE FROM car_date_blocks/);
    expect(deleteCall[1]).toMatch(/car_id = \$1/);
    expect(deleteCall[1]).toMatch(/NOT EXISTS/);
    expect(deleteCall[2][0]).toBe(42);
  });

  test('continues to clamp and guarded delete when extend hits a GiST overlap', async () => {
    const overlapErr = Object.assign(new Error('overlap'), { code: '23P01' });
    isCarDateBlockOverlapViolation.mockReturnValue(true);
    clientQuery
      .mockRejectedValueOnce(overlapErr)
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await purgeExpired(9);

    expect(clientQuery).toHaveBeenCalledTimes(3);
    expect(clientQuery.mock.calls[1][1]).toMatch(/clamp_end/);
    expect(clientQuery.mock.calls[2][1]).toMatch(/NOT EXISTS/);
  });

  test('no-ops on invalid car id', async () => {
    await purgeExpired('not-a-car');
    expect(clientQuery).not.toHaveBeenCalled();
  });
});
