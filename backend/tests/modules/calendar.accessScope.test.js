// Call jest.mock to perform this step.
jest.mock('../../src/modules/calendar/calendar.repository', () => ({
  // Provide the find reservation by id field value.
  findReservationById: jest.fn(),
  // Provide the has assigned task field value.
  hasAssignedTask: jest.fn(),
  // Provide the find task by id field value.
  findTaskById: jest.fn(),
  // Provide the find block by id field value.
  findBlockById: jest.fn(),
  // Provide the map task field value.
  mapTask: jest.fn((row) => ({ id: String(row.id), status: row.status })),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/rbac/rbacService', () => ({
  // Provide the user has permission field value.
  userHasPermission: jest.fn((access, key) => (access.permissions || []).includes(key)),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/db/transaction', () => ({
  // Provide the client query field value.
  clientQuery: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/modules/realtime', () => ({
  // Provide the emit calendar updated field value.
  emitCalendarUpdated: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn(),
  // Provide the can transition field value.
  canTransition: jest.fn(() => true),
}));

// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/reservationSqlService', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));

// Require the '../../src/modules/calendar/calendar.repository' module as repo.
const repo = require('../../src/modules/calendar/calendar.repository');
// Destructure object properties into local variables.
const { getEventDetails, cancelReservationFromCalendar } = require('../../src/modules/calendar/calendar.service');

// Declare a test suite grouping related cases.
describe('calendar.service access scope', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('getEventDetails forbids own-only user without assigned task', async () => {
    // Call repo.findReservationById.mockResolvedValue to perform this step.
    repo.findReservationById.mockResolvedValue({
      // Provide the id field value.
      id: 42,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the car id field value.
      car_id: 1,
      // Provide the full name field value.
      full_name: 'Secret',
      // Provide the email field value.
      email: 'secret@example.com',
    });
    // Call repo.hasAssignedTask.mockResolvedValue to perform this step.
    repo.hasAssignedTask.mockResolvedValue(false);

    // Create the access constant.
    const access = {
      // Provide the user id field value.
      userId: '9',
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_own_calendar_tasks'],
    };

    // Wait until the asynchronous operation resolves.
    await expect(getEventDetails(access, 'reservation:42')).rejects.toMatchObject({
      // Provide the code field value.
      code: 'FORBIDDEN',
      // Provide the status field value.
      status: 403,
    });
  });

  // Define a single test case and its expectations.
  test('getEventDetails allows own-only user with assigned task', async () => {
    // Call repo.findReservationById.mockResolvedValue to perform this step.
    repo.findReservationById.mockResolvedValue({
      // Provide the id field value.
      id: 42,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the car id field value.
      car_id: 1,
      // Provide the car name field value.
      car_name: 'BMW',
      // Provide the full name field value.
      full_name: 'Ada',
      // Provide the email field value.
      email: 'ada@example.com',
      // Provide the pickup date field value.
      pickup_date: '2026-08-10',
      // Provide the return date field value.
      return_date: '2026-08-12',
      // Provide the pickup location field value.
      pickup_location: 'office',
      // Provide the return location field value.
      return_location: 'office',
    });
    // Call repo.hasAssignedTask.mockResolvedValue to perform this step.
    repo.hasAssignedTask.mockResolvedValue(true);

    // Create the access constant.
    const access = {
      // Provide the user id field value.
      userId: '9',
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_own_calendar_tasks'],
    };

    // Create the data constant.
    const data = await getEventDetails(access, 'reservation:42');
    // Assert that the value matches the intended expectation.
    expect(data.reservation.fullName).toBe('Ada');
    // Assert that the value matches the intended expectation.
    expect(data.actions.canCancel).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(data.actions.canChangeStatus).toBe(false);
  });

  // Define a single test case and its expectations.
  test('cancelReservationFromCalendar requires can_cancel_orders', async () => {
    // Create the access constant.
    const access = {
      // Provide the user id field value.
      userId: '1',
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_reservations_ops', 'can_move_calendar_reservations'],
    };

    // Wait until the asynchronous operation resolves.
    await expect(cancelReservationFromCalendar(access, 42, {})).rejects.toMatchObject({
      // Provide the code field value.
      code: 'FORBIDDEN',
      // Provide the status field value.
      status: 403,
    });
  });
});
