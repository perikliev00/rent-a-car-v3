// Require the 'supertest' module as request.
const request = require('supertest');
// Require the 'bcrypt' module as bcrypt.
const bcrypt = require('bcrypt');
// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
// Destructure object properties into local variables.
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

// Call jest.mock to perform this step.
jest.mock('../../../src/services/reservationService', () => ({}));
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../../helpers/rateLimitPassthrough')
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/rbac/rbacService', () => {
  // Require the '../../helpers/rbacTestAccess' module as base.
  const base = require('../../helpers/rbacTestAccess').createOwnerRbacMock();
  // Return the resulting value to the caller.
  return base;
});
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
jest.mock('../../../src/modules/calendar/calendar.service', () => ({
  // Provide the get events field value.
  getEvents: jest.fn().mockResolvedValue({ cars: [], events: [], density: 'timeline' }),
  // Provide the get day field value.
  getDay: jest.fn().mockResolvedValue({ date: '2026-08-01', cars: [], pickups: [], returns: [] }),
  // Provide the get car timeline field value.
  getCarTimeline: jest.fn(),
  // Provide the get availability field value.
  getAvailability: jest.fn().mockResolvedValue({ available: true, conflicts: [] }),
  // Provide the get conflicts field value.
  getConflicts: jest.fn().mockResolvedValue({ conflicts: [] }),
  // Provide the get event details field value.
  getEventDetails: jest.fn(),
  // Provide the create manual event field value.
  createManualEvent: jest.fn(),
  // Provide the update manual event field value.
  updateManualEvent: jest.fn(),
  // Provide the delete manual event field value.
  deleteManualEvent: jest.fn(),
  // Provide the create task field value.
  createTask: jest.fn(),
  // Provide the update task field value.
  updateTask: jest.fn(),
  // Provide the delete task field value.
  deleteTask: jest.fn(),
  // Provide the update task status field value.
  updateTaskStatus: jest.fn(),
  // Provide the move or resize event field value.
  moveOrResizeEvent: jest.fn(),
  // Provide the list tasks field value.
  listTasks: jest.fn().mockResolvedValue({ tasks: [] }),
  // Provide the list assignable staff field value.
  listAssignableStaff: jest.fn().mockResolvedValue({ users: [] }),
  // Provide the cancel reservation from calendar field value.
  cancelReservationFromCalendar: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../../src/services/sql/userSqlService');
// Require the '../../../src/modules/calendar/calendar.service' module as calendarService.
const calendarService = require('../../../src/modules/calendar/calendar.service');
// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Declare a test suite grouping related cases.
describe('Admin calendar API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: ALL_PERMISSIONS,
      // Provide the role details field value.
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
    // Call calendarService.getEvents.mockResolvedValue to perform this step.
    calendarService.getEvents.mockResolvedValue({ cars: [], events: [], density: 'timeline' });
    // Call calendarService.getDay.mockResolvedValue to perform this step.
    calendarService.getDay.mockResolvedValue({
      // Provide the date field value.
      date: '2026-08-10',
      // Provide the cars field value.
      cars: [],
      // Provide the pickups field value.
      pickups: [],
      // Provide the returns field value.
      returns: [],
    });
    // Call calendarService.getAvailability.mockResolvedValue to perform this step.
    calendarService.getAvailability.mockResolvedValue({ available: true, conflicts: [] });
    // Call calendarService.getConflicts.mockResolvedValue to perform this step.
    calendarService.getConflicts.mockResolvedValue({ conflicts: [] });
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/calendar/events returns payload', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the from constant.
    const from = '2026-08-10T00:00:00.000Z';
    // Create the to constant.
    const to = '2026-08-17T00:00:00.000Z';
    // Create the response constant.
    const response = await agent
      // Call .get to perform this step.
      .get(`/api/admin/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      // Call .expect to perform this step.
      .expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.getEvents).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/calendar/day/:date returns day ops', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await agent.get('/api/admin/calendar/day/2026-08-10').expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.getDay).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('denies customer without calendar permission', async () => {
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
      password: 'hashed',
      // Provide the role field value.
      role: 'user',
    });
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(true);
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: [],
      // Provide the permissions field value.
      permissions: [],
      // Provide the role details field value.
      roleDetails: [],
    });
    // Create the login res constant.
    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);
    // Update agent.csrfToken with the right-hand side value.
    agent.csrfToken = loginRes.body.data.csrfToken;

    // Wait until the asynchronous operation resolves.
    await agent
      // Call .get to perform this step.
      .get('/api/admin/calendar/events?from=2026-08-10T00:00:00.000Z&to=2026-08-17T00:00:00.000Z')
      // Call .expect to perform this step.
      .expect(403);
  });

  // Define a single test case and its expectations.
  test('PATCH /manual-events/:id updates block', async () => {
    // Call calendarService.updateManualEvent.mockResolvedValue to perform this step.
    calendarService.updateManualEvent.mockResolvedValue({
      // Provide the id field value.
      id: 'blocked:9',
      // Provide the type field value.
      type: 'blocked',
      // Provide the car id field value.
      carId: '1',
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.patch('/api/admin/calendar/manual-events/9'))
      // Call .send to perform this step.
      .send({
        // Provide the start field value.
        start: '2026-08-02T10:00:00.000Z',
        // Provide the end field value.
        end: '2026-08-02T14:00:00.000Z',
        // Provide the reason field value.
        reason: 'Service',
      })
      // Call .expect to perform this step.
      .expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.updateManualEvent).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('DELETE /manual-events/:id deletes block', async () => {
    // Call calendarService.deleteManualEvent.mockResolvedValue to perform this step.
    calendarService.deleteManualEvent.mockResolvedValue({ id: '9', deleted: true });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/admin/calendar/manual-events/9')).expect(
      // Supply the literal value used by the enclosing expression.
      200
    );
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.deleteManualEvent).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('DELETE booking block surfaces validation error', async () => {
    // Create the err constant.
    const err = new Error('Cannot delete booking-synced blocks.');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Call calendarService.deleteManualEvent.mockRejectedValue to perform this step.
    calendarService.deleteManualEvent.mockRejectedValue(err);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Wait until the asynchronous operation resolves.
    await withCsrf(agent, agent.delete('/api/admin/calendar/manual-events/3')).expect(422);
  });

  // Define a single test case and its expectations.
  test('PATCH /tasks/:id updates task', async () => {
    // Call calendarService.updateTask.mockResolvedValue to perform this step.
    calendarService.updateTask.mockResolvedValue({ id: '5', title: 'Wash' });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.patch('/api/admin/calendar/tasks/5'))
      // Call .send to perform this step.
      .send({ title: 'Wash' })
      // Call .expect to perform this step.
      .expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.updateTask).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('DELETE /tasks/:id deletes task', async () => {
    // Call calendarService.deleteTask.mockResolvedValue to perform this step.
    calendarService.deleteTask.mockResolvedValue({ id: '5', deleted: true });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/admin/calendar/tasks/5')).expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.deleteTask).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('GET /tasks lists filtered tasks', async () => {
    // Call calendarService.listTasks.mockResolvedValue to perform this step.
    calendarService.listTasks.mockResolvedValue({
      // Provide the tasks field value.
      tasks: [{ id: '1', title: 'Pickup', status: 'pending', taskType: 'pickup' }],
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await agent
      // Call .get to perform this step.
      .get('/api/admin/calendar/tasks?assignee=me&type=pickup')
      // Call .expect to perform this step.
      .expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.listTasks).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(response.body.data.tasks).toHaveLength(1);
  });

  // Define a single test case and its expectations.
  test('GET /assignable-staff returns staff list', async () => {
    // Call calendarService.listAssignableStaff.mockResolvedValue to perform this step.
    calendarService.listAssignableStaff.mockResolvedValue({
      // Provide the users field value.
      users: [{ id: '3', email: 'driver@example.com', roles: [{ slug: 'driver' }] }],
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await agent.get('/api/admin/calendar/assignable-staff').expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.listAssignableStaff).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('POST /tasks creates task', async () => {
    // Call calendarService.createTask.mockResolvedValue to perform this step.
    calendarService.createTask.mockResolvedValue({
      // Provide the id field value.
      id: 'task:1',
      // Provide the type field value.
      type: 'task',
      // Provide the title field value.
      title: 'Airport pickup',
      // Provide the status field value.
      status: 'pending',
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/calendar/tasks'))
      // Call .send to perform this step.
      .send({
        // Provide the title field value.
        title: 'Airport pickup',
        // Provide the task type field value.
        taskType: 'pickup',
      })
      // Call .expect to perform this step.
      .expect(201);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.createTask).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('POST /tasks rejects missing taskType', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Wait until the asynchronous operation resolves.
    await withCsrf(agent, agent.post('/api/admin/calendar/tasks'))
      // Call .send to perform this step.
      .send({ title: 'No type' })
      // Call .expect to perform this step.
      .expect(422);
    // Assert that the value matches the intended expectation.
    expect(calendarService.createTask).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('PATCH /tasks/:id/status updates status', async () => {
    // Call calendarService.updateTaskStatus.mockResolvedValue to perform this step.
    calendarService.updateTaskStatus.mockResolvedValue({
      // Provide the id field value.
      id: '5',
      // Provide the status field value.
      status: 'in_progress',
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.patch('/api/admin/calendar/tasks/5/status'))
      // Call .send to perform this step.
      .send({ status: 'in_progress' })
      // Call .expect to perform this step.
      .expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.updateTaskStatus).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('PATCH /tasks/:id/status rejects legacy done status', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Wait until the asynchronous operation resolves.
    await withCsrf(agent, agent.patch('/api/admin/calendar/tasks/5/status'))
      // Call .send to perform this step.
      .send({ status: 'done' })
      // Call .expect to perform this step.
      .expect(422);
    // Assert that the value matches the intended expectation.
    expect(calendarService.updateTaskStatus).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('POST /reservations/:id/cancel cancels reservation', async () => {
    // Call calendarService.cancelReservationFromCalendar.mockResolvedValue to perform this step.
    calendarService.cancelReservationFromCalendar.mockResolvedValue({
      // Provide the reservation field value.
      reservation: { id: '42', status: 'cancelled' },
      // Provide the changed field value.
      changed: true,
      // Provide the old status field value.
      oldStatus: 'confirmed',
      // Provide the new status field value.
      newStatus: 'cancelled',
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.post to perform this step.
      agent.post('/api/admin/calendar/reservations/42/cancel')
    // Continue the surrounding logic with this statement.
    ).expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(calendarService.cancelReservationFromCalendar).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(response.body.data.newStatus).toBe('cancelled');
  });

  // Define a single test case and its expectations.
  test('POST /reservations/:id/cancel returns 403 without can_cancel_orders', async () => {
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_own_calendar_tasks', 'can_view_reservations_ops'],
      // Provide the role details field value.
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.post to perform this step.
      agent.post('/api/admin/calendar/reservations/42/cancel')
    // Continue the surrounding logic with this statement.
    ).expect(403);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('FORBIDDEN');
    // Assert that the value matches the intended expectation.
    expect(calendarService.cancelReservationFromCalendar).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('POST /tasks returns 403 without can_create_calendar_tasks', async () => {
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_own_calendar_tasks'],
      // Provide the role details field value.
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Wait until the asynchronous operation resolves.
    await withCsrf(agent, agent.post('/api/admin/calendar/tasks'))
      // Call .send to perform this step.
      .send({ title: 'Pickup', taskType: 'pickup' })
      // Call .expect to perform this step.
      .expect(403);
    // Assert that the value matches the intended expectation.
    expect(calendarService.createTask).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('DELETE booking-synced block still rejected by service', async () => {
    // Create the err constant.
    const err = new Error('Cannot delete booking-synced blocks.');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Call calendarService.deleteManualEvent.mockRejectedValue to perform this step.
    calendarService.deleteManualEvent.mockRejectedValue(err);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/admin/calendar/manual-events/9')).expect(
      // Supply the literal value used by the enclosing expression.
      422
    );
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
