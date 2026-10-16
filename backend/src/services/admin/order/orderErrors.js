/**
 * Typed errors for admin order create/edit and soft-delete restore flows.
 * Controllers distinguish them via isOrderFormError / isOrderRestoreError.
 */

/** Validation/conflict error during order form create or update. */
class OrderFormError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrderFormError';
    this.code = code;
    this.isOrderFormError = true;
  }
}

/** Error while restoring a soft-deleted order (e.g. date conflict). */
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
