// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

// Call jest.mock to perform this step.
jest.mock('../../src/services/reservationService', () => ({}));
// Call jest.mock to perform this step.
jest.mock('../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../helpers/rateLimitPassthrough')
);
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/contactSqlService');

// Require the '../../src/services/sql/contactSqlService' module as contactSql.
const contactSql = require('../../src/services/sql/contactSqlService');

// Create the valid payload constant.
const validPayload = {
  // Provide the name field value.
  name: 'Jane Doe',
  // Provide the email field value.
  email: 'jane@example.com',
  // Provide the phone field value.
  phone: '+359888000000',
  // Provide the subject field value.
  subject: 'Booking question',
  // Provide the message field value.
  message: 'I would like to know about availability next week.',
};

// Create the mock contact constant.
const mockContact = {
  // Provide the id field value.
  id: '12',
  // Provide the name field value.
  name: 'Jane Doe',
  // Provide the email field value.
  email: 'jane@example.com',
  // Provide the phone field value.
  phone: '+359888000000',
  // Provide the subject field value.
  subject: 'Booking question',
  // Provide the message field value.
  message: 'I would like to know about availability next week.',
  // Provide the status field value.
  status: 'new',
  // Provide the created at field value.
  createdAt: '2026-07-31T10:00:00.000Z',
  // Provide the updated at field value.
  updatedAt: '2026-07-31T10:00:00.000Z',
};

// Declare a test suite grouping related cases.
describe('POST /api/contacts', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call contactSql.createContact.mockResolvedValue to perform this step.
    contactSql.createContact.mockResolvedValue(mockContact);
  });

  // Define a single test case and its expectations.
  test('creates a contact message with status new', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/contacts'))
      // Call .send to perform this step.
      .send(validPayload)
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(contactSql.createContact).toHaveBeenCalledWith({
      // Provide the name field value.
      name: 'Jane Doe',
      // Provide the email field value.
      email: 'jane@example.com',
      // Provide the phone field value.
      phone: '+359888000000',
      // Provide the subject field value.
      subject: 'Booking question',
      // Provide the message field value.
      message: 'I would like to know about availability next week.',
    });
    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { contact: mockContact },
    });
    // Assert that the value matches the intended expectation.
    expect(response.body.data.contact.status).toBe('new');
  });

  // Define a single test case and its expectations.
  test('accepts missing phone and passes null', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);
    // Destructure object properties into local variables.
    const { phone: _phone, ...withoutPhone } = validPayload;

    // Call contactSql.createContact.mockResolvedValue to perform this step.
    contactSql.createContact.mockResolvedValue({
      // Spread mockContact into the surrounding structure.
      ...mockContact,
      // Provide the phone field value.
      phone: undefined,
    });

    // Wait until the asynchronous operation resolves.
    await withCsrf(agent, agent.post('/api/contacts')).send(withoutPhone).expect(200);

    // Assert that the value matches the intended expectation.
    expect(contactSql.createContact).toHaveBeenCalledWith({
      // Provide the name field value.
      name: 'Jane Doe',
      // Provide the email field value.
      email: 'jane@example.com',
      // Provide the phone field value.
      phone: null,
      // Provide the subject field value.
      subject: 'Booking question',
      // Provide the message field value.
      message: 'I would like to know about availability next week.',
    });
  });

  // Define a single test case and its expectations.
  test('treats empty phone as null', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Wait until the asynchronous operation resolves.
    await withCsrf(agent, agent.post('/api/contacts'))
      // Call .send to perform this step.
      .send({ ...validPayload, phone: '' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(contactSql.createContact).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ phone: null })
    );
  });

  // Define a single test case and its expectations.
  test('returns 422 when required fields are missing', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/contacts'))
      // Call .send to perform this step.
      .send({ name: 'Jane' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(contactSql.createContact).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns 422 for invalid email', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/contacts'))
      // Call .send to perform this step.
      .send({ ...validPayload, email: 'not-an-email' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(contactSql.createContact).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns 422 when message is too short', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/contacts'))
      // Call .send to perform this step.
      .send({ ...validPayload, message: 'short' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(contactSql.createContact).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('ignores client-provided status and always creates as new', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Wait until the asynchronous operation resolves.
    await withCsrf(agent, agent.post('/api/contacts'))
      // Call .send to perform this step.
      .send({ ...validPayload, status: 'done' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(contactSql.createContact).toHaveBeenCalledWith({
      // Provide the name field value.
      name: 'Jane Doe',
      // Provide the email field value.
      email: 'jane@example.com',
      // Provide the phone field value.
      phone: '+359888000000',
      // Provide the subject field value.
      subject: 'Booking question',
      // Provide the message field value.
      message: 'I would like to know about availability next week.',
    });
    // Assert that the value matches the intended expectation.
    expect(contactSql.createContact.mock.calls[0][0]).not.toHaveProperty('status');
  });
});
