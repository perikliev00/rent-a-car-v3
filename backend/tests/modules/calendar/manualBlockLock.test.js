// Call jest.mock to perform this step.
jest.mock('../../../src/db/transaction', () => ({
  // Provide the run with transaction field value.
  runWithTransaction: jest.fn(async (work) => work({ query: jest.fn() })),
  // Provide the acquire car advisory locks field value.
  acquireCarAdvisoryLocks: jest.fn().mockResolvedValue([]),
  // Provide the client query field value.
  clientQuery: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/modules/calendar/calendar.repository', () => ({
  // Provide the find block by id field value.
  findBlockById: jest.fn(),
  // Provide the create manual block field value.
  createManualBlock: jest.fn(),
  // Provide the update manual block field value.
  updateManualBlock: jest.fn(),
  // Provide the delete manual block field value.
  deleteManualBlock: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/modules/calendar/calendar.conflictEngine', () => ({
  // Provide the check reservation range conflicts field value.
  checkReservationRangeConflicts: jest.fn().mockResolvedValue([]),
  // Provide the assert writable field value.
  assertWritable: jest.fn().mockReturnValue({ conflicts: [], forced: false }),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/services/rbac/rbacService', () => ({
  // Provide the user has permission field value.
  userHasPermission: jest.fn().mockReturnValue(true),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/modules/calendar/calendar.shared', () => ({
  // Provide the create http error field value.
  createHttpError: (code, message, status) => {
    // Create the err constant.
    const err = new Error(message);
    // Update err.code with the right-hand side value.
    err.code = code;
    // Update err.status with the right-hand side value.
    err.status = status;
    // Return the resulting value to the caller.
    return err;
  },
  // Provide the emit calendar updated field value.
  emitCalendarUpdated: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/modules/calendar/calendar.eventMapper', () => ({
  // Provide the map block event field value.
  mapBlockEvent: jest.fn((row) => ({ type: 'blocked', id: `blocked:${row.id}` })),
  // Provide the parse event id field value.
  parseEventId: jest.requireActual('../../../src/modules/calendar/calendar.eventMapper')
    // Continue the chained call started on the previous line.
    .parseEventId,
}));

// Destructure object properties into local variables.
const { runWithTransaction, acquireCarAdvisoryLocks } = require('../../../src/db/transaction');
// Require the '../../../src/modules/calendar/calendar.repository' module as repo.
const repo = require('../../../src/modules/calendar/calendar.repository');
// Require the '../../../src/modules/calendar/calendar.conflictEngine' module as conflictEngine.
const conflictEngine = require('../../../src/modules/calendar/calendar.conflictEngine');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  updateManualEvent,
// Continue the surrounding logic with this statement.
} = require('../../../src/modules/calendar/manualBlockService');
// Destructure object properties into local variables.
const { moveOrResizeEvent } = require('../../../src/modules/calendar/calendarMoveService');

// Declare a test suite grouping related cases.
describe('manual calendar block car advisory lock', () => {
  // Create the access constant.
  const access = { userId: '9', permissions: ['can_create_calendar_blocks'] };
  // Create the req constant.
  const req = { session: { user: { id: 9 } } };
  // Create the start constant.
  const start = '2030-06-01T07:00:00.000Z';
  // Create the end constant.
  const end = '2030-06-05T07:00:00.000Z';

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call runWithTransaction.mockImplementation to perform this step.
    runWithTransaction.mockImplementation(async (work) => work({ query: jest.fn() }));
    // Call acquireCarAdvisoryLocks.mockResolvedValue to perform this step.
    acquireCarAdvisoryLocks.mockResolvedValue([]);
    // Call conflictEngine.checkReservationRangeConflicts.mockResolvedValue to perform this step.
    conflictEngine.checkReservationRangeConflicts.mockResolvedValue([]);
    // Call conflictEngine.assertWritable.mockReturnValue to perform this step.
    conflictEngine.assertWritable.mockReturnValue({ conflicts: [], forced: false });
    // Call repo.createManualBlock.mockResolvedValue to perform this step.
    repo.createManualBlock.mockResolvedValue({
      // Provide the id field value.
      id: 55,
      // Provide the car id field value.
      car_id: 7,
      // Provide the block type field value.
      block_type: 'manual',
      // Provide the start date field value.
      start_date: start,
      // Provide the end date field value.
      end_date: end,
    });
    // Call repo.updateManualBlock.mockResolvedValue to perform this step.
    repo.updateManualBlock.mockResolvedValue({
      // Provide the id field value.
      id: 12,
      // Provide the car id field value.
      car_id: 3,
      // Provide the block type field value.
      block_type: 'manual',
      // Provide the start date field value.
      start_date: start,
      // Provide the end date field value.
      end_date: end,
    });
  });

  // Define a single test case and its expectations.
  test('createManualEvent locks the car before conflict check and insert', async () => {
    // Create the calls constant.
    const calls = [];
    // Call acquireCarAdvisoryLocks.mockImplementation to perform this step.
    acquireCarAdvisoryLocks.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('lock');
    });
    // Call conflictEngine.checkReservationRangeConflicts.mockImplementation to perform this step.
    conflictEngine.checkReservationRangeConflicts.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('check');
      // Return the resulting value to the caller.
      return [];
    });
    // Call repo.createManualBlock.mockImplementation to perform this step.
    repo.createManualBlock.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('insert');
      // Return the resulting value to the caller.
      return {
        // Provide the id field value.
        id: 55,
        // Provide the car id field value.
        car_id: 7,
        // Provide the block type field value.
        block_type: 'manual',
        // Provide the start date field value.
        start_date: start,
        // Provide the end date field value.
        end_date: end,
      };
    });

    // Wait until the asynchronous operation resolves.
    await createManualEvent(
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Contribute this line to the enclosing declaration or statement.
      { carId: 7, start, end, blockType: 'manual' },
      // Reference the identifier used by the enclosing expression.
      req
    );

    // Assert that the value matches the intended expectation.
    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(expect.any(Object), [7]);
    // Assert that the value matches the intended expectation.
    expect(conflictEngine.checkReservationRangeConflicts).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the car id field value.
        carId: 7,
        // Provide the client field value.
        client: expect.any(Object),
      })
    );
    // Assert that the value matches the intended expectation.
    expect(repo.createManualBlock).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ carId: 7 }),
      // Call expect.any to perform this step.
      expect.any(Object)
    );
    // Assert that the value matches the intended expectation.
    expect(calls).toEqual(['lock', 'check', 'insert']);
  });

  // Define a single test case and its expectations.
  test('updateManualEvent locks previous and target cars before conflict check', async () => {
    // Create the calls constant.
    const calls = [];
    // Call repo.findBlockById.mockResolvedValue to perform this step.
    repo.findBlockById.mockResolvedValue({
      // Provide the id field value.
      id: 12,
      // Provide the car id field value.
      car_id: 5,
      // Provide the block type field value.
      block_type: 'manual',
      // Provide the start date field value.
      start_date: start,
      // Provide the end date field value.
      end_date: end,
      // Provide the reason field value.
      reason: null,
      // Provide the notes field value.
      notes: null,
    });
    // Call acquireCarAdvisoryLocks.mockImplementation to perform this step.
    acquireCarAdvisoryLocks.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('lock');
    });
    // Call conflictEngine.checkReservationRangeConflicts.mockImplementation to perform this step.
    conflictEngine.checkReservationRangeConflicts.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('check');
      // Return the resulting value to the caller.
      return [];
    });
    // Call repo.updateManualBlock.mockImplementation to perform this step.
    repo.updateManualBlock.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('update');
      // Return the resulting value to the caller.
      return {
        // Provide the id field value.
        id: 12,
        // Provide the car id field value.
        car_id: 3,
        // Provide the block type field value.
        block_type: 'manual',
        // Provide the start date field value.
        start_date: start,
        // Provide the end date field value.
        end_date: end,
      };
    });

    // Wait until the asynchronous operation resolves.
    await updateManualEvent(
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Supply the literal value used by the enclosing expression.
      12,
      // Contribute this line to the enclosing declaration or statement.
      { carId: 3, start, end },
      // Reference the identifier used by the enclosing expression.
      req
    );

    // Assert that the value matches the intended expectation.
    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(expect.any(Object), [5, 3]);
    // Assert that the value matches the intended expectation.
    expect(conflictEngine.checkReservationRangeConflicts).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the car id field value.
        carId: 3,
        // Provide the exclude block id field value.
        excludeBlockId: 12,
        // Provide the client field value.
        client: expect.any(Object),
      })
    );
    // Assert that the value matches the intended expectation.
    expect(calls[0]).toBe('lock');
    // Assert that the value matches the intended expectation.
    expect(calls.indexOf('lock')).toBeLessThan(calls.indexOf('check'));
    // Assert that the value matches the intended expectation.
    expect(calls.indexOf('check')).toBeLessThan(calls.indexOf('update'));
  });

  // Define a single test case and its expectations.
  test('moveOrResizeEvent locks both cars for blocked events before write', async () => {
    // Create the calls constant.
    const calls = [];
    // Call repo.findBlockById.mockResolvedValue to perform this step.
    repo.findBlockById.mockResolvedValue({
      // Provide the id field value.
      id: 12,
      // Provide the car id field value.
      car_id: 8,
      // Provide the block type field value.
      block_type: 'manual',
      // Provide the start date field value.
      start_date: start,
      // Provide the end date field value.
      end_date: end,
    });
    // Call acquireCarAdvisoryLocks.mockImplementation to perform this step.
    acquireCarAdvisoryLocks.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('lock');
    });
    // Call conflictEngine.checkReservationRangeConflicts.mockImplementation to perform this step.
    conflictEngine.checkReservationRangeConflicts.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('check');
      // Return the resulting value to the caller.
      return [];
    });
    // Call repo.updateManualBlock.mockImplementation to perform this step.
    repo.updateManualBlock.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('update');
      // Return the resulting value to the caller.
      return {
        // Provide the id field value.
        id: 12,
        // Provide the car id field value.
        car_id: 4,
        // Provide the block type field value.
        block_type: 'manual',
        // Provide the start date field value.
        start_date: start,
        // Provide the end date field value.
        end_date: end,
      };
    });

    // Wait until the asynchronous operation resolves.
    await moveOrResizeEvent(
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Supply the literal value used by the enclosing expression.
      'blocked:12',
      // Contribute this line to the enclosing declaration or statement.
      { carId: 4, start, end },
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Supply the literal value used by the enclosing expression.
      'move'
    );

    // Assert that the value matches the intended expectation.
    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(expect.any(Object), [8, 4]);
    // Assert that the value matches the intended expectation.
    expect(conflictEngine.checkReservationRangeConflicts).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the car id field value.
        carId: 4,
        // Provide the exclude block id field value.
        excludeBlockId: '12',
        // Provide the client field value.
        client: expect.any(Object),
      })
    );
    // Assert that the value matches the intended expectation.
    expect(calls).toEqual(['lock', 'check', 'update']);
  });
});
