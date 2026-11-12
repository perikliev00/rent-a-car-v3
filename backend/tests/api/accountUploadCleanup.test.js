// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'bcrypt' module as bcrypt.
const bcrypt = require('bcrypt');
// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');
// Require the '../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../src/services/sql/userSqlService');
// Require the '../../src/services/storage' module as storage.
const storage = require('../../src/services/storage');

// Call jest.mock to perform this step.
jest.mock('../../src/middleware/rateLimit', () => require('../helpers/rateLimitPassthrough'));
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/userSqlService', () => ({
  // Provide the find user by email field value.
  findUserByEmail: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/account/accountClaimService', () => ({
  // Provide the claim reservations for user field value.
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/rbac/rbacService', () => {
  // Create the actual constant.
  const actual = jest.requireActual('../../src/services/rbac/rbacService');
  // Return the resulting value to the caller.
  return { ...actual, getUserAccess: jest.fn() };
});
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../src/services/rbac/rbacService');

// Create the jpeg constant.
const jpeg = Buffer.from([
  // Supply the literal value used by the enclosing expression.
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

// Define the async function listTempFiles.
async function listTempFiles() {
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return await fs.promises.readdir(storage.UPLOAD_TEMP_DIR);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'ENOENT') return [];
    // Throw an error to stop the current control flow.
    throw err;
  }
}

// Declare a test suite grouping related cases.
describe('account document upload cleanup', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: [],
      // Provide the permissions field value.
      permissions: [],
      // Provide the role details field value.
      roleDetails: [],
    });
  });

  // Define a single test case and its expectations.
  test('a valid file with an invalid document type leaves no temp file', async () => {
    // Create the before constant.
    const before = new Set(await listTempFiles());
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue({
      // Provide the id field value.
      id: 2,
      // Provide the email field value.
      email: 'user@example.com',
      // Provide the password field value.
      password: 'hashed-password',
      // Provide the role field value.
      role: 'user',
    });
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(true);
    // Create the login constant.
    const login = await withCsrf(agent, agent.post('/api/v1/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);
    // Update agent.csrfToken with the right-hand side value.
    agent.csrfToken = login.body.data.csrfToken;

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/v1/account/documents'))
      // Call .attach to perform this step.
      .attach('file', jpeg, { filename: 'license.jpg', contentType: 'image/jpeg' })
      // Call .field to perform this step.
      .field('docType', 'not-a-document')
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Create the after constant.
    const after = await listTempFiles();
    // Create the created constant.
    const created = after.filter((name) => !before.has(name));
    // Assert that the value matches the intended expectation.
    expect(created).toEqual([]);
  });

  // Define a single test case and its expectations.
  test('the unversioned account alias also removes the rejected upload', async () => {
    // Create the before constant.
    const before = new Set(await listTempFiles());
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue({
      // Provide the id field value.
      id: 2,
      // Provide the email field value.
      email: 'user@example.com',
      // Provide the password field value.
      password: 'hashed-password',
      // Provide the role field value.
      role: 'user',
    });
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(true);
    // Create the login constant.
    const login = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);
    // Update agent.csrfToken with the right-hand side value.
    agent.csrfToken = login.body.data.csrfToken;

    // Wait until the asynchronous operation resolves.
    await withCsrf(agent, agent.post('/api/account/documents'))
      // Call .attach to perform this step.
      .attach('file', jpeg, { filename: 'license.jpg', contentType: 'image/jpeg' })
      // Call .field to perform this step.
      .field('docType', 'driver_license')
      // Call .field to perform this step.
      .field('reservationId', 'nope')
      // Call .expect to perform this step.
      .expect(422);

    // Create the after constant.
    const after = await listTempFiles();
    // Assert that the value matches the intended expectation.
    expect(after.filter((name) => !before.has(name))).toEqual([]);
  });
});
