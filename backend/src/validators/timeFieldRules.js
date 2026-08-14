const { body, query } = require('express-validator');
const { toHHMM } = require('../utils/date/normalizeTime');

const TIME_STRICT = /^\d{2}:\d{2}$/;

function sanitizeTimeValue(value) {
  return toHHMM(value) ?? value;
}

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
