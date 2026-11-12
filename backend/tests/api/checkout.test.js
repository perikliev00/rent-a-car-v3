const request = require('supertest');
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');
const { futureSofiaDate } = require('../helpers/bookingDates');

jest.mock('../../src/services/payment/checkout/checkoutSessionService', () => ({
  createCheckoutSessionFlow: jest.fn(),
}));
jest.mock('../../src/services/payment/successService', () => ({
  handleCheckoutSuccessFlow: jest.fn(),
}));
jest.mock('../../src/services/reservationService', () => ({
  releaseActiveReservationForSession: jest.fn().mockResolvedValue({ cancelled: true }),
}));

const { createCheckoutSessionFlow } = require('../../src/services/payment/checkout/checkoutSessionService');
const { handleCheckoutSuccessFlow } = require('../../src/services/payment/successService');

const validCheckoutBody = {
  carId: 1,
  pickupDate: futureSofiaDate(7),
  returnDate: futureSofiaDate(10),
  pickupTime: '10:00',
  returnTime: '10:00',
  pickupLocation: 'office',
  returnLocation: 'office',
  fullName: 'Jane Doe',
  phoneNumber: '+359888123456',
  email: 'jane@example.com',
  address: 'Main St 1',
  hotelName: 'Hotel Test',
};

describe('POST /api/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns checkout URL on success', async () => {
    createCheckoutSessionFlow.mockResolvedValue({
      type: 'redirect',
      url: 'https://checkout.stripe.com/test',
      statusCode: 303,
    });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/checkout')).send(validCheckoutBody).expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { checkoutUrl: 'https://checkout.stripe.com/test' },
    });
  });

  test('accepts checkout without hotelName', async () => {
    createCheckoutSessionFlow.mockResolvedValue({
      type: 'redirect',
      url: 'https://checkout.stripe.com/test',
      statusCode: 303,
    });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);
    const bodyWithoutHotel = { ...validCheckoutBody };
    delete bodyWithoutHotel.hotelName;

    const response = await withCsrf(agent, agent.post('/api/checkout')).send(bodyWithoutHotel).expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { checkoutUrl: 'https://checkout.stripe.com/test' },
    });
  });

  test('returns checkout error envelope', async () => {
    createCheckoutSessionFlow.mockResolvedValue({
      type: 'renderOrderPage',
      message: 'Unable to start payment.',
    });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/checkout')).send(validCheckoutBody).expect(422);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'CHECKOUT_ERROR',
        message: 'Unable to start payment.',
      },
    });
  });
});

describe('GET /api/checkout/success', () => {
  test('returns success payload', async () => {
    handleCheckoutSuccessFlow.mockResolvedValue({
      confirmed: true,
      bookingStatus: 'confirmed',
      orderReference: '#1',
    });
    const app = createApiTestApp();

    const response = await request(app)
      .get('/api/checkout/success')
      .query({ session_id: 'cs_test_123' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.confirmed).toBe(true);
  });

  test('returns validation error when session_id is missing', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/checkout/success').expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Checkout session id is required.');
  });

  test('returns validation error for invalid session id', async () => {
    const app = createApiTestApp();

    const response = await request(app)
      .get('/api/checkout/success')
      .query({ session_id: 'invalid' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns error when success flow fails', async () => {
    const { ValidationError } = require('../../src/utils/appError');
    handleCheckoutSuccessFlow.mockRejectedValue(new ValidationError('Payment was not completed.'));
    const app = createApiTestApp();

    const response = await request(app)
      .get('/api/checkout/success')
      .query({ session_id: 'cs_test_abc123' })
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Payment was not completed.');
  });
});

describe('POST /api/checkout/cancel', () => {
  const { releaseActiveReservationForSession } = require('../../src/services/reservationService');

  test('returns cancel payload', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/checkout/cancel')).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.cancelled).toBe(true);
  });

  test('returns cancel payload even when no active reservation exists', async () => {
    releaseActiveReservationForSession.mockResolvedValue({ cancelled: false });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/checkout/cancel')).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.cancelled).toBe(false);
    expect(response.body.data.message).toContain('No active reservation hold to cancel');
  });
});
