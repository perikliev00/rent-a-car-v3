// Require the 'bcrypt' module as bcrypt.
const bcrypt = require('bcrypt');
// Destructure object properties into local variables.
const { PassThrough } = require('stream');
// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

// Call jest.mock to perform this step.
jest.mock('../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../helpers/rateLimitPassthrough')
);

// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/userSqlService', () => ({
  // Provide the find user by email field value.
  findUserByEmail: jest.fn(),
  // Provide the create user field value.
  createUser: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/account/accountClaimService', () => ({
  // Provide the claim reservations for user field value.
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 2, orders: 1 }),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/account/accountReservationService', () => ({
  // Provide the get dashboard field value.
  getDashboard: jest.fn(),
  // Provide the list reservations field value.
  listReservations: jest.fn(),
  // Provide the get reservation detail field value.
  getReservationDetail: jest.fn(),
  // Provide the update travel field value.
  updateTravel: jest.fn(),
  // Provide the request cancellation field value.
  requestCancellation: jest.fn(),
  // Provide the get reservation for pdf field value.
  getReservationForPdf: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/account/accountDocumentService', () => ({
  // Provide the list documents field value.
  listDocuments: jest.fn(),
  // Provide the upload document field value.
  uploadDocument: jest.fn(),
  // Provide the delete document field value.
  deleteDocument: jest.fn(),
  // Provide the open document download field value.
  openDocumentDownload: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/pdf/pdfDocumentService', () => ({
  // Provide the generate pdf field value.
  generatePdf: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/rbac/rbacService', () => {
  // Create the actual constant.
  const actual = jest.requireActual('../../src/services/rbac/rbacService');
  // Return the resulting value to the caller.
  return {
    // Spread actual into the surrounding structure.
    ...actual,
    // Provide the get user access field value.
    getUserAccess: jest.fn().mockResolvedValue({
      // Provide the roles field value.
      roles: [],
      // Provide the permissions field value.
      permissions: [],
      // Provide the role details field value.
      roleDetails: [],
    }),
  };
});

// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../src/services/sql/userSqlService');
// Require the '../../src/services/auth/loginAttemptService' module as loginAttemptService.
const loginAttemptService = require('../../src/services/auth/loginAttemptService');
// Destructure object properties into local variables.
const { claimReservationsForUser } = require('../../src/services/account/accountClaimService');
// Require the '../../src/services/account/accountReservationService' module as accountReservationService.
const accountReservationService = require('../../src/services/account/accountReservationService');
// Require the '../../src/services/account/accountDocumentService' module as accountDocumentService.
const accountDocumentService = require('../../src/services/account/accountDocumentService');
// Destructure object properties into local variables.
const { generatePdf } = require('../../src/services/pdf/pdfDocumentService');

// Create the mock user constant.
const mockUser = {
  // Provide the id field value.
  id: 7,
  // Provide the email field value.
  email: 'demo@luxride.local',
  // Provide the password field value.
  password: 'hashed',
  // Provide the role field value.
  role: 'user',
};

// Define the async function loginAgent.
async function loginAgent() {
  // Create the app constant.
  const app = createApiTestApp();
  // Create the agent constant.
  const agent = await initTestAgent(app);
  // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
  userSql.findUserByEmail.mockResolvedValue(mockUser);
  // Call bcrypt.compare.mockResolvedValue to perform this step.
  bcrypt.compare.mockResolvedValue(true);
  // Continue the surrounding logic with this statement.
  loginAttemptService.resetForTests?.();

  // Create the login res constant.
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    // Call .send to perform this step.
    .send({ email: mockUser.email, password: 'Demo123!' })
    // Call .expect to perform this step.
    .expect(200);

  // Update agent.csrfToken with the right-hand side value.
  agent.csrfToken = loginRes.body.data?.csrfToken || agent.csrfToken;
  // Return the resulting value to the caller.
  return agent;
}

// Declare a test suite grouping related cases.
describe('Customer account API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call claimReservationsForUser.mockResolvedValue to perform this step.
    claimReservationsForUser.mockResolvedValue({ reservations: 2, orders: 1 });
  });

  // Define a single test case and its expectations.
  test('GET /api/account/dashboard requires auth', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);
    // Create the response constant.
    const response = await agent.get('/api/account/dashboard').expect(401);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  // Define a single test case and its expectations.
  test('login claims reservations by email', async () => {
    // Wait until the asynchronous operation resolves.
    await loginAgent();
    // Assert that the value matches the intended expectation.
    expect(claimReservationsForUser).toHaveBeenCalledWith(7, 'demo@luxride.local');
  });

  // Define a single test case and its expectations.
  test('GET /api/account/dashboard returns summary for logged-in user', async () => {
    // Call accountReservationService.getDashboard.mockResolvedValue to perform this step.
    accountReservationService.getDashboard.mockResolvedValue({
      // Provide the counts field value.
      counts: { total: 1, active: 1, completed: 0 },
      // Provide the upcoming field value.
      upcoming: null,
      // Provide the recent field value.
      recent: [],
    });
    // Create the agent constant.
    const agent = await loginAgent();
    // Create the response constant.
    const response = await agent.get('/api/account/dashboard').expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.counts.total).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(accountReservationService.getDashboard).toHaveBeenCalledWith(7);
  });

  // Define a single test case and its expectations.
  test('GET /api/account/reservations/:id returns 404 for other users', async () => {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Call accountReservationService.getReservationDetail.mockRejectedValue to perform this step.
    accountReservationService.getReservationDetail.mockRejectedValue(err);

    // Create the agent constant.
    const agent = await loginAgent();
    // Create the response constant.
    const response = await agent.get('/api/account/reservations/99').expect(404);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  // Define a single test case and its expectations.
  test('POST cancel-request creates pending request for confirmed booking', async () => {
    // Call accountReservationService.requestCancellation.mockResolvedValue to perform this step.
    accountReservationService.requestCancellation.mockResolvedValue({
      // Provide the immediate field value.
      immediate: false,
      // Provide the reservation field value.
      reservation: { id: '10', status: 'confirmed' },
      // Provide the cancellation request field value.
      cancellationRequest: { id: 1, status: 'pending' },
    });
    // Create the agent constant.
    const agent = await loginAgent();
    // Create the response constant.
    const response = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.post to perform this step.
      agent.post('/api/account/reservations/10/cancel-request')
    )
      // Call .send to perform this step.
      .send({ reason: 'Plans changed' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.immediate).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.cancellationRequest.status).toBe('pending');
  });

  // Define a single test case and its expectations.
  test('GET pdf streams application/pdf', async () => {
    // Call accountReservationService.getReservationForPdf.mockResolvedValue to perform this step.
    accountReservationService.getReservationForPdf.mockResolvedValue({
      // Provide the id field value.
      id: '10',
      // Provide the status field value.
      status: 'confirmed',
      // Provide the total price field value.
      totalPrice: 100,
    });
    // Call generatePdf.mockResolvedValue to perform this step.
    generatePdf.mockResolvedValue({
      // Provide the buffer field value.
      buffer: Buffer.from('%PDF-1.4 test'),
      // Provide the filename field value.
      filename: 'luxride-invoice-10.pdf',
      // Provide the content type field value.
      contentType: 'application/pdf',
    });

    // Create the agent constant.
    const agent = await loginAgent();
    // Create the response constant.
    const response = await agent.get('/api/account/reservations/10/pdf/invoice').expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.headers['content-type']).toMatch(/application\/pdf/);
    // Assert that the value matches the intended expectation.
    expect(response.text || response.body.toString()).toContain('%PDF');
  });

  // Define a single test case and its expectations.
  test('document download returns 404 for unauthorized access', async () => {
    // Create the err constant.
    const err = new Error('Document not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Call accountDocumentService.openDocumentDownload.mockRejectedValue to perform this step.
    accountDocumentService.openDocumentDownload.mockRejectedValue(err);

    // Create the agent constant.
    const agent = await loginAgent();
    // Create the response constant.
    const response = await agent.get('/api/account/documents/5/download').expect(404);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  // Define a single test case and its expectations.
  test('GET /api/account/reservations lists reservations for user', async () => {
    // Call accountReservationService.listReservations.mockResolvedValue to perform this step.
    accountReservationService.listReservations.mockResolvedValue([
      // Contribute this line to the enclosing declaration or statement.
      { id: '10', status: 'confirmed', totalPrice: 100 },
    ]);

    // Create the agent constant.
    const agent = await loginAgent();
    // Create the response constant.
    const response = await agent.get('/api/account/reservations').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.reservations).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(accountReservationService.listReservations).toHaveBeenCalledWith(7);
  });

  // Define a single test case and its expectations.
  test('PATCH travel details updates reservation', async () => {
    // Call accountReservationService.updateTravel.mockResolvedValue to perform this step.
    accountReservationService.updateTravel.mockResolvedValue({
      // Provide the id field value.
      id: '10',
      // Provide the flight number field value.
      flightNumber: 'FR123',
      // Provide the hotel name field value.
      hotelName: 'Hotel X',
    });

    // Create the agent constant.
    const agent = await loginAgent();
    // Create the response constant.
    const response = await withCsrf(agent, agent.patch('/api/account/reservations/10/travel'))
      // Call .send to perform this step.
      .send({ flightNumber: 'FR123', hotelName: 'Hotel X' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.reservation.flightNumber).toBe('FR123');
    // Assert that the value matches the intended expectation.
    expect(accountReservationService.updateTravel).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      7,
      // Supply the literal value used by the enclosing expression.
      '10',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ flightNumber: 'FR123', hotelName: 'Hotel X' })
    );
  });

  // Define a single test case and its expectations.
  test('GET /api/account/documents lists uploaded documents', async () => {
    // Call accountDocumentService.listDocuments.mockResolvedValue to perform this step.
    accountDocumentService.listDocuments.mockResolvedValue([
      {
        // Provide the id field value.
        id: 1,
        // Provide the doc type field value.
        docType: 'driver_license',
        // Provide the original filename field value.
        originalFilename: 'license.pdf',
        // Provide the mime type field value.
        mimeType: 'application/pdf',
        // Provide the size bytes field value.
        sizeBytes: 1024,
        // Provide the reservation id field value.
        reservationId: null,
        // Provide the created at field value.
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ]);

    // Create the agent constant.
    const agent = await loginAgent();
    // Create the response constant.
    const response = await agent.get('/api/account/documents').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.documents).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(accountDocumentService.listDocuments).toHaveBeenCalledWith(7);
  });

  // Define a single test case and its expectations.
  test('DELETE /api/account/documents/:id deletes document', async () => {
    // Call accountDocumentService.deleteDocument.mockResolvedValue to perform this step.
    accountDocumentService.deleteDocument.mockResolvedValue({
      // Provide the id field value.
      id: 5,
      // Provide the doc type field value.
      docType: 'other',
      // Provide the original filename field value.
      originalFilename: 'gone.pdf',
    });

    // Create the agent constant.
    const agent = await loginAgent();
    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/account/documents/5')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.document.id).toBe(5);
    // Assert that the value matches the intended expectation.
    expect(accountDocumentService.deleteDocument).toHaveBeenCalledWith(7, '5');
  });
});
