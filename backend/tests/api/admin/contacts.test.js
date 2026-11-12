// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');

// Call jest.mock to perform this step.
jest.mock('../../../src/services/reservationService', () => ({}));
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../../helpers/rateLimitPassthrough')
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/rbac/rbacService', () =>
  // Call require to perform this step.
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/userSqlService', () => ({
  // Provide the find user by email field value.
  findUserByEmail: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/account/accountClaimService', () => ({
  // Provide the claim reservations for user field value.
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/contactSqlService');
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/services/sql/contactSqlService' module as contactSql.
const contactSql = require('../../../src/services/sql/contactSqlService');

// Create the mock contact constant.
const mockContact = {
  // Provide the id field value.
  id: '5',
  // Provide the name field value.
  name: 'Jane Doe',
  // Provide the email field value.
  email: 'jane@example.com',
  // Provide the subject field value.
  subject: 'Question',
  // Provide the message field value.
  message: 'Hello',
  // Provide the status field value.
  status: 'new',
};

// Declare a test suite grouping related cases.
describe('GET /api/admin/contacts', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call contactSql.listContacts.mockResolvedValue to perform this step.
    contactSql.listContacts.mockResolvedValue([mockContact]);
  });

  // Define a single test case and its expectations.
  test('returns contacts list for admin', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/contacts').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { contacts: [mockContact] },
    });
  });
});

// Declare a test suite grouping related cases.
describe('PATCH /api/admin/contacts/:id/status', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call contactSql.updateContactStatus.mockResolvedValue to perform this step.
    contactSql.updateContactStatus.mockResolvedValue({ ...mockContact, status: 'done' });
  });

  // Define a single test case and its expectations.
  test('updates contact status', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.patch('/api/admin/contacts/5/status'))
      // Call .send to perform this step.
      .send({ status: 'done' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.contact.status).toBe('done');
    // Assert that the value matches the intended expectation.
    expect(contactSql.updateContactStatus).toHaveBeenCalledWith('5', 'done');
  });

  // Define a single test case and its expectations.
  test('returns validation error for invalid status', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.patch('/api/admin/contacts/5/status'))
      // Call .send to perform this step.
      .send({ status: 'invalid' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Define a single test case and its expectations.
  test('returns not found when contact is missing', async () => {
    // Call contactSql.updateContactStatus.mockResolvedValue to perform this step.
    contactSql.updateContactStatus.mockResolvedValue(null);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.patch('/api/admin/contacts/99/status'))
      // Call .send to perform this step.
      .send({ status: 'done' })
      // Call .expect to perform this step.
      .expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

// Declare a test suite grouping related cases.
describe('DELETE /api/admin/contacts/:id', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call contactSql.deleteContactById.mockResolvedValue to perform this step.
    contactSql.deleteContactById.mockResolvedValue(true);
  });

  // Define a single test case and its expectations.
  test('deletes contact', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/admin/contacts/5')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual({ deleted: true, id: 5 });
  });
});

// Declare a test suite grouping related cases.
describe('admin contacts authorization', () => {
  // Define a single test case and its expectations.
  test('returns unauthorized without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/admin/contacts').expect(401);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
