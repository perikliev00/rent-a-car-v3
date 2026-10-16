/**
 * Shared HH:MM time field sanitizers/validators for body and query strings.
 */
const { body, query } = require('express-validator');
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
  let chain = body(field);
  if (optional) {
    chain = chain.optional({ checkFalsy: true });
  }
  return chain
    .customSanitizer(sanitizeTimeValue)
    .matches(TIME_STRICT)
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
  let chain = query(field);
  if (required) {
    chain = chain.notEmpty().withMessage(emptyMessage || 'Time is required.');
  } else {
    chain = chain.optional({ checkFalsy: true });
  }
  return chain
    .customSanitizer(sanitizeTimeValue)
    .matches(TIME_STRICT)
    .withMessage(formatMessage || 'Time must be in HH:MM format.');
}

module.exports = { bodyTimeRule, queryTimeRule, sanitizeTimeValue, TIME_STRICT };
