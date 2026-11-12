// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createValidatorApp } = require('../helpers/validatorTestUtils');
// Destructure object properties into local variables.
const { adminCarAvailabilityQueryValidationRules } = require('../../src/validators/adminCarAvailabilityQueryValidationRules');
// Destructure object properties into local variables.
const { adminContactStatusValidation } = require('../../src/validators/adminContactStatusValidation');
// Destructure object properties into local variables.
const { adminContactIdParamValidation } = require('../../src/validators/adminContactIdParamValidation');
// Destructure object properties into local variables.
const { adminOrderIdParamValidation } = require('../../src/validators/adminOrderIdParamValidation');
// Destructure object properties into local variables.
const { adminCarIdParamValidation } = require('../../src/validators/adminCarIdParamValidation');
// Destructure object properties into local variables.
const { carIdParamValidation } = require('../../src/validators/carIdParamValidation');

// Declare a test suite grouping related cases.
describe('adminCarAvailabilityQueryValidationRules', () => {
  // Define a single test case and its expectations.
  test('requires pickup date', async () => {
    // Require the 'express' module as app.
    const app = require('express')();
    // Call app.get to perform this step.
    app.get('/validate', adminCarAvailabilityQueryValidationRules, (req, res) => {
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
      .query({ returnDate: '2026-08-05' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain('Pick-up date is required.');
  });
});

// Declare a test suite grouping related cases.
describe('adminContactStatusValidation', () => {
  // Create the app constant.
  const app = createValidatorApp(adminContactStatusValidation);

  // Define a single test case and its expectations.
  test('rejects invalid status', async () => {
    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({ status: 'invalid' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.errors[0]).toMatch(/status/i);
  });
});

// Declare a test suite grouping related cases.
describe('param validation rules', () => {
  // Call test.each to perform this step.
  test.each([
    // Contribute this line to the enclosing declaration or statement.
    ['adminOrderIdParamValidation', adminOrderIdParamValidation, 'id', '0', 'Invalid order id.'],
    // Contribute this line to the enclosing declaration or statement.
    ['adminCarIdParamValidation', adminCarIdParamValidation, 'id', '0', 'Invalid car id.'],
    // Contribute this line to the enclosing declaration or statement.
    ['carIdParamValidation', carIdParamValidation, 'carId', '0', 'Invalid car id.'],
    // Contribute this line to the enclosing declaration or statement.
    ['adminContactIdParamValidation', adminContactIdParamValidation, 'id', '0', 'Invalid contact id.'],
  // Continue the surrounding logic with this statement.
  ])('%s rejects invalid %s', async (_name, rules, paramName, value, message) => {
    // Require the 'express' module as app.
    const app = require('express')();
    // Call app.get to perform this step.
    app.get(`/validate/:${paramName}`, rules, (req, res) => {
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
    const response = await request(app).get(`/validate/${value}`).expect(422);
    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain(message);
  });
});
