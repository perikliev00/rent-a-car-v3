const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApiTestApp, initTestAgent, withCsrf } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

jest.mock('../../../src/services/reservationService', () => ({}));
jest.mock('../../../src/middleware/rateLimit', () =>
  require('../../helpers/rateLimitPassthrough')
);
jest.mock('../../../src/services/rbac/rbacService', () => {
  const base = require('../../helpers/rbacTestAccess').createOwnerRbacMock();
  return base;
});
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('../../../src/modules/calendar/calendar.service', () => ({
  getEvents: jest.fn().mockResolvedValue({ cars: [], events: [], density: 'timeline' }),
  getDay: jest.fn().mockResolvedValue({ date: '2026-08-01', cars: [], pickups: [], returns: [] }),
  getCarTimeline: jest.fn(),
  getAvailability: jest.fn().mockResolvedValue({ available: true, conflicts: [] }),
  getConflicts: jest.fn().mockResolvedValue({ conflicts: [] }),
  getEventDetails: jest.fn(),
  createManualEvent: jest.fn(),
  updateManualEvent: jest.fn(),
  deleteManualEvent: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  updateTaskStatus: jest.fn(),
  moveOrResizeEvent: jest.fn(),
  listTasks: jest.fn().mockResolvedValue({ tasks: [] }),
  listAssignableStaff: jest.fn().mockResolvedValue({ users: [] }),
  cancelReservationFromCalendar: jest.fn(),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userSql = require('../../../src/services/sql/userSqlService');
const calendarService = require('../../../src/modules/calendar/calendar.service');
const rbacService = require('../../../src/services/rbac/rbacService');

describe('Admin calendar API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['owner'],
      permissions: ALL_PERMISSIONS,
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
    calendarService.getEvents.mockResolvedValue({ cars: [], events: [], density: 'timeline' });
    calendarService.getDay.mockResolvedValue({
      date: '2026-08-10',
      cars: [],
      pickups: [],
      returns: [],
    });
    calendarService.getAvailability.mockResolvedValue({ available: true, conflicts: [] });
    calendarService.getConflicts.mockResolvedValue({ conflicts: [] });
  });

  test('GET /api/admin/calendar/events returns payload', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const from = '2026-08-10T00:00:00.000Z';
    const to = '2026-08-17T00:00:00.000Z';
    const response = await agent
      .get(`/api/admin/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(calendarService.getEvents).toHaveBeenCalled();
  });

  test('GET /api/admin/calendar/day/:date returns day ops', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await agent.get('/api/admin/calendar/day/2026-08-10').expect(200);
    expect(response.body.success).toBe(true);
    expect(calendarService.getDay).toHaveBeenCalled();
  });

  test('denies customer without calendar permission', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);
    userSql.findUserByEmail.mockResolvedValue({
      id: 2,
      email: 'user@example.com',
      password: 'hashed',
      role: 'user',
    });
    bcrypt.compare.mockResolvedValue(true);
    rbacService.getUserAccess.mockResolvedValue({
      roles: [],
      permissions: [],
      roleDetails: [],
    });
    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = loginRes.body.data.csrfToken;

    await agent
      .get('/api/admin/calendar/events?from=2026-08-10T00:00:00.000Z&to=2026-08-17T00:00:00.000Z')
      .expect(403);
  });

  test('PATCH /manual-events/:id updates block', async () => {
    calendarService.updateManualEvent.mockResolvedValue({
      id: 'blocked:9',
      type: 'blocked',
      carId: '1',
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.patch('/api/admin/calendar/manual-events/9'))
      .send({
        start: '2026-08-02T10:00:00.000Z',
        end: '2026-08-02T14:00:00.000Z',
        reason: 'Service',
      })
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(calendarService.updateManualEvent).toHaveBeenCalled();
  });

  test('DELETE /manual-events/:id deletes block', async () => {
    calendarService.deleteManualEvent.mockResolvedValue({ id: '9', deleted: true });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.delete('/api/admin/calendar/manual-events/9')).expect(
      200
    );
    expect(response.body.success).toBe(true);
    expect(calendarService.deleteManualEvent).toHaveBeenCalled();
  });

  test('DELETE booking block surfaces validation error', async () => {
    const err = new Error('Cannot delete booking-synced blocks.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    calendarService.deleteManualEvent.mockRejectedValue(err);
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    await withCsrf(agent, agent.delete('/api/admin/calendar/manual-events/3')).expect(422);
  });

  test('PATCH /tasks/:id updates task', async () => {
    calendarService.updateTask.mockResolvedValue({ id: '5', title: 'Wash' });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.patch('/api/admin/calendar/tasks/5'))
      .send({ title: 'Wash' })
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(calendarService.updateTask).toHaveBeenCalled();
  });

  test('DELETE /tasks/:id deletes task', async () => {
    calendarService.deleteTask.mockResolvedValue({ id: '5', deleted: true });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.delete('/api/admin/calendar/tasks/5')).expect(200);
    expect(response.body.success).toBe(true);
    expect(calendarService.deleteTask).toHaveBeenCalled();
  });

  test('GET /tasks lists filtered tasks', async () => {
    calendarService.listTasks.mockResolvedValue({
      tasks: [{ id: '1', title: 'Pickup', status: 'pending', taskType: 'pickup' }],
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await agent
      .get('/api/admin/calendar/tasks?assignee=me&type=pickup')
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(calendarService.listTasks).toHaveBeenCalled();
    expect(response.body.data.tasks).toHaveLength(1);
  });

  test('GET /assignable-staff returns staff list', async () => {
    calendarService.listAssignableStaff.mockResolvedValue({
      users: [{ id: '3', email: 'driver@example.com', roles: [{ slug: 'driver' }] }],
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await agent.get('/api/admin/calendar/assignable-staff').expect(200);
    expect(response.body.success).toBe(true);
    expect(calendarService.listAssignableStaff).toHaveBeenCalled();
  });

  test('POST /tasks creates task', async () => {
    calendarService.createTask.mockResolvedValue({
      id: 'task:1',
      type: 'task',
      title: 'Airport pickup',
      status: 'pending',
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.post('/api/admin/calendar/tasks'))
      .send({
        title: 'Airport pickup',
        taskType: 'pickup',
      })
      .expect(201);
    expect(response.body.success).toBe(true);
    expect(calendarService.createTask).toHaveBeenCalled();
  });

  test('POST /tasks rejects missing taskType', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    await withCsrf(agent, agent.post('/api/admin/calendar/tasks'))
      .send({ title: 'No type' })
      .expect(422);
    expect(calendarService.createTask).not.toHaveBeenCalled();
  });

  test('PATCH /tasks/:id/status updates status', async () => {
    calendarService.updateTaskStatus.mockResolvedValue({
      id: '5',
      status: 'in_progress',
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.patch('/api/admin/calendar/tasks/5/status'))
      .send({ status: 'in_progress' })
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(calendarService.updateTaskStatus).toHaveBeenCalled();
  });

  test('PATCH /tasks/:id/status rejects legacy done status', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    await withCsrf(agent, agent.patch('/api/admin/calendar/tasks/5/status'))
      .send({ status: 'done' })
      .expect(422);
    expect(calendarService.updateTaskStatus).not.toHaveBeenCalled();
  });

  test('POST /reservations/:id/cancel cancels reservation', async () => {
    calendarService.cancelReservationFromCalendar.mockResolvedValue({
      reservation: { id: '42', status: 'cancelled' },
      changed: true,
      oldStatus: 'confirmed',
      newStatus: 'cancelled',
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(
      agent,
      agent.post('/api/admin/calendar/reservations/42/cancel')
    ).expect(200);
    expect(response.body.success).toBe(true);
    expect(calendarService.cancelReservationFromCalendar).toHaveBeenCalled();
    expect(response.body.data.newStatus).toBe('cancelled');
  });

  test('POST /reservations/:id/cancel returns 403 without can_cancel_orders', async () => {
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['driver'],
      permissions: ['can_view_own_calendar_tasks', 'can_view_reservations_ops'],
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(
      agent,
      agent.post('/api/admin/calendar/reservations/42/cancel')
    ).expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(calendarService.cancelReservationFromCalendar).not.toHaveBeenCalled();
  });

  test('POST /tasks returns 403 without can_create_calendar_tasks', async () => {
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['driver'],
      permissions: ['can_view_own_calendar_tasks'],
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    await withCsrf(agent, agent.post('/api/admin/calendar/tasks'))
      .send({ title: 'Pickup', taskType: 'pickup' })
      .expect(403);
    expect(calendarService.createTask).not.toHaveBeenCalled();
  });

  test('DELETE booking-synced block still rejected by service', async () => {
    const err = new Error('Cannot delete booking-synced blocks.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    calendarService.deleteManualEvent.mockRejectedValue(err);
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.delete('/api/admin/calendar/manual-events/9')).expect(
      422
    );
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
