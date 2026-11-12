// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

// Call jest.mock to perform this step.
jest.mock('../../src/services/reservationService', () => ({
  // Provide the release active reservation for session field value.
  releaseActiveReservationForSession: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../helpers/rateLimitPassthrough')
);

// Require the '../../src/services/reservationService' module as reservationService.
const reservationService = require('../../src/services/reservationService');

// Declare a test suite grouping related cases.
describe('CSRF middleware', () => {
  // Call jest.setTimeout to perform this step.
  jest.setTimeout(60_000);

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call reservationService.releaseActiveReservationForSession.mockResolvedValue to perform this step.
    reservationService.releaseActiveReservationForSession.mockResolvedValue({ cancelled: true });
  });

  // Define a single test case and its expectations.
  test('GET /api/auth/csrf returns token', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = request.agent(app);

    // Create the response constant.
    const response = await agent.get('/api/auth/csrf').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { csrfToken: expect.any(String) },
    });
    // Assert that the value matches the intended expectation.
    expect(response.body.data.csrfToken).toBeTruthy();
  });

  // Define a single test case and its expectations.
  test('rejects mutating request without CSRF token', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = request.agent(app);
    // Wait until the asynchronous operation resolves.
    await agent.get('/api/auth/csrf');

    // Create the response constant.
    const response = await agent.post('/api/reservations/release').expect(403);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  // Define a single test case and its expectations.
  test('rejects mutating request with wrong CSRF token', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await agent
      // Call .post to perform this step.
      .post('/api/reservations/release')
      // Call .set to perform this step.
      .set('X-CSRF-Token', 'wrong-token')
      // Call .expect to perform this step.
      .expect(403);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  // Define a single test case and its expectations.
  test('allows mutating request with valid CSRF token', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/reservations/release')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
  });
});
