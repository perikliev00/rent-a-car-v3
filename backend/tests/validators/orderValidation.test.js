// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createValidatorApp } = require('../helpers/validatorTestUtils');
// Destructure object properties into local variables.
const { orderBodyValidationRules } = require('../../src/validators/orderBodyValidationRules');
// Destructure object properties into local variables.
const { adminOrderBodyValidationRules } = require('../../src/validators/adminOrderBodyValidationRules');
// Destructure object properties into local variables.
const { adminOrderListQueryValidationRules } = require('../../src/validators/adminOrderListQueryValidationRules');

// Create the valid order body constant.
const validOrderBody = {
  // Provide the car id field value.
  carId: 1,
  // Provide the pickup date field value.
  pickupDate: '2026-08-01',
  // Provide the return date field value.
  returnDate: '2026-08-05',
  // Provide the pickup time field value.
  pickupTime: '10:00',
  // Provide the return time field value.
  returnTime: '10:00',
  // Provide the pickup location field value.
  pickupLocation: 'office',
  // Provide the return location field value.
  returnLocation: 'office',
  // Provide the full name field value.
  fullName: 'Jane Doe',
  // Provide the phone number field value.
  phoneNumber: '+359888123456',
  // Provide the email field value.
  email: 'jane@example.com',
  // Provide the address field value.
  address: 'Main St 1',
};

// Declare a test suite grouping related cases.
describe('orderBodyValidationRules', () => {
  // Create the app constant.
  const app = createValidatorApp(orderBodyValidationRules);

  // Define a single test case and its expectations.
  test('accepts valid order body', async () => {
    // Wait until the asynchronous operation resolves.
    await request(app).post('/validate').send(validOrderBody).expect(200);
  });

  // Define a single test case and its expectations.
  test('rejects invalid pickup location', async () => {
    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({ ...validOrderBody, pickupLocation: 'invalid' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain('Invalid pickup location.');
  });
});

// Declare a test suite grouping related cases.
describe('adminOrderBodyValidationRules', () => {
  // Create the app constant.
  const app = createValidatorApp(adminOrderBodyValidationRules);

  // Define a single test case and its expectations.
  test('accepts valid admin order body', async () => {
    // Wait until the asynchronous operation resolves.
    await request(app).post('/validate').send(validOrderBody).expect(200);
  });

  // Define a single test case and its expectations.
  test('rejects missing full name', async () => {
    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({ ...validOrderBody, fullName: '' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain('Full name is required.');
  });
});

// Declare a test suite grouping related cases.
describe('adminOrderListQueryValidationRules', () => {
  // Define a single test case and its expectations.
  test('rejects invalid status filter', async () => {
    // Require the 'express' module as app.
    const app = require('express')();
    // Call app.get to perform this step.
    app.get('/validate', adminOrderListQueryValidationRules, (req, res, next) => {
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
    const response = await request(app).get('/validate').query({ status: 'invalid-status' }).expect(422);
    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain('Invalid order status.');
  });
});
