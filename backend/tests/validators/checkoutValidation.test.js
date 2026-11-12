const request = require('supertest');
const { createValidatorApp } = require('../helpers/validatorTestUtils');
const { checkoutBodyValidationRules } = require('../../src/validators/checkoutBodyValidationRules');
const { checkoutSuccessQueryValidationRules } = require('../../src/validators/checkoutSuccessQueryValidationRules');
const { reholdBodyValidationRules } = require('../../src/validators/reholdBodyValidationRules');

describe('checkoutBodyValidationRules', () => {
  const app = createValidatorApp(checkoutBodyValidationRules);

  test('accepts valid checkout contact fields', async () => {
    await request(app)
      .post('/validate')
      .send({
        fullName: 'Jane Doe',
        phoneNumber: '+359888123456',
        email: 'jane@example.com',
        address: 'Main St 1',
      })
      .expect(200);
  });

  test('rejects missing full name', async () => {
    const response = await request(app)
      .post('/validate')
      .send({ phoneNumber: '+359888123456', email: 'jane@example.com', address: 'Main St' })
      .expect(422);

    expect(response.body.errors).toContain('Please enter your full name');
  });
});

describe('checkoutSuccessQueryValidationRules', () => {
  test('requires session_id query param', async () => {
    const { runValidationRules } = require('../helpers/validatorTestUtils');
    const result = await runValidationRules(checkoutSuccessQueryValidationRules, { query: {} });

    expect(result.isEmpty()).toBe(false);
    expect(result.array()[0].msg).toBe('Checkout session id is required.');
  });
});

describe('reholdBodyValidationRules', () => {
  const app = createValidatorApp(reholdBodyValidationRules);

  test('accepts valid rehold body', async () => {
    await request(app)
      .post('/validate')
      .send({
        carId: 1,
        pickupDate: '2026-08-01',
        returnDate: '2026-08-05',
        pickupTime: '10:00',
        returnTime: '10:00',
        pickupLocation: 'office',
        returnLocation: 'office',
      })
      .expect(200);
  });

  test('rejects invalid car id', async () => {
    const response = await request(app)
      .post('/validate')
      .send({ carId: 0, pickupDate: '2026-08-01', returnDate: '2026-08-05' })
      .expect(422);

    expect(response.body.errors).toContain('Invalid car id.');
  });
});
