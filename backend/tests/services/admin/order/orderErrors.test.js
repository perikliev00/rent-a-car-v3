// Destructure object properties into local variables.
const { OrderFormError, OrderRestoreError } = require('../../../../src/services/admin/order/orderErrors');

// Declare a test suite grouping related cases.
describe('orderErrors', () => {
  // Define a single test case and its expectations.
  test('OrderFormError sets form error flag and code', () => {
    // Create the error constant.
    const error = new OrderFormError('OVERLAP', 'Dates overlap.');

    // Assert that the value matches the intended expectation.
    expect(error.isOrderFormError).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(error.code).toBe('OVERLAP');
    // Assert that the value matches the intended expectation.
    expect(error.message).toBe('Dates overlap.');
  });

  // Define a single test case and its expectations.
  test('OrderRestoreError sets restore error flag', () => {
    // Create the error constant.
    const error = new OrderRestoreError('RESTORE_INVALID', 'Cannot restore.');

    // Assert that the value matches the intended expectation.
    expect(error.isOrderRestoreError).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(error.message).toBe('Cannot restore.');
  });
});
