const bcrypt = require('bcrypt');
const { PassThrough } = require('stream');
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

jest.mock('../../src/middleware/rateLimit', () => ({
  authLimiter: (_req, _res, next) => next(),
  loginLimiter: (_req, _res, next) => next(),
  signupLimiter: (_req, _res, next) => next(),
  adminLimiter: (_req, _res, next) => next(),
  adminUploadLimiter: (_req, _res, next) => next(),
  accountUploadLimiter: (_req, _res, next) => next(),
  checkoutLimiter: (_req, _res, next) => next(),
  bookingLimiter: (_req, _res, next) => next(),
  chatLimiter: (_req, _res, next) => next(),
  contactLimiter: (_req, _res, next) => next(),
}));

jest.mock('../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
}));

jest.mock('../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 2, orders: 1 }),
}));

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
const { claimReservationsForUser } = require('../../src/services/account/accountClaimService');
const accountReservationService = require('../../src/services/account/accountReservationService');
const accountDocumentService = require('../../src/services/account/accountDocumentService');
const { generatePdf } = require('../../src/services/pdf/pdfDocumentService');

const mockUser = {
  id: 7,
  email: 'demo@luxride.local',
  password: 'hashed',
  role: 'user',
};

async function loginAgent() {
  const app = createApiTestApp();
  const agent = await initTestAgent(app);
  userSql.findUserByEmail.mockResolvedValue(mockUser);
  bcrypt.compare.mockResolvedValue(true);
  loginAttemptService.resetForTests?.();

  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({ email: mockUser.email, password: 'Demo123!' })
    .expect(200);

  agent.csrfToken = loginRes.body.data?.csrfToken || agent.csrfToken;
  return agent;
}

describe('Customer account API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimReservationsForUser.mockResolvedValue({ reservations: 2, orders: 1 });
  });

  test('GET /api/account/dashboard requires auth', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);
    const response = await agent.get('/api/account/dashboard').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  test('login claims reservations by email', async () => {
    await loginAgent();
    expect(claimReservationsForUser).toHaveBeenCalledWith(7, 'demo@luxride.local');
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
