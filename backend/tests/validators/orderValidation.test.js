const request = require('supertest');
const { createValidatorApp } = require('../helpers/validatorTestUtils');
const { orderBodyValidationRules } = require('../../src/validators/orderBodyValidationRules');
const { adminOrderBodyValidationRules } = require('../../src/validators/adminOrderBodyValidationRules');
const { adminOrderListQueryValidationRules } = require('../../src/validators/adminOrderListQueryValidationRules');

const validOrderBody = {
  carId: 1,
  pickupDate: '2026-08-01',
  returnDate: '2026-08-05',
  pickupTime: '10:00',
  returnTime: '10:00',
  pickupLocation: 'office',
  returnLocation: 'office',
  fullName: 'Jane Doe',
  phoneNumber: '+359888123456',
  email: 'jane@example.com',
  address: 'Main St 1',
};

describe('orderBodyValidationRules', () => {
  const app = createValidatorApp(orderBodyValidationRules);

  test('accepts valid order body', async () => {
    await request(app).post('/validate').send(validOrderBody).expect(200);
  });

  test('rejects invalid pickup location', async () => {
    const response = await request(app)
      .post('/validate')
      .send({ ...validOrderBody, pickupLocation: 'invalid' })
      .expect(422);

    expect(response.body.errors).toContain('Invalid pickup location.');
  });
});

describe('adminOrderBodyValidationRules', () => {
  const app = createValidatorApp(adminOrderBodyValidationRules);

  test('accepts valid admin order body', async () => {
    await request(app).post('/validate').send(validOrderBody).expect(200);
  });

  test('rejects missing full name', async () => {
    const response = await request(app)
      .post('/validate')
      .send({ ...validOrderBody, fullName: '' })
      .expect(422);

    expect(response.body.errors).toContain('Full name is required.');
  });
});

describe('adminOrderListQueryValidationRules', () => {
  test('rejects invalid status filter', async () => {
    const app = require('express')();
    app.get('/validate', adminOrderListQueryValidationRules, (req, res, next) => {
      const { validationResult } = require('express-validator');
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }
      return res.json({ ok: true });
    });

    const response = await request(app).get('/validate').query({ status: 'invalid-status' }).expect(422);
    expect(response.body.errors).toContain('Invalid order status.');
  });
});
