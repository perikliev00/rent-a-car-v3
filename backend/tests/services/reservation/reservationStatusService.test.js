// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  // Provide the find by id for update field value.
  findByIdForUpdate: jest.fn(),
  // Provide the apply status change field value.
  applyStatusChange: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/reservationStatusHistorySqlService', () => ({
  // Provide the insert status history field value.
  insertStatusHistory: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/refundOperationSqlService', () => ({
  // Provide the find active by reservation id field value.
  findActiveByReservationId: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/carFleetSyncService', () => ({
  // Provide the sync car status from reservation field value.
  syncCarStatusFromReservation: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/bookingSyncSqlService', () => ({
  // Provide the remove range field value.
  removeRange: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/order/orderConflictService', () => ({
  // Provide the resolve stored date range field value.
  resolveStoredDateRange: jest.fn().mockResolvedValue({
    // Provide the stored start field value.
    storedStart: new Date('2030-01-01'),
    // Provide the stored end field value.
    storedEnd: new Date('2030-01-05'),
  }),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/order/orderReservationSync', () => ({
  // Provide the soft delete order for reservation field value.
  softDeleteOrderForReservation: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
  // Provide the log system action field value.
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  // Provide the log customer action field value.
  logCustomerAction: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/db/transaction', () => ({
  // Provide the run with transaction field value.
  runWithTransaction: async (fn) => fn(null),
}));

// Require the '../../../src/services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../../src/services/sql/reservationSqlService');
// Require the '../../../src/services/sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../../src/services/sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../../src/services/reservation/reservationStatusService');

// Declare a test suite grouping related cases.
describe('changeStatus pending-refund gate', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call reservationSql.applyStatusChange.mockImplementation to perform this step.
    reservationSql.applyStatusChange.mockImplementation(async ({ reservationId, newStatus }) => ({
      // Provide the id field value.
      id: reservationId,
      // Provide the status field value.
      status: newStatus,
      // Provide the car id field value.
      carId: 3,
      // Provide the pickup date field value.
      pickupDate: '2030-01-01',
      // Provide the return date field value.
      returnDate: '2030-01-05',
    }));
  });

  // Define a single test case and its expectations.
  test('pending refund + picked_up → REFUND_IN_PROGRESS', async () => {
    // Call reservationSql.findByIdForUpdate.mockResolvedValue to perform this step.
    reservationSql.findByIdForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'car_prepared',
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
    });

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call changeStatus to perform this step.
      changeStatus({ reservationId: 1, newStatus: 'picked_up' })
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_IN_PROGRESS',
      // Provide the status field value.
      status: 409,
    });
    // Assert that the value matches the intended expectation.
    expect(reservationSql.applyStatusChange).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('pending refund + cancelled → REFUND_IN_PROGRESS', async () => {
    // Call reservationSql.findByIdForUpdate.mockResolvedValue to perform this step.
    reservationSql.findByIdForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
    });

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call changeStatus to perform this step.
      changeStatus({ reservationId: 1, newStatus: 'cancelled' })
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_IN_PROGRESS',
      // Provide the status field value.
      status: 409,
    });
    // Assert that the value matches the intended expectation.
    expect(reservationSql.applyStatusChange).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('pending refund + refunded still allowed', async () => {
    // Call reservationSql.findByIdForUpdate.mockResolvedValue to perform this step.
    reservationSql.findByIdForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the car id field value.
      carId: 3,
      // Provide the pickup date field value.
      pickupDate: '2030-01-01',
      // Provide the return date field value.
      returnDate: '2030-01-05',
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
    });

    // Create the result constant.
    const result = await changeStatus({ reservationId: 1, newStatus: 'refunded' });
    // Assert that the value matches the intended expectation.
    expect(result.changed).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.newStatus).toBe('refunded');
  });

  // Define a single test case and its expectations.
  test('pending refund + car_prepared still allowed', async () => {
    // Call reservationSql.findByIdForUpdate.mockResolvedValue to perform this step.
    reservationSql.findByIdForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
    });

    // Create the result constant.
    const result = await changeStatus({ reservationId: 1, newStatus: 'car_prepared' });
    // Assert that the value matches the intended expectation.
    expect(result.changed).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.newStatus).toBe('car_prepared');
  });

  // Define a single test case and its expectations.
  test('no pending op → car_prepared → picked_up still allowed', async () => {
    // Call reservationSql.findByIdForUpdate.mockResolvedValue to perform this step.
    reservationSql.findByIdForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'car_prepared',
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);

    // Create the result constant.
    const result = await changeStatus({ reservationId: 1, newStatus: 'picked_up' });
    // Assert that the value matches the intended expectation.
    expect(result.changed).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.newStatus).toBe('picked_up');
  });
});
