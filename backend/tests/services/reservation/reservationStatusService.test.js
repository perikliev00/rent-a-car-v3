jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  findByIdForUpdate: jest.fn(),
  applyStatusChange: jest.fn(),
}));
jest.mock('../../../src/services/sql/reservationStatusHistorySqlService', () => ({
  insertStatusHistory: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/sql/refundOperationSqlService', () => ({
  findActiveByReservationId: jest.fn(),
}));
jest.mock('../../../src/services/carFleetSyncService', () => ({
  syncCarStatusFromReservation: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/sql/bookingSyncSqlService', () => ({
  removeRange: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/admin/order/orderConflictService', () => ({
  resolveStoredDateRange: jest.fn().mockResolvedValue({
    storedStart: new Date('2030-01-01'),
    storedEnd: new Date('2030-01-05'),
  }),
}));
jest.mock('../../../src/services/admin/order/orderReservationSync', () => ({
  softDeleteOrderForReservation: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  logCustomerAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/db/transaction', () => ({
  runWithTransaction: async (fn) => fn(null),
}));

const reservationSql = require('../../../src/services/sql/reservationSqlService');
const refundOpSql = require('../../../src/services/sql/refundOperationSqlService');
const { changeStatus } = require('../../../src/services/reservation/reservationStatusService');

describe('changeStatus pending-refund gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reservationSql.applyStatusChange.mockImplementation(async ({ reservationId, newStatus }) => ({
      id: reservationId,
      status: newStatus,
      carId: 3,
      pickupDate: '2030-01-01',
      returnDate: '2030-01-05',
    }));
  });

  test('pending refund + picked_up → REFUND_IN_PROGRESS', async () => {
    reservationSql.findByIdForUpdate.mockResolvedValue({
      id: 1,
      status: 'car_prepared',
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      id: 10,
      status: 'pending',
    });

    await expect(
      changeStatus({ reservationId: 1, newStatus: 'picked_up' })
    ).rejects.toMatchObject({
      code: 'REFUND_IN_PROGRESS',
      status: 409,
    });
    expect(reservationSql.applyStatusChange).not.toHaveBeenCalled();
  });

  test('pending refund + cancelled → REFUND_IN_PROGRESS', async () => {
    reservationSql.findByIdForUpdate.mockResolvedValue({
      id: 1,
      status: 'confirmed',
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      id: 10,
      status: 'pending',
    });

    await expect(
      changeStatus({ reservationId: 1, newStatus: 'cancelled' })
    ).rejects.toMatchObject({
      code: 'REFUND_IN_PROGRESS',
      status: 409,
    });
    expect(reservationSql.applyStatusChange).not.toHaveBeenCalled();
  });

  test('pending refund + refunded still allowed', async () => {
    reservationSql.findByIdForUpdate.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      carId: 3,
      pickupDate: '2030-01-01',
      returnDate: '2030-01-05',
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      id: 10,
      status: 'pending',
    });

    const result = await changeStatus({ reservationId: 1, newStatus: 'refunded' });
    expect(result.changed).toBe(true);
    expect(result.newStatus).toBe('refunded');
  });

  test('pending refund + car_prepared still allowed', async () => {
    reservationSql.findByIdForUpdate.mockResolvedValue({
      id: 1,
      status: 'confirmed',
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      id: 10,
      status: 'pending',
    });

    const result = await changeStatus({ reservationId: 1, newStatus: 'car_prepared' });
    expect(result.changed).toBe(true);
    expect(result.newStatus).toBe('car_prepared');
  });

  test('no pending op → car_prepared → picked_up still allowed', async () => {
    reservationSql.findByIdForUpdate.mockResolvedValue({
      id: 1,
      status: 'car_prepared',
    });
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);

    const result = await changeStatus({ reservationId: 1, newStatus: 'picked_up' });
    expect(result.changed).toBe(true);
    expect(result.newStatus).toBe('picked_up');
  });
});
