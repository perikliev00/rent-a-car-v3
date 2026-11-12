jest.mock('../../../src/db/transaction', () => ({
  clientQuery: jest.fn(),
}));

const { clientQuery } = require('../../../src/db/transaction');
const {
  getOpsDashboard,
} = require('../../../src/services/admin/reservationOpsDashboardService');

describe('getOpsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('joins latest refund_operations and maps refundOperation', async () => {
    const dbRow = {
      id: 42,
      status: 'manual_review',
      pickup_date: '2026-08-10',
      pickup_time: '10:00',
      return_date: '2026-08-12',
      return_time: '10:00',
      full_name: 'Refund Guest',
      email: 'guest@example.com',
      phone_number: '+359',
      total_price: 100,
      updated_at: new Date().toISOString(),
      car_name: 'Test Car',
      order_id: 7,
      refund_op_id: 9,
      refund_op_status: 'pending',
      refund_op_amount_cents: 10000,
      refund_op_currency: 'eur',
      refund_op_failure_code: null,
      refund_op_failure_message: null,
    };
    clientQuery.mockResolvedValue({ rows: [dbRow] });

    const data = await getOpsDashboard({ limit: 5 });

    expect(clientQuery.mock.calls.length).toBeGreaterThan(0);
    expect(clientQuery.mock.calls[0][1]).toMatch(/JOIN LATERAL/);
    expect(clientQuery.mock.calls[0][1]).toMatch(/refund_operations/);

    const row = data.widgets.manualReview[0];
    expect(row.refundOperation).toEqual({
      id: 9,
      status: 'pending',
      amountCents: 10000,
      currency: 'eur',
      failureCode: null,
      failureMessage: null,
      updatedAt: null,
    });
    expect(row.totalPrice).toBe(100);
  });
});
