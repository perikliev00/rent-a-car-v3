const { OrderFormError, OrderRestoreError } = require('../../../../src/services/admin/order/orderErrors');

describe('orderErrors', () => {
  test('OrderFormError sets form error flag and code', () => {
    const error = new OrderFormError('OVERLAP', 'Dates overlap.');

    expect(error.isOrderFormError).toBe(true);
    expect(error.code).toBe('OVERLAP');
    expect(error.message).toBe('Dates overlap.');
  });

  test('OrderRestoreError sets restore error flag', () => {
    const error = new OrderRestoreError('RESTORE_INVALID', 'Cannot restore.');

    expect(error.isOrderRestoreError).toBe(true);
    expect(error.message).toBe('Cannot restore.');
  });
});
