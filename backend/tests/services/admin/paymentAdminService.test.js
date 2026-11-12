// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');

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
  RECONCILE_SCRIPT_PATH,
  // Contribute this line to the enclosing declaration or statement.
  listPaymentRefundQueue,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/admin/paymentAdminService');

// Create the refundable row constant.
const refundableRow = {
  // Provide the id field value.
  id: 512,
  // Provide the status field value.
  status: 'confirmed',
  // Provide the pickup date field value.
  pickup_date: '2026-08-20',
  // Provide the pickup time field value.
  pickup_time: '10:00',
  // Provide the return date field value.
  return_date: '2026-08-23',
  // Provide the return time field value.
  return_time: '10:00',
  // Provide the full name field value.
  full_name: 'Paid Guest',
  // Provide the email field value.
  email: 'paid@example.com',
  // Provide the phone number field value.
  phone_number: '+359',
  // Provide the total price field value.
  total_price: 210,
  // Provide the updated at field value.
  updated_at: '2026-08-24T09:00:00.000Z',
  // Provide the car name field value.
  car_name: 'Golf',
  // Provide the order id field value.
  order_id: 88,
  // Provide the refund op id field value.
  refund_op_id: null,
  // Provide the refund op status field value.
  refund_op_status: null,
  // Provide the refund op amount cents field value.
  refund_op_amount_cents: null,
  // Provide the refund op currency field value.
  refund_op_currency: null,
  // Provide the refund op failure code field value.
  refund_op_failure_code: null,
  // Provide the refund op failure message field value.
  refund_op_failure_message: null,
  // Provide the refund op updated at field value.
  refund_op_updated_at: null,
};

// Create the succeeded row constant.
const succeededRow = {
  // Spread refundableRow into the surrounding structure.
  ...refundableRow,
  // Provide the id field value.
  id: 400,
  // Provide the status field value.
  status: 'refunded',
  // Provide the order id field value.
  order_id: 70,
  // Provide the refund op id field value.
  refund_op_id: 3,
  // Provide the refund op status field value.
  refund_op_status: 'succeeded',
  // Provide the refund op amount cents field value.
  refund_op_amount_cents: 21000,
  // Provide the refund op currency field value.
  refund_op_currency: 'eur',
  // Provide the refund op updated at field value.
  refund_op_updated_at: '2026-08-24T10:00:00.000Z',
};

// Define the sqlOf function.
function sqlOf(call) {
  // Return the resulting value to the caller.
  return String(call[1] || '');
}

// Declare a test suite grouping related cases.
describe('paymentAdminService reconcile script path', () => {
  // Define a single test case and its expectations.
  test('RECONCILE_SCRIPT_PATH points at backend/scripts/reconcileStripeSessions.js', () => {
    // Assert that the value matches the intended expectation.
    expect(fs.existsSync(RECONCILE_SCRIPT_PATH)).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(path.basename(RECONCILE_SCRIPT_PATH)).toBe('reconcileStripeSessions.js');
    // Assert that the value matches the intended expectation.
    expect(RECONCILE_SCRIPT_PATH.replace(/\\/g, '/')).toMatch(/\/scripts\/reconcileStripeSessions\.js$/);
    // Assert that the value matches the intended expectation.
    expect(RECONCILE_SCRIPT_PATH.replace(/\\/g, '/')).not.toMatch(/\/src\/scripts\//);
  });
});

// Declare a test suite grouping related cases.
describe('listPaymentRefundQueue', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call clientQuery.mockImplementation to perform this step.
    clientQuery.mockImplementation(async (_client, sql) => {
      // Evaluate the condition and enter the branch when it is true.
      if (String(sql).includes("refund_op.status = 'succeeded'")) {
        // Return the resulting value to the caller.
        return { rows: [succeededRow] };
      }
      // Return the resulting value to the caller.
      return { rows: [refundableRow] };
    });
  });

  // Define a single test case and its expectations.
  test('maps refundable and recent refund rows', async () => {
    // Create the data constant.
    const data = await listPaymentRefundQueue({ limit: 20 });

    // Assert that the value matches the intended expectation.
    expect(data.limit).toBe(20);
    // Assert that the value matches the intended expectation.
    expect(data.refundable[0]).toMatchObject({
      // Provide the id field value.
      id: '512',
      // Provide the status field value.
      status: 'confirmed',
      // Provide the order id field value.
      orderId: '88',
      // Provide the car name field value.
      carName: 'Golf',
      // Provide the full name field value.
      fullName: 'Paid Guest',
      // Provide the total price field value.
      totalPrice: 210,
      // Provide the refund operation field value.
      refundOperation: null,
    });
    // Assert that the value matches the intended expectation.
    expect(data.recentRefunds[0]).toMatchObject({
      // Provide the id field value.
      id: '400',
      // Provide the status field value.
      status: 'refunded',
      // Provide the order id field value.
      orderId: '70',
      // Provide the refund operation field value.
      refundOperation: {
        // Provide the id field value.
        id: 3,
        // Provide the status field value.
        status: 'succeeded',
        // Provide the amount cents field value.
        amountCents: 21000,
        // Provide the currency field value.
        currency: 'eur',
      },
    });
  });

  // Define a single test case and its expectations.
  test('refundable SQL excludes succeeded ledger and includes refundable statuses', async () => {
    // Wait until the asynchronous operation resolves.
    await listPaymentRefundQueue();
    // Create the refundable sql constant.
    const refundableSql = clientQuery.mock.calls.map(sqlOf).find((sql) => sql.includes("<> 'succeeded'"));
    // Assert that the value matches the intended expectation.
    expect(refundableSql).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(refundableSql).toMatch(/JOIN LATERAL/);
    // Assert that the value matches the intended expectation.
    expect(refundableSql).toMatch(/refund_operations/);
    // Assert that the value matches the intended expectation.
    expect(refundableSql).toMatch(/r\.status IN/);
  });

  // Define a single test case and its expectations.
  test('q matches reservation or order id', async () => {
    // Wait until the asynchronous operation resolves.
    await listPaymentRefundQueue({ q: '512' });
    // Create the with search constant.
    const withSearch = clientQuery.mock.calls.map(sqlOf).filter((sql) => sql.includes('r.id::text'));
    // Assert that the value matches the intended expectation.
    expect(withSearch.length).toBe(2);
    // Assert that the value matches the intended expectation.
    expect(withSearch[0]).toMatch(/o\.id::text/);
    // Create the search params constant.
    const searchParams = clientQuery.mock.calls
      // Call .map to perform this step.
      .map((call) => call[2])
      // Call .filter to perform this step.
      .filter((params) => Array.isArray(params) && params.includes('512'));
    // Assert that the value matches the intended expectation.
    expect(searchParams.length).toBe(2);
  });

  // Define a single test case and its expectations.
  test('status, refundState and pickup date filters appear in refundable SQL only', async () => {
    // Wait until the asynchronous operation resolves.
    await listPaymentRefundQueue({
      // Provide the status field value.
      status: 'confirmed',
      // Provide the refund state field value.
      refundState: 'pending',
      // Provide the pickup from field value.
      pickupFrom: '2026-08-01',
      // Provide the pickup to field value.
      pickupTo: '2026-08-31',
    });

    // Create the refundable call constant.
    const refundableCall = clientQuery.mock.calls.find((call) => sqlOf(call).includes("<> 'succeeded'"));
    // Create the recent call constant.
    const recentCall = clientQuery.mock.calls.find((call) => sqlOf(call).includes("refund_op.status = 'succeeded'"));
    // Create the refundable sql constant.
    const refundableSql = sqlOf(refundableCall);
    // Create the recent sql constant.
    const recentSql = sqlOf(recentCall);
    // Create the refundable params constant.
    const refundableParams = refundableCall[2];

    // Assert that the value matches the intended expectation.
    expect(refundableSql).toMatch(/r\.status = \$/);
    // Assert that the value matches the intended expectation.
    expect(refundableSql).toMatch(/refund_op\.status = \$/);
    // Assert that the value matches the intended expectation.
    expect(refundableSql).toMatch(/Europe\/Sofia/);
    // Assert that the value matches the intended expectation.
    expect(refundableParams).toEqual(expect.arrayContaining(['confirmed', 'pending', '2026-08-01', '2026-08-31']));

    // Assert that the value matches the intended expectation.
    expect(recentSql).not.toMatch(/r\.status = \$/);
    // Assert that the value matches the intended expectation.
    expect(recentSql).not.toMatch(/Europe\/Sofia/);
    // Assert that the value matches the intended expectation.
    expect(recentCall[2]).not.toEqual(expect.arrayContaining(['confirmed']));
  });

  // Define a single test case and its expectations.
  test('refundState none filters missing ledger', async () => {
    // Wait until the asynchronous operation resolves.
    await listPaymentRefundQueue({ refundState: 'none' });
    // Create the refundable sql constant.
    const refundableSql = clientQuery.mock.calls.map(sqlOf).find((sql) => sql.includes("<> 'succeeded'"));
    // Assert that the value matches the intended expectation.
    expect(refundableSql).toMatch(/refund_op\.id IS NULL/);
  });
});
