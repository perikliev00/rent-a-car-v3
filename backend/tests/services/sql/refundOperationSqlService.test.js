jest.mock('../../../src/db/transaction', () => ({
  clientQuery: jest.fn(),
}));

const { clientQuery } = require('../../../src/db/transaction');
const {
  updateRefundOperation,
} = require('../../../src/services/sql/refundOperationSqlService');

describe('updateRefundOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('failed status SQL includes status <> succeeded; 0 rows maps to null', async () => {
    clientQuery.mockResolvedValue({ rows: [] });

    const result = await updateRefundOperation(10, {
      status: 'failed',
      stripeRawStatus: 'failed',
    });

    expect(result).toBeNull();
    expect(clientQuery.mock.calls[0][1]).toMatch(/status <> 'succeeded'/);
  });

  test('pending raw status SQL includes status <> succeeded', async () => {
    clientQuery.mockResolvedValue({ rows: [] });

    await updateRefundOperation(10, {
      status: 'pending',
      stripeRawStatus: 'pending',
    });

    expect(clientQuery.mock.calls[0][1]).toMatch(/status <> 'succeeded'/);
  });

  test('succeeded status and metadata-only patches are unguarded', async () => {
    clientQuery.mockResolvedValue({
      rows: [
        {
          id: 10,
          reservation_id: 1,
          status: 'succeeded',
          failure_code: 'DOMAIN_TRANSITION_FAILED',
        },
      ],
    });

    await updateRefundOperation(10, { status: 'succeeded' });
    expect(clientQuery.mock.calls[0][1]).not.toMatch(/status <> 'succeeded'/);

    clientQuery.mockClear();
    await updateRefundOperation(10, { failureCode: 'DOMAIN_TRANSITION_FAILED' });
    expect(clientQuery.mock.calls[0][1]).not.toMatch(/status <> 'succeeded'/);
  });
});
