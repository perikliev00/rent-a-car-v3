class OrderFormError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrderFormError';
    this.code = code;
    this.isOrderFormError = true;
  }
}

class OrderRestoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrderRestoreError';
    this.code = code;
    this.isOrderRestoreError = true;
  }
}

module.exports = {
  OrderFormError,
  OrderRestoreError,
};
