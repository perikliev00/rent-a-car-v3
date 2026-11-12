/**
 * Shared HH:MM time field sanitizers/validators for body and query strings.
 */
const { body, query } = require('express-validator');
// Destructure object properties into local variables.
const { toHHMM } = require('../utils/date/normalizeTime');

/** Strict zero-padded HH:MM pattern after sanitization. */
const TIME_STRICT = /^\d{2}:\d{2}$/;

/**
 * Normalize a time value to HH:MM when possible; otherwise leave as-is for the matcher.
 * @param {unknown} value
 * @returns {unknown}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function sanitizeTimeValue(value) {
  // Return the resulting value to the caller.
  return toHHMM(value) ?? value;
}

/**
 * express-validator chain for a body time field.
 *
 * @param {string} field
 * @param {{ optional?: boolean, message?: string }} [options]
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function bodyTimeRule(field, { optional = true, message } = {}) {
  // Initialize the mutable chain variable.
  let chain = body(field);
  // Evaluate the condition and enter the branch when it is true.
  if (optional) {
    // Update chain with the right-hand side value.
    chain = chain.optional({ checkFalsy: true });
  }
  // Return the resulting value to the caller.
  return chain
    // Call .customSanitizer to perform this step.
    .customSanitizer(sanitizeTimeValue)
    // Call .matches to perform this step.
    .matches(TIME_STRICT)
    // Call .withMessage to perform this step.
    .withMessage(message || `${field} must be in HH:MM format.`);
}

/**
 * express-validator chain for a query time field.
 *
 * @param {string} field
 * @param {{ required?: boolean, emptyMessage?: string, formatMessage?: string }} [options]
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function queryTimeRule(field, { required = false, emptyMessage, formatMessage } = {}) {
  // Initialize the mutable chain variable.
  let chain = query(field);
  // Evaluate the condition and enter the branch when it is true.
  if (required) {
    // Update chain with the right-hand side value.
    chain = chain.notEmpty().withMessage(emptyMessage || 'Time is required.');
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Update chain with the right-hand side value.
    chain = chain.optional({ checkFalsy: true });
  }
  // Return the resulting value to the caller.
  return chain
    // Call .customSanitizer to perform this step.
    .customSanitizer(sanitizeTimeValue)
    // Call .matches to perform this step.
    .matches(TIME_STRICT)
    // Call .withMessage to perform this step.
    .withMessage(formatMessage || 'Time must be in HH:MM format.');
}

// Assign the CommonJS module exports.
module.exports = { bodyTimeRule, queryTimeRule, sanitizeTimeValue, TIME_STRICT };
