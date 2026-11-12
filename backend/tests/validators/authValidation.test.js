// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createValidatorApp } = require('../helpers/validatorTestUtils');
// Destructure object properties into local variables.
const { authLoginValidationRules } = require('../../src/validators/authLoginValidationRules');
// Destructure object properties into local variables.
const { authSignupValidationRules } = require('../../src/validators/authSignupValidationRules');

// Declare a test suite grouping related cases.
describe('authLoginValidationRules', () => {
  // Create the app constant.
  const app = createValidatorApp(authLoginValidationRules);

  // Define a single test case and its expectations.
  test('accepts valid login payload', async () => {
    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.ok).toBe(true);
  });

  // Call test.each to perform this step.
  test.each([
    // Contribute this line to the enclosing declaration or statement.
    [{ email: 'bad', password: 'Secret123' }, 'Please enter a valid email address'],
    // Contribute this line to the enclosing declaration or statement.
    [{ email: 'user@example.com', password: '' }, 'Password is required'],
  // Continue the surrounding logic with this statement.
  ])('rejects invalid login payload %j', async (payload, message) => {
    // Create the response constant.
    const response = await request(app).post('/validate').send(payload).expect(422);
    // Assert that the value matches the intended expectation.
    expect(response.body.errors).toContain(message);
  });
});

// Declare a test suite grouping related cases.
describe('authSignupValidationRules', () => {
  // Create the app constant.
  const app = createValidatorApp(authSignupValidationRules);

  // Define a single test case and its expectations.
  test('accepts valid signup payload', async () => {
    // Wait until the asynchronous operation resolves.
    await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({ email: 'new@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);
  });

  // Define a single test case and its expectations.
  test('rejects weak password', async () => {
    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/validate')
      // Call .send to perform this step.
      .send({ email: 'new@example.com', password: 'short' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.errors[0]).toMatch(/password/i);
  });
});
