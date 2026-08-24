const fs = require('fs');
const path = require('path');

jest.mock('../../../src/db/transaction', () => ({
  clientQuery: jest.fn(),
}));

const { clientQuery } = require('../../../src/db/transaction');
const {
  RECONCILE_SCRIPT_PATH,
  listPaymentRefundQueue,
} = require('../../../src/services/admin/paymentAdminService');

const refundableRow = {
  id: 512,
  status: 'confirmed',
  pickup_date: '2026-08-20',
  pickup_time: '10:00',
  return_date: '2026-08-23',
  return_time: '10:00',
  full_name: 'Paid Guest',
  email: 'paid@example.com',
  phone_number: '+359',
  total_price: 210,
  updated_at: '2026-08-24T09:00:00.000Z',
  car_name: 'Golf',
  order_id: 88,
  refund_op_id: null,
  refund_op_status: null,
  refund_op_amount_cents: null,
  refund_op_currency: null,
  refund_op_failure_code: null,
  refund_op_failure_message: null,
  refund_op_updated_at: null,
};

const succeededRow = {
  ...refundableRow,
  id: 400,
  status: 'refunded',
  order_id: 70,
  refund_op_id: 3,
  refund_op_status: 'succeeded',
  refund_op_amount_cents: 21000,
  refund_op_currency: 'eur',
  refund_op_updated_at: '2026-08-24T10:00:00.000Z',
};

function sqlOf(call) {
  return String(call[1] || '');
}

describe('paymentAdminService reconcile script path', () => {
  test('RECONCILE_SCRIPT_PATH points at backend/scripts/reconcileStripeSessions.js', () => {
    expect(fs.existsSync(RECONCILE_SCRIPT_PATH)).toBe(true);
    expect(path.basename(RECONCILE_SCRIPT_PATH)).toBe('reconcileStripeSessions.js');
    expect(RECONCILE_SCRIPT_PATH.replace(/\\/g, '/')).toMatch(/\/scripts\/reconcileStripeSessions\.js$/);
    expect(RECONCILE_SCRIPT_PATH.replace(/\\/g, '/')).not.toMatch(/\/src\/scripts\//);
  });
});

describe('listPaymentRefundQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clientQuery.mockImplementation(async (_client, sql) => {
      if (String(sql).includes("refund_op.status = 'succeeded'")) {
        return { rows: [succeededRow] };
      }
      return { rows: [refundableRow] };
    });
  });

  test('maps refundable and recent refund rows', async () => {
    const data = await listPaymentRefundQueue({ limit: 20 });

    expect(data.limit).toBe(20);
    expect(data.refundable[0]).toMatchObject({
      id: '512',
      status: 'confirmed',
      orderId: '88',
      carName: 'Golf',
      fullName: 'Paid Guest',
      totalPrice: 210,
      refundOperation: null,
    });
    expect(data.recentRefunds[0]).toMatchObject({
      id: '400',
      status: 'refunded',
      orderId: '70',
      refundOperation: {
        id: 3,
        status: 'succeeded',
        amountCents: 21000,
        currency: 'eur',
      },
    });
  });

  test('refundable SQL excludes succeeded ledger and includes refundable statuses', async () => {
    await listPaymentRefundQueue();
    const refundableSql = clientQuery.mock.calls.map(sqlOf).find((sql) => sql.includes("<> 'succeeded'"));
    expect(refundableSql).toBeTruthy();
    expect(refundableSql).toMatch(/JOIN LATERAL/);
    expect(refundableSql).toMatch(/refund_operations/);
    expect(refundableSql).toMatch(/r\.status IN/);
  });

  test('q matches reservation or order id', async () => {
    await listPaymentRefundQueue({ q: '512' });
    const withSearch = clientQuery.mock.calls.map(sqlOf).filter((sql) => sql.includes('r.id::text'));
    expect(withSearch.length).toBe(2);
    expect(withSearch[0]).toMatch(/o\.id::text/);
    const searchParams = clientQuery.mock.calls
      .map((call) => call[2])
      .filter((params) => Array.isArray(params) && params.includes('512'));
    expect(searchParams.length).toBe(2);
  });

  test('status, refundState and pickup date filters appear in refundable SQL only', async () => {
    await listPaymentRefundQueue({
      status: 'confirmed',
      refundState: 'pending',
      pickupFrom: '2026-08-01',
      pickupTo: '2026-08-31',
    });

    const refundableCall = clientQuery.mock.calls.find((call) => sqlOf(call).includes("<> 'succeeded'"));
    const recentCall = clientQuery.mock.calls.find((call) => sqlOf(call).includes("refund_op.status = 'succeeded'"));
    const refundableSql = sqlOf(refundableCall);
    const recentSql = sqlOf(recentCall);
    const refundableParams = refundableCall[2];

    expect(refundableSql).toMatch(/r\.status = \$/);
    expect(refundableSql).toMatch(/refund_op\.status = \$/);
    expect(refundableSql).toMatch(/Europe\/Sofia/);
    expect(refundableParams).toEqual(expect.arrayContaining(['confirmed', 'pending', '2026-08-01', '2026-08-31']));

    expect(recentSql).not.toMatch(/r\.status = \$/);
    expect(recentSql).not.toMatch(/Europe\/Sofia/);
    expect(recentCall[2]).not.toEqual(expect.arrayContaining(['confirmed']));
  });

  test('refundState none filters missing ledger', async () => {
    await listPaymentRefundQueue({ refundState: 'none' });
    const refundableSql = clientQuery.mock.calls.map(sqlOf).find((sql) => sql.includes("<> 'succeeded'"));
    expect(refundableSql).toMatch(/refund_op\.id IS NULL/);
  });
});
