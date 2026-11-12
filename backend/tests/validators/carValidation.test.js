const request = require('supertest');
const { createValidatorApp } = require('../helpers/validatorTestUtils');
const { carListQueryValidationRules } = require('../../src/validators/carListQueryValidationRules');
const { searchQueryValidationRules } = require('../../src/validators/searchQueryValidationRules');
const { createCarValidationRules } = require('../../src/validators/carValidationRules');

describe('carListQueryValidationRules', () => {
  test('rejects invalid fuel type', async () => {
    const app = require('express')();
    app.get('/validate', carListQueryValidationRules, (req, res) => {
      const { validationResult } = require('express-validator');
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }
      return res.json({ ok: true });
    });

    const response = await request(app).get('/validate').query({ fuelType: 'invalid' }).expect(422);
    expect(response.body.errors).toContain('Invalid fuel type.');
  });
});

describe('searchQueryValidationRules', () => {
  test('requires pickup date', async () => {
    const app = require('express')();
    app.get('/validate', searchQueryValidationRules, (req, res) => {
      const { validationResult } = require('express-validator');
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }
      return res.json({ ok: true });
    });

    const response = await request(app)
      .get('/validate')
      .query({ returnDate: '2026-08-05', pickupLocation: 'office', returnLocation: 'office' })
      .expect(422);

    expect(response.body.errors).toContain('Please choose a pick-up date.');
  });
});

describe('createCarValidationRules', () => {
  const app = createValidatorApp(createCarValidationRules);

  test('rejects car payload without image', async () => {
    const response = await request(app)
      .post('/validate')
      .send({
        name: 'Toyota Yaris',
        transmission: 'Automatic',
        seats: 5,
        fuelType: 'Petrol',
        priceTier_1_3: 45,
      })
      .expect(422);

    expect(response.body.errors[0]).toMatch(/image is required/i);
  });
});
