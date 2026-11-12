// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createValidatorApp } = require('../helpers/validatorTestUtils');
// Destructure object properties into local variables.
const { carListQueryValidationRules } = require('../../src/validators/carListQueryValidationRules');
// Destructure object properties into local variables.
const { searchQueryValidationRules } = require('../../src/validators/searchQueryValidationRules');
// Destructure object properties into local variables.
const { createCarValidationRules } = require('../../src/validators/carValidationRules');

// Declare a test suite grouping related cases.
describe('carListQueryValidationRules', () => {
  // Define a single test case and its expectations.
  test('rejects invalid fuel type', async () => {
    // Require the 'express' module as app.
    const app = require('express')();
    // Call app.get to perform this step.
    app.get('/validate', carListQueryValidationRules, (req, res) => {
      // Destructure object properties into local variables.
      const { validationResult } = require('express-validator');
      // Create the errors constant.
      const errors = validationResult(req);
      // Evaluate the condition and enter the branch when it is true.
      if (!errors.isEmpty()) {
        // Return the resulting value to the caller.
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }
      // Return the resulting value to the caller.
      return res.json({ ok: true });
    });

    // Create the response constant.
    const response = await request(app).get('/validate').query({ fuelType: 'invalid' }).expect(422);
    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain('Invalid fuel type.');
  });
});

// Declare a test suite grouping related cases.
describe('searchQueryValidationRules', () => {
  // Define a single test case and its expectations.
  test('requires pickup date', async () => {
    // Require the 'express' module as app.
    const app = require('express')();
    // Call app.get to perform this step.
    app.get('/validate', searchQueryValidationRules, (req, res) => {
      // Destructure object properties into local variables.
      const { validationResult } = require('express-validator');
      // Create the errors constant.
      const errors = validationResult(req);
      // Evaluate the condition and enter the branch when it is true.
      if (!errors.isEmpty()) {
        // Return the resulting value to the caller.
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
      }
      // Return the resulting value to the caller.
      return res.json({ ok: true });
    });

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/validate')
      // Call .query to perform this step.
      .query({ returnDate: '2026-08-05', pickupLocation: 'office', returnLocation: 'office' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain('Please choose a pick-up date.');
  });
});

// Declare a test suite grouping related cases.
describe('createCarValidationRules', () => {
  // Create the app constant.
  const app = createValidatorApp(createCarValidationRules);

  // Define a single test case and its expectations.
  test('rejects car payload without image', async () => {
    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({
        // Provide the name field value.
        name: 'Toyota Yaris',
        // Provide the transmission field value.
        transmission: 'Automatic',
        // Provide the seats field value.
        seats: 5,
        // Provide the fuel type field value.
        fuelType: 'Petrol',
        // Provide the price tier 1 3 field value.
        priceTier_1_3: 45,
      })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.errors[0]).toMatch(/image is required/i);
  });
});
