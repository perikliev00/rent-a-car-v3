// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');
// Destructure object properties into local variables.
const { futureSofiaDate } = require('../helpers/bookingDates');

// Call jest.mock to perform this step.
jest.mock('../../src/services/payment/checkout/checkoutSessionService', () => ({
  // Provide the create checkout session flow field value.
  createCheckoutSessionFlow: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/payment/successService', () => ({
  // Provide the handle checkout success flow field value.
  handleCheckoutSuccessFlow: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/reservationService', () => ({
  // Provide the release active reservation for session field value.
  releaseActiveReservationForSession: jest.fn().mockResolvedValue({ cancelled: true }),
}));

// Destructure object properties into local variables.
const { createCheckoutSessionFlow } = require('../../src/services/payment/checkout/checkoutSessionService');
// Destructure object properties into local variables.
const { handleCheckoutSuccessFlow } = require('../../src/services/payment/successService');

// Create the valid checkout body constant.
const validCheckoutBody = {
  // Provide the car id field value.
  carId: 1,
  // Provide the pickup date field value.
  pickupDate: futureSofiaDate(7),
  // Provide the return date field value.
  returnDate: futureSofiaDate(10),
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
  // Provide the hotel name field value.
  hotelName: 'Hotel Test',
};

// Declare a test suite grouping related cases.
describe('POST /api/checkout', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('returns checkout URL on success', async () => {
    // Call createCheckoutSessionFlow.mockResolvedValue to perform this step.
    createCheckoutSessionFlow.mockResolvedValue({
      // Provide the type field value.
      type: 'redirect',
      // Provide the url field value.
      url: 'https://checkout.stripe.com/test',
      // Provide the status code field value.
      statusCode: 303,
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/checkout')).send(validCheckoutBody).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { checkoutUrl: 'https://checkout.stripe.com/test' },
    });
  });

  // Define a single test case and its expectations.
  test('accepts checkout without hotelName', async () => {
    // Call createCheckoutSessionFlow.mockResolvedValue to perform this step.
    createCheckoutSessionFlow.mockResolvedValue({
      // Provide the type field value.
      type: 'redirect',
      // Provide the url field value.
      url: 'https://checkout.stripe.com/test',
      // Provide the status code field value.
      statusCode: 303,
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);
    // Create the body without hotel constant.
    const bodyWithoutHotel = { ...validCheckoutBody };
    // Delete the specified property from the object.
    delete bodyWithoutHotel.hotelName;

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/checkout')).send(bodyWithoutHotel).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { checkoutUrl: 'https://checkout.stripe.com/test' },
    });
  });

  // Define a single test case and its expectations.
  test('returns checkout error envelope', async () => {
    // Call createCheckoutSessionFlow.mockResolvedValue to perform this step.
    createCheckoutSessionFlow.mockResolvedValue({
      // Provide the type field value.
      type: 'renderOrderPage',
      // Provide the message field value.
      message: 'Unable to start payment.',
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/checkout')).send(validCheckoutBody).expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'CHECKOUT_ERROR',
        // Provide the message field value.
        message: 'Unable to start payment.',
      },
    });
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/checkout/success', () => {
  // Define a single test case and its expectations.
  test('returns success payload', async () => {
    // Call handleCheckoutSuccessFlow.mockResolvedValue to perform this step.
    handleCheckoutSuccessFlow.mockResolvedValue({
      // Provide the confirmed field value.
      confirmed: true,
      // Provide the booking status field value.
      bookingStatus: 'confirmed',
      // Provide the order reference field value.
      orderReference: '#1',
    });
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/checkout/success')
      // Call .query to perform this step.
      .query({ session_id: 'cs_test_123' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.confirmed).toBe(true);
  });

  // Define a single test case and its expectations.
  test('returns validation error when session_id is missing', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/checkout/success').expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(response.body.error.message).toBe('Checkout session id is required.');
  });

  // Define a single test case and its expectations.
  test('returns validation error for invalid session id', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/checkout/success')
      // Call .query to perform this step.
      .query({ session_id: 'invalid' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Define a single test case and its expectations.
  test('returns error when success flow fails', async () => {
    // Destructure object properties into local variables.
    const { ValidationError } = require('../../src/utils/appError');
    // Call handleCheckoutSuccessFlow.mockRejectedValue to perform this step.
    handleCheckoutSuccessFlow.mockRejectedValue(new ValidationError('Payment was not completed.'));
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/checkout/success')
      // Call .query to perform this step.
      .query({ session_id: 'cs_test_abc123' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.message).toBe('Payment was not completed.');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/checkout/cancel', () => {
  // Destructure object properties into local variables.
  const { releaseActiveReservationForSession } = require('../../src/services/reservationService');

  // Define a single test case and its expectations.
  test('returns cancel payload', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/checkout/cancel')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.cancelled).toBe(true);
  });

  // Define a single test case and its expectations.
  test('returns cancel payload even when no active reservation exists', async () => {
    // Call releaseActiveReservationForSession.mockResolvedValue to perform this step.
    releaseActiveReservationForSession.mockResolvedValue({ cancelled: false });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/checkout/cancel')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.cancelled).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.message).toContain('No active reservation hold to cancel');
  });
});
