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
  getOpsDashboard,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/admin/reservationOpsDashboardService');

// Declare a test suite grouping related cases.
describe('getOpsDashboard', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('joins latest refund_operations and maps refundOperation', async () => {
    // Create the db row constant.
    const dbRow = {
      // Provide the id field value.
      id: 42,
      // Provide the status field value.
      status: 'manual_review',
      // Provide the pickup date field value.
      pickup_date: '2026-08-10',
      // Provide the pickup time field value.
      pickup_time: '10:00',
      // Provide the return date field value.
      return_date: '2026-08-12',
      // Provide the return time field value.
      return_time: '10:00',
      // Provide the full name field value.
      full_name: 'Refund Guest',
      // Provide the email field value.
      email: 'guest@example.com',
      // Provide the phone number field value.
      phone_number: '+359',
      // Provide the total price field value.
      total_price: 100,
      // Provide the updated at field value.
      updated_at: new Date().toISOString(),
      // Provide the car name field value.
      car_name: 'Test Car',
      // Provide the order id field value.
      order_id: 7,
      // Provide the refund op id field value.
      refund_op_id: 9,
      // Provide the refund op status field value.
      refund_op_status: 'pending',
      // Provide the refund op amount cents field value.
      refund_op_amount_cents: 10000,
      // Provide the refund op currency field value.
      refund_op_currency: 'eur',
      // Provide the refund op failure code field value.
      refund_op_failure_code: null,
      // Provide the refund op failure message field value.
      refund_op_failure_message: null,
    };
    // Call clientQuery.mockResolvedValue to perform this step.
    clientQuery.mockResolvedValue({ rows: [dbRow] });

    // Create the data constant.
    const data = await getOpsDashboard({ limit: 5 });

    // Assert that the value matches the intended expectation.
    expect(clientQuery.mock.calls.length).toBeGreaterThan(0);
    // Assert that the value matches the intended expectation.
    expect(clientQuery.mock.calls[0][1]).toMatch(/JOIN LATERAL/);
    // Assert that the value matches the intended expectation.
    expect(clientQuery.mock.calls[0][1]).toMatch(/refund_operations/);

    // Create the row constant.
    const row = data.widgets.manualReview[0];
    // Assert that the value matches the intended expectation.
    expect(row.refundOperation).toEqual({
      // Provide the id field value.
      id: 9,
      // Provide the status field value.
      status: 'pending',
      // Provide the amount cents field value.
      amountCents: 10000,
      // Provide the currency field value.
      currency: 'eur',
      // Provide the failure code field value.
      failureCode: null,
      // Provide the failure message field value.
      failureMessage: null,
      // Provide the updated at field value.
      updatedAt: null,
    });
    // Assert that the value matches the intended expectation.
    expect(row.totalPrice).toBe(100);
  });
});
