const { query, param } = require('express-validator');

const dateRangeQuery = [
  query('from')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('from must be YYYY-MM-DD'),
  query('to')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('to must be YYYY-MM-DD'),
];

const limitQuery = [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const carIdParam = [param('carId').isInt({ min: 1 }).withMessage('Invalid car id')];

module.exports = {
  dateRangeQuery,
  limitQuery,
  carIdParam,
};
