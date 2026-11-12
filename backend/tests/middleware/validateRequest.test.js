// Require the 'express' module as express.
const express = require('express');
// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { body, validationResult } = require('express-validator');
// Require the '../../src/middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../src/middleware/validateRequest');

// Define the createValidationApp function.
function createValidationApp(useChatValidator = false) {
  // Create the app constant.
  const app = express();
  // Call app.use to perform this step.
  app.use(express.json());
  // Call app.post to perform this step.
  app.post(
    // Supply the literal value used by the enclosing expression.
    '/test',
    // Call body to perform this step.
    body('email').isEmail().withMessage('Please enter a valid email address'),
    // Contribute this line to the enclosing declaration or statement.
    useChatValidator ? validateRequest.validateChatRequest : validateRequest,
    // Continue the surrounding logic with this statement.
    (req, res) => res.json({ ok: true, email: req.body.email })
  );
  // Return the resulting value to the caller.
  return app;
}

// Declare a test suite grouping related cases.
describe('validateRequest', () => {
  // Define a single test case and its expectations.
  test('returns standard 422 envelope for invalid input', async () => {
    // Create the app constant.
    const app = createValidationApp(false);

    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/test')
      // Call .send to perform this step.
      .send({ email: 'not-an-email' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'VALIDATION_ERROR',
        // Provide the message field value.
        message: 'Please enter a valid email address',
      },
    });
  });

  // Define a single test case and its expectations.
  test('passes through when validation succeeds', async () => {
    // Create the app constant.
    const app = createValidationApp(false);

    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/test')
      // Call .send to perform this step.
      .send({ email: 'user@example.com' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({ ok: true, email: 'user@example.com' });
  });
});

// Declare a test suite grouping related cases.
describe('validateChatRequest', () => {
  // Define a single test case and its expectations.
  test('returns chat 400 envelope with details array', async () => {
    // Create the app constant.
    const app = express();
    // Call app.use to perform this step.
    app.use((req, _res, next) => {
      // Update req.correlationId with the right-hand side value.
      req.correlationId = 'corr-test-123';
      // Call next to perform this step.
      next();
    });
    // Call app.use to perform this step.
    app.use(express.json());
    // Call app.post to perform this step.
    app.post(
      // Supply the literal value used by the enclosing expression.
      '/chat-test',
      // Call body to perform this step.
      body('fuelType').isIn(['Petrol', 'Diesel']).withMessage('Invalid fuel type.'),
      // Contribute this line to the enclosing declaration or statement.
      validateRequest.validateChatRequest,
      // Continue the surrounding logic with this statement.
      (_req, res) => res.json({ ok: true })
    );

    // Create the response constant.
    const response = await request(app)
      // Call .post to perform this step.
      .post('/chat-test')
      // Call .send to perform this step.
      .send({ fuelType: 'invalid' })
      // Call .expect to perform this step.
      .expect(400);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(response.body.error).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the code field value.
        code: 'VALIDATION_ERROR',
        // Provide the message field value.
        message: 'Invalid fuel type.',
        // Provide the correlation id field value.
        correlationId: 'corr-test-123',
        // Provide the details field value.
        details: expect.arrayContaining([
          // Call expect.objectContaining to perform this step.
          expect.objectContaining({ msg: 'Invalid fuel type.' }),
        ]),
      })
    );
  });
});
