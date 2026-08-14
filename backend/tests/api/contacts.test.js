const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

jest.mock('../../src/services/reservationService', () => ({}));
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
jest.mock('../../src/services/sql/contactSqlService');

const contactSql = require('../../src/services/sql/contactSqlService');

const validPayload = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+359888000000',
  subject: 'Booking question',
  message: 'I would like to know about availability next week.',
};

const mockContact = {
  id: '12',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+359888000000',
  subject: 'Booking question',
  message: 'I would like to know about availability next week.',
  status: 'new',
  createdAt: '2026-07-31T10:00:00.000Z',
  updatedAt: '2026-07-31T10:00:00.000Z',
};

describe('POST /api/contacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contactSql.createContact.mockResolvedValue(mockContact);
  });

  test('creates a contact message with status new', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/contacts'))
      .send(validPayload)
      .expect(200);

    expect(contactSql.createContact).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+359888000000',
      subject: 'Booking question',
      message: 'I would like to know about availability next week.',
    });
    expect(response.body).toEqual({
      success: true,
      data: { contact: mockContact },
    });
    expect(response.body.data.contact.status).toBe('new');
  });

  test('accepts missing phone and passes null', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);
    const { phone: _phone, ...withoutPhone } = validPayload;

    contactSql.createContact.mockResolvedValue({
      ...mockContact,
      phone: undefined,
    });

    await withCsrf(agent, agent.post('/api/contacts')).send(withoutPhone).expect(200);

    expect(contactSql.createContact).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: null,
      subject: 'Booking question',
      message: 'I would like to know about availability next week.',
    });
  });

  test('treats empty phone as null', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    await withCsrf(agent, agent.post('/api/contacts'))
      .send({ ...validPayload, phone: '' })
      .expect(200);

    expect(contactSql.createContact).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null })
    );
  });

  test('returns 422 when required fields are missing', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/contacts'))
      .send({ name: 'Jane' })
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(contactSql.createContact).not.toHaveBeenCalled();
  });

  test('returns 422 for invalid email', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/contacts'))
      .send({ ...validPayload, email: 'not-an-email' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(contactSql.createContact).not.toHaveBeenCalled();
  });

  test('returns 422 when message is too short', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/contacts'))
      .send({ ...validPayload, message: 'short' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(contactSql.createContact).not.toHaveBeenCalled();
  });

  test('ignores client-provided status and always creates as new', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    await withCsrf(agent, agent.post('/api/contacts'))
      .send({ ...validPayload, status: 'done' })
      .expect(200);

    expect(contactSql.createContact).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+359888000000',
      subject: 'Booking question',
      message: 'I would like to know about availability next week.',
    });
    expect(contactSql.createContact.mock.calls[0][0]).not.toHaveProperty('status');
  });
});
