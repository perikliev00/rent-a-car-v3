const request = require('supertest');
const { createValidatorApp } = require('../helpers/validatorTestUtils');
const { adminCarAvailabilityQueryValidationRules } = require('../../src/validators/adminCarAvailabilityQueryValidationRules');
const { adminContactStatusValidation } = require('../../src/validators/adminContactStatusValidation');
const { adminContactIdParamValidation } = require('../../src/validators/adminContactIdParamValidation');
const { adminOrderIdParamValidation } = require('../../src/validators/adminOrderIdParamValidation');
const { adminCarIdParamValidation } = require('../../src/validators/adminCarIdParamValidation');
const { carIdParamValidation } = require('../../src/validators/carIdParamValidation');

describe('adminCarAvailabilityQueryValidationRules', () => {
  test('requires pickup date', async () => {
    const app = require('express')();
    app.get('/validate', adminCarAvailabilityQueryValidationRules, (req, res) => {
      const { validationResult } = require('express-validator');
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }
      return res.json({ ok: true });
    });

    const response = await request(app)
      .get('/validate')
      .query({ returnDate: '2026-08-05' })
      .expect(422);

    expect(response.body.errors).toContain('Pick-up date is required.');
  });
});

describe('adminContactStatusValidation', () => {
  const app = createValidatorApp(adminContactStatusValidation);

  test('rejects invalid status', async () => {
    const response = await request(app)
      .post('/validate')
      .send({ status: 'invalid' })
      .expect(422);

    expect(response.body.errors[0]).toMatch(/status/i);
  });
});

describe('param validation rules', () => {
  test.each([
    ['adminOrderIdParamValidation', adminOrderIdParamValidation, 'id', '0', 'Invalid order id.'],
    ['adminCarIdParamValidation', adminCarIdParamValidation, 'id', '0', 'Invalid car id.'],
    ['carIdParamValidation', carIdParamValidation, 'carId', '0', 'Invalid car id.'],
    ['adminContactIdParamValidation', adminContactIdParamValidation, 'id', '0', 'Invalid contact id.'],
  ])('%s rejects invalid %s', async (_name, rules, paramName, value, message) => {
    const app = require('express')();
    app.get(`/validate/:${paramName}`, rules, (req, res) => {
      const { validationResult } = require('express-validator');
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }
      return res.json({ ok: true });
    });

    const response = await request(app).get(`/validate/${value}`).expect(422);
    expect(response.body.errors).toContain(message);
  });
});
