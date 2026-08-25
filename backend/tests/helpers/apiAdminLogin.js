const bcrypt = require('bcrypt');
const { initTestAgent, withCsrf } = require('./apiTestApp');
const userSql = require('../../src/services/sql/userSqlService');

const DEFAULT_API_ADMIN = {
  id: 1,
  email: 'admin@example.com',
  password: 'hashed-password',
  role: 'admin',
  emailVerified: true,
};

const DEFAULT_API_CUSTOMER = {
  id: 2,
  email: 'user@example.com',
  password: 'hashed-password',
  role: 'customer',
  emailVerified: true,
};

async function loginAsAdmin(app) {
  const agent = await initTestAgent(app);
  userSql.findUserByEmail.mockResolvedValue(DEFAULT_API_ADMIN);
  bcrypt.compare.mockResolvedValue(true);
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({ email: 'admin@example.com', password: 'Secret123' })
    .expect(200);
  agent.csrfToken = loginRes.body.data.csrfToken;
  return agent;
}

async function loginAsCustomer(app) {
  const agent = await initTestAgent(app);
  userSql.findUserByEmail.mockResolvedValue(DEFAULT_API_CUSTOMER);
  bcrypt.compare.mockResolvedValue(true);
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({ email: 'user@example.com', password: 'Secret123' })
    .expect(200);
  agent.csrfToken = loginRes.body.data.csrfToken;
  return agent;
}

module.exports = {
  DEFAULT_API_ADMIN,
  DEFAULT_API_CUSTOMER,
  loginAsAdmin,
  loginAsCustomer,
};
