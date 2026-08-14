const express = require('express');
const request = require('supertest');
const { body, validationResult } = require('express-validator');
const validateRequest = require('../../src/middleware/validateRequest');

function createValidationApp(useChatValidator = false) {
  const app = express();
  app.use(express.json());
  app.post(
    '/test',
    body('email').isEmail().withMessage('Please enter a valid email address'),
    useChatValidator ? validateRequest.validateChatRequest : validateRequest,
    (req, res) => res.json({ ok: true, email: req.body.email })
  );
  return app;
}

describe('validateRequest', () => {
  test('returns standard 422 envelope for invalid input', async () => {
    const app = createValidationApp(false);

    const response = await request(app)
      .post('/test')
      .send({ email: 'not-an-email' })
      .expect(422);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please enter a valid email address',
      },
    });
  });

  test('passes through when validation succeeds', async () => {
    const app = createValidationApp(false);

    const response = await request(app)
      .post('/test')
      .send({ email: 'user@example.com' })
      .expect(200);

    expect(response.body).toEqual({ ok: true, email: 'user@example.com' });
  });
});

describe('validateChatRequest', () => {
  test('returns chat 400 envelope with details array', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.correlationId = 'corr-test-123';
      next();
    });
    app.use(express.json());
    app.post(
      '/chat-test',
      body('fuelType').isIn(['Petrol', 'Diesel']).withMessage('Invalid fuel type.'),
      validateRequest.validateChatRequest,
      (_req, res) => res.json({ ok: true })
    );

    const response = await request(app)
      .post('/chat-test')
      .send({ fuelType: 'invalid' })
      .expect(400);

    expect(response.body.success).toBeUndefined();
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Invalid fuel type.',
        correlationId: 'corr-test-123',
        details: expect.arrayContaining([
          expect.objectContaining({ msg: 'Invalid fuel type.' }),
        ]),
      })
    );
  });
});
