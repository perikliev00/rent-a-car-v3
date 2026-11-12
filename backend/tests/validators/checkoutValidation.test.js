// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createValidatorApp } = require('../helpers/validatorTestUtils');
// Destructure object properties into local variables.
const { checkoutBodyValidationRules } = require('../../src/validators/checkoutBodyValidationRules');
// Destructure object properties into local variables.
const { checkoutSuccessQueryValidationRules } = require('../../src/validators/checkoutSuccessQueryValidationRules');
// Destructure object properties into local variables.
const { reholdBodyValidationRules } = require('../../src/validators/reholdBodyValidationRules');

// Declare a test suite grouping related cases.
describe('checkoutBodyValidationRules', () => {
  // Create the app constant.
  const app = createValidatorApp(checkoutBodyValidationRules);

  // Define a single test case and its expectations.
  test('accepts valid checkout contact fields', async () => {
    // Wait until the asynchronous operation resolves.
    await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({
        // Provide the full name field value.
        fullName: 'Jane Doe',
        // Provide the phone number field value.
        phoneNumber: '+359888123456',
        // Provide the email field value.
        email: 'jane@example.com',
        // Provide the address field value.
        address: 'Main St 1',
      })
      // Call .expect to perform this step.
      .expect(200);
  });

  // Define a single test case and its expectations.
  test('rejects missing full name', async () => {
    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({ phoneNumber: '+359888123456', email: 'jane@example.com', address: 'Main St' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain('Please enter your full name');
  });
});

// Declare a test suite grouping related cases.
describe('checkoutSuccessQueryValidationRules', () => {
  // Define a single test case and its expectations.
  test('requires session_id query param', async () => {
    // Destructure object properties into local variables.
    const { runValidationRules } = require('../helpers/validatorTestUtils');
    // Create the result constant.
    const result = await runValidationRules(checkoutSuccessQueryValidationRules, { query: {} });

    // Assert that the value matches the intended expectation.
    expect(result.isEmpty()).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.array()[0].msg).toBe('Checkout session id is required.');
  });
});

// Declare a test suite grouping related cases.
describe('reholdBodyValidationRules', () => {
  // Create the app constant.
  const app = createValidatorApp(reholdBodyValidationRules);

  // Define a single test case and its expectations.
  test('accepts valid rehold body', async () => {
    // Wait until the asynchronous operation resolves.
    await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({
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
      })
      // Call .expect to perform this step.
      .expect(200);
  });

  // Define a single test case and its expectations.
  test('rejects invalid car id', async () => {
    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({ carId: 0, pickupDate: '2026-08-01', returnDate: '2026-08-05' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain('Invalid car id.');
  });
});
