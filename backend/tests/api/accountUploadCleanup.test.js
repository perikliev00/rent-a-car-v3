const fs = require('fs');
const bcrypt = require('bcrypt');
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');
const userSql = require('../../src/services/sql/userSqlService');
const storage = require('../../src/services/storage');

jest.mock('../../src/middleware/rateLimit', () => require('../helpers/rateLimitPassthrough'));
jest.mock('../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('../../src/services/rbac/rbacService', () => {
  const actual = jest.requireActual('../../src/services/rbac/rbacService');
  return { ...actual, getUserAccess: jest.fn() };
});
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const rbacService = require('../../src/services/rbac/rbacService');

const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

async function listTempFiles() {
  try {
    return await fs.promises.readdir(storage.UPLOAD_TEMP_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

describe('account document upload cleanup', () => {
  beforeEach(() => {
    rbacService.getUserAccess.mockResolvedValue({
      roles: [],
      permissions: [],
      roleDetails: [],
    });
  });

  test('a valid file with an invalid document type leaves no temp file', async () => {
    const before = new Set(await listTempFiles());
    const app = createApiTestApp();
    const agent = await initTestAgent(app);
    userSql.findUserByEmail.mockResolvedValue({
      id: 2,
      email: 'user@example.com',
      password: 'hashed-password',
      role: 'user',
    });
    bcrypt.compare.mockResolvedValue(true);
    const login = await withCsrf(agent, agent.post('/api/v1/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = login.body.data.csrfToken;

    const response = await withCsrf(agent, agent.post('/api/v1/account/documents'))
      .attach('file', jpeg, { filename: 'license.jpg', contentType: 'image/jpeg' })
      .field('docType', 'not-a-document')
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const after = await listTempFiles();
    const created = after.filter((name) => !before.has(name));
    expect(created).toEqual([]);
  });

  test('the unversioned account alias also removes the rejected upload', async () => {
    const before = new Set(await listTempFiles());
    const app = createApiTestApp();
    const agent = await initTestAgent(app);
    userSql.findUserByEmail.mockResolvedValue({
      id: 2,
      email: 'user@example.com',
      password: 'hashed-password',
      role: 'user',
    });
    bcrypt.compare.mockResolvedValue(true);
    const login = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = login.body.data.csrfToken;

    await withCsrf(agent, agent.post('/api/account/documents'))
      .attach('file', jpeg, { filename: 'license.jpg', contentType: 'image/jpeg' })
      .field('docType', 'driver_license')
      .field('reservationId', 'nope')
      .expect(422);

    const after = await listTempFiles();
    expect(after.filter((name) => !before.has(name))).toEqual([]);
  });
});
