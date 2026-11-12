/**
 * Typed errors for admin order create/edit and soft-delete restore flows.
 * Controllers distinguish them via isOrderFormError / isOrderRestoreError.
 */

/** Validation/conflict error during order form create or update. */
class OrderFormError extends Error {
  // Call constructor to perform this step.
  constructor(code, message) {
    // Call super to perform this step.
    super(message);
    // Update this.name with the right-hand side value.
    this.name = 'OrderFormError';
    // Update this.code with the right-hand side value.
    this.code = code;
    // Update this.isOrderFormError with the right-hand side value.
    this.isOrderFormError = true;
  }
}

/** Error while restoring a soft-deleted order (e.g. date conflict). */
class OrderRestoreError extends Error {
  // Call constructor to perform this step.
  constructor(code, message) {
    // Call super to perform this step.
    super(message);
    // Update this.name with the right-hand side value.
    this.name = 'OrderRestoreError';
    // Update this.code with the right-hand side value.
    this.code = code;
    // Update this.isOrderRestoreError with the right-hand side value.
    this.isOrderRestoreError = true;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  OrderFormError,
  // Contribute this line to the enclosing declaration or statement.
  OrderRestoreError,
};
