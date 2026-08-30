const request = require('supertest');
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');

jest.mock('../../../src/services/reservationService', () => ({}));
jest.mock('../../../src/middleware/rateLimit', () => ({
  authLimiter: (_req, _res, next) => next(),
  loginLimiter: (_req, _res, next) => next(),
  signupLimiter: (_req, _res, next) => next(),
  emailVerificationLimiter: (_req, _res, next) => next(),
  adminLimiter: (_req, _res, next) => next(),
  adminUploadLimiter: (_req, _res, next) => next(),
  accountUploadLimiter: (_req, _res, next) => next(),
  contactLimiter: (_req, _res, next) => next(),
}));
jest.mock('../../../src/services/rbac/rbacService', () =>
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('../../../src/services/sql/contactSqlService');
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const contactSql = require('../../../src/services/sql/contactSqlService');

const mockContact = {
  id: '5',
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Question',
  message: 'Hello',
  status: 'new',
};

describe('GET /api/admin/contacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contactSql.listContacts.mockResolvedValue([mockContact]);
  });

  test('returns contacts list for admin', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/contacts').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { contacts: [mockContact] },
    });
  });
});

describe('PATCH /api/admin/contacts/:id/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contactSql.updateContactStatus.mockResolvedValue({ ...mockContact, status: 'done' });
  });

  test('updates contact status', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.patch('/api/admin/contacts/5/status'))
      .send({ status: 'done' })
      .expect(200);

    expect(response.body.data.contact.status).toBe('done');
    expect(contactSql.updateContactStatus).toHaveBeenCalledWith('5', 'done');
  });

  test('returns validation error for invalid status', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.patch('/api/admin/contacts/5/status'))
      .send({ status: 'invalid' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns not found when contact is missing', async () => {
    contactSql.updateContactStatus.mockResolvedValue(null);
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.patch('/api/admin/contacts/99/status'))
      .send({ status: 'done' })
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/admin/contacts/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contactSql.deleteContactById.mockResolvedValue(true);
  });

  test('deletes contact', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.delete('/api/admin/contacts/5')).expect(200);

    expect(response.body.data).toEqual({ deleted: true, id: 5 });
  });
});

describe('admin contacts authorization', () => {
  test('returns unauthorized without session', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/admin/contacts').expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
