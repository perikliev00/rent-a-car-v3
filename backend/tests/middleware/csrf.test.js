const request = require('supertest');
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

jest.mock('../../src/services/reservationService', () => ({
  releaseActiveReservationForSession: jest.fn(),
}));
jest.mock('../../src/middleware/rateLimit', () =>
  require('../helpers/rateLimitPassthrough')
);

const reservationService = require('../../src/services/reservationService');

describe('CSRF middleware', () => {
  jest.setTimeout(60_000);

  beforeEach(() => {
    jest.clearAllMocks();
    reservationService.releaseActiveReservationForSession.mockResolvedValue({ cancelled: true });
  });

  test('GET /api/auth/csrf returns token', async () => {
    const app = createApiTestApp();
    const agent = request.agent(app);

    const response = await agent.get('/api/auth/csrf').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { csrfToken: expect.any(String) },
    });
    expect(response.body.data.csrfToken).toBeTruthy();
  });

  test('rejects mutating request without CSRF token', async () => {
    const app = createApiTestApp();
    const agent = request.agent(app);
    await agent.get('/api/auth/csrf');

    const response = await agent.post('/api/reservations/release').expect(403);

    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  test('rejects mutating request with wrong CSRF token', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await agent
      .post('/api/reservations/release')
      .set('X-CSRF-Token', 'wrong-token')
      .expect(403);

    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  test('allows mutating request with valid CSRF token', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/reservations/release')).expect(200);

    expect(response.body.success).toBe(true);
  });
});
