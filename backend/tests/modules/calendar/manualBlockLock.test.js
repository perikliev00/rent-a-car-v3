jest.mock('../../../src/db/transaction', () => ({
  runWithTransaction: jest.fn(async (work) => work({ query: jest.fn() })),
  acquireCarAdvisoryLocks: jest.fn().mockResolvedValue([]),
  clientQuery: jest.fn(),
}));

jest.mock('../../../src/modules/calendar/calendar.repository', () => ({
  findBlockById: jest.fn(),
  createManualBlock: jest.fn(),
  updateManualBlock: jest.fn(),
  deleteManualBlock: jest.fn(),
}));

jest.mock('../../../src/modules/calendar/calendar.conflictEngine', () => ({
  checkReservationRangeConflicts: jest.fn().mockResolvedValue([]),
  assertWritable: jest.fn().mockReturnValue({ conflicts: [], forced: false }),
}));

jest.mock('../../../src/services/rbac/rbacService', () => ({
  userHasPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/modules/calendar/calendar.shared', () => ({
  createHttpError: (code, message, status) => {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
  },
  emitCalendarUpdated: jest.fn(),
}));

jest.mock('../../../src/modules/calendar/calendar.eventMapper', () => ({
  mapBlockEvent: jest.fn((row) => ({ type: 'blocked', id: `blocked:${row.id}` })),
  parseEventId: jest.requireActual('../../../src/modules/calendar/calendar.eventMapper')
    .parseEventId,
}));

const { runWithTransaction, acquireCarAdvisoryLocks } = require('../../../src/db/transaction');
const repo = require('../../../src/modules/calendar/calendar.repository');
const conflictEngine = require('../../../src/modules/calendar/calendar.conflictEngine');
const {
  createManualEvent,
  updateManualEvent,
} = require('../../../src/modules/calendar/manualBlockService');
const { moveOrResizeEvent } = require('../../../src/modules/calendar/calendarMoveService');

describe('manual calendar block car advisory lock', () => {
  const access = { userId: '9', permissions: ['can_create_calendar_blocks'] };
  const req = { session: { user: { id: 9 } } };
  const start = '2030-06-01T07:00:00.000Z';
  const end = '2030-06-05T07:00:00.000Z';

  beforeEach(() => {
    jest.clearAllMocks();
    runWithTransaction.mockImplementation(async (work) => work({ query: jest.fn() }));
    acquireCarAdvisoryLocks.mockResolvedValue([]);
    conflictEngine.checkReservationRangeConflicts.mockResolvedValue([]);
    conflictEngine.assertWritable.mockReturnValue({ conflicts: [], forced: false });
    repo.createManualBlock.mockResolvedValue({
      id: 55,
      car_id: 7,
      block_type: 'manual',
      start_date: start,
      end_date: end,
    });
    repo.updateManualBlock.mockResolvedValue({
      id: 12,
      car_id: 3,
      block_type: 'manual',
      start_date: start,
      end_date: end,
    });
  });

  test('createManualEvent locks the car before conflict check and insert', async () => {
    const calls = [];
    acquireCarAdvisoryLocks.mockImplementation(async () => {
      calls.push('lock');
    });
    conflictEngine.checkReservationRangeConflicts.mockImplementation(async () => {
      calls.push('check');
      return [];
    });
    repo.createManualBlock.mockImplementation(async () => {
      calls.push('insert');
      return {
        id: 55,
        car_id: 7,
        block_type: 'manual',
        start_date: start,
        end_date: end,
      };
    });

    await createManualEvent(
      access,
      { carId: 7, start, end, blockType: 'manual' },
      req
    );

    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(expect.any(Object), [7]);
    expect(conflictEngine.checkReservationRangeConflicts).toHaveBeenCalledWith(
      expect.objectContaining({
        carId: 7,
        client: expect.any(Object),
      })
    );
    expect(repo.createManualBlock).toHaveBeenCalledWith(
      expect.objectContaining({ carId: 7 }),
      expect.any(Object)
    );
    expect(calls).toEqual(['lock', 'check', 'insert']);
  });

  test('updateManualEvent locks previous and target cars before conflict check', async () => {
    const calls = [];
    repo.findBlockById.mockResolvedValue({
      id: 12,
      car_id: 5,
      block_type: 'manual',
      start_date: start,
      end_date: end,
      reason: null,
      notes: null,
    });
    acquireCarAdvisoryLocks.mockImplementation(async () => {
      calls.push('lock');
    });
    conflictEngine.checkReservationRangeConflicts.mockImplementation(async () => {
      calls.push('check');
      return [];
    });
    repo.updateManualBlock.mockImplementation(async () => {
      calls.push('update');
      return {
        id: 12,
        car_id: 3,
        block_type: 'manual',
        start_date: start,
        end_date: end,
      };
    });

    await updateManualEvent(
      access,
      12,
      { carId: 3, start, end },
      req
    );

    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(expect.any(Object), [5, 3]);
    expect(conflictEngine.checkReservationRangeConflicts).toHaveBeenCalledWith(
      expect.objectContaining({
        carId: 3,
        excludeBlockId: 12,
        client: expect.any(Object),
      })
    );
    expect(calls[0]).toBe('lock');
    expect(calls.indexOf('lock')).toBeLessThan(calls.indexOf('check'));
    expect(calls.indexOf('check')).toBeLessThan(calls.indexOf('update'));
  });

  test('moveOrResizeEvent locks both cars for blocked events before write', async () => {
    const calls = [];
    repo.findBlockById.mockResolvedValue({
      id: 12,
      car_id: 8,
      block_type: 'manual',
      start_date: start,
      end_date: end,
    });
    acquireCarAdvisoryLocks.mockImplementation(async () => {
      calls.push('lock');
    });
    conflictEngine.checkReservationRangeConflicts.mockImplementation(async () => {
      calls.push('check');
      return [];
    });
    repo.updateManualBlock.mockImplementation(async () => {
      calls.push('update');
      return {
        id: 12,
        car_id: 4,
        block_type: 'manual',
        start_date: start,
        end_date: end,
      };
    });

    await moveOrResizeEvent(
      access,
      'blocked:12',
      { carId: 4, start, end },
      req,
      'move'
    );

    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(expect.any(Object), [8, 4]);
    expect(conflictEngine.checkReservationRangeConflicts).toHaveBeenCalledWith(
      expect.objectContaining({
        carId: 4,
        excludeBlockId: '12',
        client: expect.any(Object),
      })
    );
    expect(calls).toEqual(['lock', 'check', 'update']);
  });
});
