const bcrypt = require('bcrypt');
const { PassThrough } = require('stream');
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

jest.mock('../../src/middleware/rateLimit', () =>
  require('../helpers/rateLimitPassthrough')()
);

jest.mock('../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  createUser: jest.fn(),
  markEmailVerified: jest.fn(),
}));

jest.mock('../../src/services/auth/emailVerificationService', () => {
  const actual = jest.requireActual('../../src/services/auth/emailVerificationService');
  return {
    OUTCOMES: actual.OUTCOMES,
    issueAndSendVerification: jest.fn().mockResolvedValue({ sent: true }),
    verifyToken: jest.fn(),
    resendVerification: jest.fn().mockResolvedValue({ status: 'sent' }),
  };
});

jest.mock('../../src/services/account/reservationClaimService', () => {
  const actual = jest.requireActual('../../src/services/account/reservationClaimService');
  return {
    OUTCOMES: actual.OUTCOMES,
    claimReservation: jest.fn(),
    requestClaimToken: jest.fn().mockResolvedValue({ status: 'ignored' }),
  };
});

jest.mock('../../src/services/account/accountReservationService', () => ({
  getDashboard: jest.fn(),
  listReservations: jest.fn(),
  getReservationDetail: jest.fn(),
  updateTravel: jest.fn(),
  requestCancellation: jest.fn(),
  getReservationForPdf: jest.fn(),
}));

jest.mock('../../src/services/account/accountDocumentService', () => ({
  listDocuments: jest.fn(),
  uploadDocument: jest.fn(),
  deleteDocument: jest.fn(),
  openDocumentDownload: jest.fn(),
}));

jest.mock('../../src/services/pdf/pdfDocumentService', () => ({
  generatePdf: jest.fn(),
}));

jest.mock('../../src/services/rbac/rbacService', () => {
  const actual = jest.requireActual('../../src/services/rbac/rbacService');
  return {
    ...actual,
    getUserAccess: jest.fn().mockResolvedValue({
      roles: [],
      permissions: [],
      roleDetails: [],
    }),
  };
});

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userSql = require('../../src/services/sql/userSqlService');
const loginAttemptService = require('../../src/services/auth/loginAttemptService');
const reservationSql = require('../../src/services/sql/reservationSqlService');
const reservationClaimService = require('../../src/services/account/reservationClaimService');
const accountReservationService = require('../../src/services/account/accountReservationService');
const accountDocumentService = require('../../src/services/account/accountDocumentService');
const { generatePdf } = require('../../src/services/pdf/pdfDocumentService');

const { OUTCOMES } = reservationClaimService;
const VALID_TOKEN = 'b'.repeat(64);

const mockUser = {
  id: 7,
  email: 'demo@luxride.local',
  password: 'hashed',
  role: 'user',
  emailVerified: true,
};

async function loginAgent({ user = mockUser } = {}) {
  const app = createApiTestApp();
  const agent = await initTestAgent(app);
  userSql.findUserByEmail.mockResolvedValue(user);
  userSql.findUserById.mockResolvedValue(user);
  bcrypt.compare.mockResolvedValue(true);
  loginAttemptService.resetForTests?.();

  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({ email: user.email, password: 'Demo123!' })
    .expect(200);

  agent.csrfToken = loginRes.body.data?.csrfToken || agent.csrfToken;
  return agent;
}

describe('Customer account API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/account/dashboard requires auth', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);
    const response = await agent.get('/api/account/dashboard').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  test('login does not claim any reservation or order', async () => {
    await loginAgent();

    // The dangerous email-based auto-claim is gone: no ownership primitive is reachable
    // from the login path at all.
    expect(reservationSql.claimByEmail).toBeUndefined();
    expect(reservationClaimService.claimReservation).not.toHaveBeenCalled();
  });

  test('GET /api/account/dashboard returns summary for logged-in user', async () => {
    accountReservationService.getDashboard.mockResolvedValue({
      counts: { total: 1, active: 1, completed: 0 },
      upcoming: null,
      recent: [],
    });
    const agent = await loginAgent();
    const response = await agent.get('/api/account/dashboard').expect(200);
    expect(response.body.data.counts.total).toBe(1);
    expect(accountReservationService.getDashboard).toHaveBeenCalledWith(7);
  });

  test('GET /api/account/reservations/:id returns 404 for other users', async () => {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    accountReservationService.getReservationDetail.mockRejectedValue(err);

    const agent = await loginAgent();
    const response = await agent.get('/api/account/reservations/99').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('POST cancel-request creates pending request for confirmed booking', async () => {
    accountReservationService.requestCancellation.mockResolvedValue({
      immediate: false,
      reservation: { id: '10', status: 'confirmed' },
      cancellationRequest: { id: 1, status: 'pending' },
    });
    const agent = await loginAgent();
    const response = await withCsrf(
      agent,
      agent.post('/api/account/reservations/10/cancel-request')
    )
      .send({ reason: 'Plans changed' })
      .expect(200);

    expect(response.body.data.immediate).toBe(false);
    expect(response.body.data.cancellationRequest.status).toBe('pending');
  });

  test('GET pdf streams application/pdf', async () => {
    accountReservationService.getReservationForPdf.mockResolvedValue({
      id: '10',
      status: 'confirmed',
      totalPrice: 100,
    });
    generatePdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 test'),
      filename: 'luxride-invoice-10.pdf',
      contentType: 'application/pdf',
    });

    const agent = await loginAgent();
    const response = await agent.get('/api/account/reservations/10/pdf/invoice').expect(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/);
    expect(response.text || response.body.toString()).toContain('%PDF');
  });

  test('document download returns 404 for unauthorized access', async () => {
    const err = new Error('Document not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    accountDocumentService.openDocumentDownload.mockRejectedValue(err);

    const agent = await loginAgent();
    const response = await agent.get('/api/account/documents/5/download').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('GET /api/account/reservations lists reservations for user', async () => {
    accountReservationService.listReservations.mockResolvedValue([
      { id: '10', status: 'confirmed', totalPrice: 100 },
    ]);

    const agent = await loginAgent();
    const response = await agent.get('/api/account/reservations').expect(200);

    expect(response.body.data.reservations).toHaveLength(1);
    expect(accountReservationService.listReservations).toHaveBeenCalledWith(7);
  });

  test('PATCH travel details updates reservation', async () => {
    accountReservationService.updateTravel.mockResolvedValue({
      id: '10',
      flightNumber: 'FR123',
      hotelName: 'Hotel X',
    });

    const agent = await loginAgent();
    const response = await withCsrf(agent, agent.patch('/api/account/reservations/10/travel'))
      .send({ flightNumber: 'FR123', hotelName: 'Hotel X' })
      .expect(200);

    expect(response.body.data.reservation.flightNumber).toBe('FR123');
    expect(accountReservationService.updateTravel).toHaveBeenCalledWith(
      7,
      '10',
      expect.objectContaining({ flightNumber: 'FR123', hotelName: 'Hotel X' })
    );
  });

  test('GET /api/account/documents lists uploaded documents', async () => {
    accountDocumentService.listDocuments.mockResolvedValue([
      {
        id: 1,
        docType: 'driver_license',
        originalFilename: 'license.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        reservationId: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ]);

    const agent = await loginAgent();
    const response = await agent.get('/api/account/documents').expect(200);

    expect(response.body.data.documents).toHaveLength(1);
    expect(accountDocumentService.listDocuments).toHaveBeenCalledWith(7);
  });

  test('DELETE /api/account/documents/:id deletes document', async () => {
    accountDocumentService.deleteDocument.mockResolvedValue({
      id: 5,
      docType: 'other',
      originalFilename: 'gone.pdf',
    });

    const agent = await loginAgent();
    const response = await withCsrf(agent, agent.delete('/api/account/documents/5')).expect(200);

    expect(response.body.data.document.id).toBe(5);
    expect(accountDocumentService.deleteDocument).toHaveBeenCalledWith(7, '5');
  });
});

describe('Unverified accounts are fail-closed on the account portal', () => {
  const unverifiedUser = { ...mockUser, emailVerified: false };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['dashboard', '/api/account/dashboard'],
    ['booking history', '/api/account/reservations'],
    ['reservation details', '/api/account/reservations/10'],
    ['invoice PDF', '/api/account/reservations/10/pdf/invoice'],
    ['documents', '/api/account/documents'],
    ['document download', '/api/account/documents/5/download'],
  ])('%s is refused for an unverified session', async (_label, path) => {
    const agent = await loginAgent({ user: unverifiedUser });

    const response = await agent.get(path).expect(403);

    expect(response.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');
  });

  test('no account service is reached for an unverified session', async () => {
    const agent = await loginAgent({ user: unverifiedUser });

    await agent.get('/api/account/reservations/10').expect(403);

    expect(accountReservationService.getReservationDetail).not.toHaveBeenCalled();
  });

  test('an unverified session cannot claim a booking', async () => {
    const agent = await loginAgent({ user: unverifiedUser });

    const response = await withCsrf(
      agent,
      agent.post('/api/account/reservations/10/claim')
    )
      .send({ token: VALID_TOKEN })
      .expect(403);

    expect(response.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(reservationClaimService.claimReservation).not.toHaveBeenCalled();
  });
});

describe('POST /api/account/reservations/:id/claim', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('links the booking for a valid token', async () => {
    reservationClaimService.claimReservation.mockResolvedValue({
      outcome: OUTCOMES.CLAIMED,
      reservationId: 10,
    });
    const agent = await loginAgent();

    const response = await withCsrf(agent, agent.post('/api/account/reservations/10/claim'))
      .send({ token: VALID_TOKEN })
      .expect(200);

    expect(response.body.data).toEqual({
      reservationId: '10',
      claimed: true,
      alreadyOwned: false,
    });
  });

  test('is idempotent for the existing owner', async () => {
    reservationClaimService.claimReservation.mockResolvedValue({
      outcome: OUTCOMES.ALREADY_OWNED,
      reservationId: 10,
    });
    const agent = await loginAgent();

    const response = await withCsrf(agent, agent.post('/api/account/reservations/10/claim'))
      .send({ token: VALID_TOKEN })
      .expect(200);

    expect(response.body.data.alreadyOwned).toBe(true);
  });

  test('returns 409 when another account already owns the booking', async () => {
    reservationClaimService.claimReservation.mockResolvedValue({ outcome: OUTCOMES.CONFLICT });
    const agent = await loginAgent();

    const response = await withCsrf(agent, agent.post('/api/account/reservations/10/claim'))
      .send({ token: VALID_TOKEN })
      .expect(409);

    expect(response.body.error.code).toBe('CLAIM_CONFLICT');
  });

  test.each([
    ['invalid token', OUTCOMES.INVALID_TOKEN],
    ['expired token', OUTCOMES.EXPIRED],
    ['email mismatch', OUTCOMES.EMAIL_MISMATCH],
  ])('returns an indistinguishable error for %s', async (_label, outcome) => {
    reservationClaimService.claimReservation.mockResolvedValue({ outcome });
    const agent = await loginAgent();

    const response = await withCsrf(agent, agent.post('/api/account/reservations/10/claim'))
      .send({ token: VALID_TOKEN })
      .expect(400);

    expect(response.body.error.code).toBe('CLAIM_TOKEN_INVALID');
  });

  test('rejects a malformed token before touching the service', async () => {
    const agent = await loginAgent();

    const response = await withCsrf(agent, agent.post('/api/account/reservations/10/claim'))
      .send({ token: 'nope' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(reservationClaimService.claimReservation).not.toHaveBeenCalled();
  });

  test('requires a CSRF token', async () => {
    const agent = await loginAgent();

    const response = await agent
      .post('/api/account/reservations/10/claim')
      .send({ token: VALID_TOKEN })
      .expect(403);

    expect(response.body.error.code).toBe('CSRF_INVALID');
    expect(reservationClaimService.claimReservation).not.toHaveBeenCalled();
  });
});

describe('POST /api/account/reservations/claim-request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reservationClaimService.requestClaimToken.mockResolvedValue({ status: 'ignored' });
  });

  test('returns the same response whether or not a link was sent', async () => {
    const agent = await loginAgent();

    const ignored = await withCsrf(
      agent,
      agent.post('/api/account/reservations/claim-request')
    )
      .send({ reservationId: 10, bookingEmail: 'demo@luxride.local' })
      .expect(200);

    reservationClaimService.requestClaimToken.mockResolvedValue({ status: 'sent' });
    const sent = await withCsrf(agent, agent.post('/api/account/reservations/claim-request'))
      .send({ reservationId: 11, bookingEmail: 'demo@luxride.local' })
      .expect(200);

    expect(ignored.body).toEqual(sent.body);
    expect(sent.body.data).toEqual({ requested: true });
  });
});
