const request = require('supertest');
const { initTestAgent, withCsrf } = require('../../helpers/apiTestApp');
const { DEFAULT_ADMIN } = require('./dbFixtures');

async function createSessionAgent(app) {
  return initTestAgent(app);
}

async function createTwoSessionAgents(app) {
  return Promise.all([createSessionAgent(app), createSessionAgent(app)]);
}

async function loginAsAdmin(
  app,
  credentials = {
    email: DEFAULT_ADMIN.email,
    password: DEFAULT_ADMIN.password,
  }
) {
  const agent = await createSessionAgent(app);
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({
      email: credentials.email,
      password: credentials.password,
    })
    .expect(200);

  agent.csrfToken = loginRes.body.data?.csrfToken || agent.csrfToken;
  return agent;
}

async function postOrder(agent, body) {
  return withCsrf(agent, agent.post('/api/orders')).send(body);
}

async function postCheckout(agent, body) {
  return withCsrf(agent, agent.post('/api/checkout')).send(body);
}

async function postReleaseAndRehold(agent, body) {
  return withCsrf(agent, agent.post('/api/reservations/release-and-rehold')).send(body);
}

async function postRelease(agent) {
  return withCsrf(agent, agent.post('/api/reservations/release'));
}

async function postAdminReservationStatus(agent, reservationId, body) {
  return withCsrf(agent, agent.post(`/api/admin/reservations/${reservationId}/status`)).send(
    body
  );
}

async function postAdminReservationRefund(agent, reservationId, body = {}) {
  return withCsrf(agent, agent.post(`/api/admin/reservations/${reservationId}/refund`)).send(
    body
  );
}

async function loginAsStaff(app, credentials) {
  const agent = await createSessionAgent(app);
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({
      email: credentials.email,
      password: credentials.password,
    })
    .expect(200);

  agent.csrfToken = loginRes.body.data?.csrfToken || agent.csrfToken;
  return agent;
}

async function putUserRoles(agent, userId, roleIds) {
  return withCsrf(agent, agent.put(`/api/admin/users/${userId}/roles`)).send({
    roleIds: (roleIds || []).map(String),
  });
}

async function updateRolePermissions(agent, roleId, permissionKeys) {
  return withCsrf(agent, agent.put(`/api/admin/rbac/roles/${roleId}/permissions`)).send({
    permissionKeys,
  });
}

module.exports = {
  createSessionAgent,
  createTwoSessionAgents,
  loginAsAdmin,
  loginAsStaff,
  putUserRoles,
  updateRolePermissions,
  postOrder,
  postCheckout,
  postReleaseAndRehold,
  postRelease,
  postAdminReservationStatus,
  postAdminReservationRefund,
  withCsrf,
};
