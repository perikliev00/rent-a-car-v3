// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { initTestAgent, withCsrf } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { DEFAULT_ADMIN } = require('./dbFixtures');

// Define the async function createSessionAgent.
async function createSessionAgent(app) {
  // Return the resulting value to the caller.
  return initTestAgent(app);
}

// Define the async function createTwoSessionAgents.
async function createTwoSessionAgents(app) {
  // Return the resulting value to the caller.
  return Promise.all([createSessionAgent(app), createSessionAgent(app)]);
}

// Define the async function loginAsAdmin.
async function loginAsAdmin(
  // Contribute this line to the enclosing declaration or statement.
  app,
  // Update credentials with the right-hand side value.
  credentials = {
    // Provide the email field value.
    email: DEFAULT_ADMIN.email,
    // Provide the password field value.
    password: DEFAULT_ADMIN.password,
  }
// Continue the surrounding logic with this statement.
) {
  // Create the agent constant.
  const agent = await createSessionAgent(app);
  // Create the login res constant.
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    // Call .send to perform this step.
    .send({
      // Provide the email field value.
      email: credentials.email,
      // Provide the password field value.
      password: credentials.password,
    })
    // Call .expect to perform this step.
    .expect(200);

  // Update agent.csrfToken with the right-hand side value.
  agent.csrfToken = loginRes.body.data?.csrfToken || agent.csrfToken;
  // Return the resulting value to the caller.
  return agent;
}

// Define the async function postOrder.
async function postOrder(agent, body) {
  // Return the resulting value to the caller.
  return withCsrf(agent, agent.post('/api/orders')).send(body);
}

// Define the async function postCheckout.
async function postCheckout(agent, body) {
  // Return the resulting value to the caller.
  return withCsrf(agent, agent.post('/api/checkout')).send(body);
}

// Define the async function postReleaseAndRehold.
async function postReleaseAndRehold(agent, body) {
  // Return the resulting value to the caller.
  return withCsrf(agent, agent.post('/api/reservations/release-and-rehold')).send(body);
}

// Define the async function postRelease.
async function postRelease(agent) {
  // Return the resulting value to the caller.
  return withCsrf(agent, agent.post('/api/reservations/release'));
}

// Define the async function postAdminReservationStatus.
async function postAdminReservationStatus(agent, reservationId, body) {
  // Return the resulting value to the caller.
  return withCsrf(agent, agent.post(`/api/admin/reservations/${reservationId}/status`)).send(
    // Reference the identifier used by the enclosing expression.
    body
  );
}

// Define the async function postAdminReservationRefund.
async function postAdminReservationRefund(agent, reservationId, body = {}) {
  // Return the resulting value to the caller.
  return withCsrf(agent, agent.post(`/api/admin/reservations/${reservationId}/refund`)).send(
    // Reference the identifier used by the enclosing expression.
    body
  );
}

// Define the async function loginAsStaff.
async function loginAsStaff(app, credentials) {
  // Create the agent constant.
  const agent = await createSessionAgent(app);
  // Create the login res constant.
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    // Call .send to perform this step.
    .send({
      // Provide the email field value.
      email: credentials.email,
      // Provide the password field value.
      password: credentials.password,
    })
    // Call .expect to perform this step.
    .expect(200);

  // Update agent.csrfToken with the right-hand side value.
  agent.csrfToken = loginRes.body.data?.csrfToken || agent.csrfToken;
  // Return the resulting value to the caller.
  return agent;
}

// Define the async function putUserRoles.
async function putUserRoles(agent, userId, roleIds) {
  // Return the resulting value to the caller.
  return withCsrf(agent, agent.put(`/api/admin/users/${userId}/roles`)).send({
    // Provide the role ids field value.
    roleIds: (roleIds || []).map(String),
  });
}

// Define the async function updateRolePermissions.
async function updateRolePermissions(agent, roleId, permissionKeys) {
  // Return the resulting value to the caller.
  return withCsrf(agent, agent.put(`/api/admin/rbac/roles/${roleId}/permissions`)).send({
    // Contribute this line to the enclosing declaration or statement.
    permissionKeys,
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createSessionAgent,
  // Contribute this line to the enclosing declaration or statement.
  createTwoSessionAgents,
  // Contribute this line to the enclosing declaration or statement.
  loginAsAdmin,
  // Contribute this line to the enclosing declaration or statement.
  loginAsStaff,
  // Contribute this line to the enclosing declaration or statement.
  putUserRoles,
  // Contribute this line to the enclosing declaration or statement.
  updateRolePermissions,
  // Contribute this line to the enclosing declaration or statement.
  postOrder,
  // Contribute this line to the enclosing declaration or statement.
  postCheckout,
  // Contribute this line to the enclosing declaration or statement.
  postReleaseAndRehold,
  // Contribute this line to the enclosing declaration or statement.
  postRelease,
  // Contribute this line to the enclosing declaration or statement.
  postAdminReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  postAdminReservationRefund,
  // Contribute this line to the enclosing declaration or statement.
  withCsrf,
};
