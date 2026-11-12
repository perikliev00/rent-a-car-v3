// Require the 'bcrypt' module as bcrypt.
const bcrypt = require('bcrypt');
// Destructure object properties into local variables.
const { initTestAgent, withCsrf } = require('./apiTestApp');
// Require the '../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../src/services/sql/userSqlService');

// Create the default api admin constant.
const DEFAULT_API_ADMIN = {
  // Provide the id field value.
  id: 1,
  // Provide the email field value.
  email: 'admin@example.com',
  // Provide the password field value.
  password: 'hashed-password',
  // Provide the role field value.
  role: 'admin',
};

// Create the default api customer constant.
const DEFAULT_API_CUSTOMER = {
  // Provide the id field value.
  id: 2,
  // Provide the email field value.
  email: 'user@example.com',
  // Provide the password field value.
  password: 'hashed-password',
  // Provide the role field value.
  role: 'customer',
};

// Define the async function loginAsAdmin.
async function loginAsAdmin(app) {
  // Create the agent constant.
  const agent = await initTestAgent(app);
  // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
  userSql.findUserByEmail.mockResolvedValue(DEFAULT_API_ADMIN);
  // Call bcrypt.compare.mockResolvedValue to perform this step.
  bcrypt.compare.mockResolvedValue(true);
  // Create the login res constant.
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    // Call .send to perform this step.
    .send({ email: 'admin@example.com', password: 'Secret123' })
    // Call .expect to perform this step.
    .expect(200);
  // Update agent.csrfToken with the right-hand side value.
  agent.csrfToken = loginRes.body.data.csrfToken;
  // Return the resulting value to the caller.
  return agent;
}

// Define the async function loginAsCustomer.
async function loginAsCustomer(app) {
  // Create the agent constant.
  const agent = await initTestAgent(app);
  // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
  userSql.findUserByEmail.mockResolvedValue(DEFAULT_API_CUSTOMER);
  // Call bcrypt.compare.mockResolvedValue to perform this step.
  bcrypt.compare.mockResolvedValue(true);
  // Create the login res constant.
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    // Call .send to perform this step.
    .send({ email: 'user@example.com', password: 'Secret123' })
    // Call .expect to perform this step.
    .expect(200);
  // Update agent.csrfToken with the right-hand side value.
  agent.csrfToken = loginRes.body.data.csrfToken;
  // Return the resulting value to the caller.
  return agent;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  DEFAULT_API_ADMIN,
  // Contribute this line to the enclosing declaration or statement.
  DEFAULT_API_CUSTOMER,
  // Contribute this line to the enclosing declaration or statement.
  loginAsAdmin,
  // Contribute this line to the enclosing declaration or statement.
  loginAsCustomer,
};
