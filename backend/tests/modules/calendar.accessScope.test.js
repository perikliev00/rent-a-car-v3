jest.mock('../../src/modules/calendar/calendar.repository', () => ({
  findReservationById: jest.fn(),
  hasAssignedTask: jest.fn(),
  findTaskById: jest.fn(),
  findBlockById: jest.fn(),
  mapTask: jest.fn((row) => ({ id: String(row.id), status: row.status })),
}));

jest.mock('../../src/services/rbac/rbacService', () => ({
  userHasPermission: jest.fn((access, key) => (access.permissions || []).includes(key)),
}));

jest.mock('../../src/db/transaction', () => ({
  clientQuery: jest.fn(),
}));

jest.mock('../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn(),
}));

jest.mock('../../src/modules/realtime', () => ({
  emitCalendarUpdated: jest.fn(),
}));

jest.mock('../../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn(),
  canTransition: jest.fn(() => true),
}));

jest.mock('../../src/services/sql/reservationSqlService', () => ({
  findById: jest.fn(),
}));

const repo = require('../../src/modules/calendar/calendar.repository');
const { getEventDetails, cancelReservationFromCalendar } = require('../../src/modules/calendar/calendar.service');

describe('calendar.service access scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getEventDetails forbids own-only user without assigned task', async () => {
    repo.findReservationById.mockResolvedValue({
      id: 42,
      status: 'confirmed',
      car_id: 1,
      full_name: 'Secret',
      email: 'secret@example.com',
    });
    repo.hasAssignedTask.mockResolvedValue(false);

    const access = {
      userId: '9',
      roles: ['driver'],
      permissions: ['can_view_own_calendar_tasks'],
    };

    await expect(getEventDetails(access, 'reservation:42')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  test('getEventDetails allows own-only user with assigned task', async () => {
    repo.findReservationById.mockResolvedValue({
      id: 42,
      status: 'confirmed',
      car_id: 1,
      car_name: 'BMW',
      full_name: 'Ada',
      email: 'ada@example.com',
      pickup_date: '2026-08-10',
      return_date: '2026-08-12',
      pickup_location: 'office',
      return_location: 'office',
    });
    repo.hasAssignedTask.mockResolvedValue(true);

    const access = {
      userId: '9',
      roles: ['driver'],
      permissions: ['can_view_own_calendar_tasks'],
    };

    const data = await getEventDetails(access, 'reservation:42');
    expect(data.reservation.fullName).toBe('Ada');
    expect(data.actions.canCancel).toBe(false);
    expect(data.actions.canChangeStatus).toBe(false);
  });

  test('cancelReservationFromCalendar requires can_cancel_orders', async () => {
    const access = {
      userId: '1',
      roles: ['driver'],
      permissions: ['can_view_reservations_ops', 'can_move_calendar_reservations'],
    };

    await expect(cancelReservationFromCalendar(access, 42, {})).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });
});
