const request = require('supertest');
const { createValidatorApp } = require('../helpers/validatorTestUtils');
const { authLoginValidationRules } = require('../../src/validators/authLoginValidationRules');
const { authSignupValidationRules } = require('../../src/validators/authSignupValidationRules');

describe('authLoginValidationRules', () => {
  const app = createValidatorApp(authLoginValidationRules);

  test('accepts valid login payload', async () => {
    const response = await request(app)
      .post('/validate')
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);

    expect(response.body.ok).toBe(true);
  });

  test.each([
    [{ email: 'bad', password: 'Secret123' }, 'Please enter a valid email address'],
    [{ email: 'user@example.com', password: '' }, 'Password is required'],
  ])('rejects invalid login payload %j', async (payload, message) => {
    const response = await request(app).post('/validate').send(payload).expect(422);
    expect(response.body.errors).toContain(message);
  });
});

describe('authSignupValidationRules', () => {
  const app = createValidatorApp(authSignupValidationRules);

  test('accepts valid signup payload', async () => {
    await request(app)
      .post('/validate')
      .send({ email: 'new@example.com', password: 'Secret123' })
      .expect(200);
  });

  test('rejects weak password', async () => {
    const response = await request(app)
      .post('/validate')
      .send({ email: 'new@example.com', password: 'short' })
      .expect(422);

    expect(response.body.errors[0]).toMatch(/password/i);
  });
});
