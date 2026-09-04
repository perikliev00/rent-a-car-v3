jest.mock('../../../../src/db/transaction', () => ({
  acquireCarAdvisoryLocks: jest.fn().mockResolvedValue([]),
  runWithOptionalTransaction: jest.fn(async (fn) => fn({ query: jest.fn() })),
}));

jest.mock('../../../../src/services/sql/bookingSyncSqlService', () => ({
  purgeExpired: jest.fn().mockResolvedValue(undefined),
  addRange: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../src/repositories/carRepository', () => ({
  findByIdForAdmin: jest.fn().mockResolvedValue({ id: 7, name: 'Yaris', isDeleted: false }),
}));

jest.mock('../../../../src/repositories/reservationRepository', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../../src/services/sql/orderSqlService', () => ({
  findOrderById: jest.fn(),
  updateOrderFromDoc: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../src/services/admin/order/orderConflictService', () => ({
  assertNoActiveReservationHold: jest.fn().mockResolvedValue(undefined),
  assertNoOpenPhysicalRental: jest.fn().mockResolvedValue(undefined),
  RESERVATION_CONFLICT_MESSAGE: 'hold conflict',
}));

jest.mock('../../../../src/services/admin/order/orderReservationLinkService', () => ({
  ensureLinkedConfirmedReservation: jest.fn().mockResolvedValue({ id: 99 }),
}));

jest.mock('../../../../src/services/admin/order/orderReservationSync', () => ({
  syncLinkedReservationAfterOrderUpdate: jest.fn().mockResolvedValue(undefined),
}));

const { addRange } = require('../../../../src/services/sql/bookingSyncSqlService');
const orderSql = require('../../../../src/services/sql/orderSqlService');
const reservationRepository = require('../../../../src/repositories/reservationRepository');
const {
  assertNoOpenPhysicalRental,
} = require('../../../../src/services/admin/order/orderConflictService');
const { syncLinkedReservationAfterOrderUpdate } = require('../../../../src/services/admin/order/orderReservationSync');
const { ensureLinkedConfirmedReservation } = require('../../../../src/services/admin/order/orderReservationLinkService');
const { restoreOrder } = require('../../../../src/services/admin/order/orderRestoreService');
const { OrderFormError } = require('../../../../src/services/admin/order/orderErrors');

describe('restoreOrder open physical rental guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderSql.findOrderById.mockResolvedValue({
      id: 21,
      carId: 7,
      reservationId: 55,
      isDeleted: true,
      deletedAt: new Date(),
      pickupDate: new Date('2030-08-01T07:00:00.000Z'),
      pickupTime: '10:00',
      returnDate: new Date('2030-08-05T07:00:00.000Z'),
      returnTime: '10:00',
      status: 'active',
    });
    reservationRepository.findById.mockResolvedValue({ id: 55, status: 'confirmed' });
    assertNoOpenPhysicalRental.mockResolvedValue(undefined);
  });

  test('rejects restore when another open physical rental exists', async () => {
    assertNoOpenPhysicalRental.mockRejectedValue(
      new OrderFormError(
        'OPEN_PHYSICAL_RENTAL',
        'Selected car has an open rental (picked up / active) and cannot be booked until it is returned.'
      )
    );

    await expect(restoreOrder(21)).rejects.toMatchObject({
      isOrderRestoreError: true,
      code: 'OPEN_PHYSICAL_RENTAL',
    });

    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith(
      7,
      expect.anything(),
      { excludeReservationId: 55 }
    );
    expect(addRange).not.toHaveBeenCalled();
    expect(orderSql.updateOrderFromDoc).not.toHaveBeenCalled();
    expect(syncLinkedReservationAfterOrderUpdate).not.toHaveBeenCalled();
    expect(ensureLinkedConfirmedReservation).not.toHaveBeenCalled();
  });

  test('excludes the restored order linked reservationId', async () => {
    await restoreOrder(21);

    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith(
      7,
      expect.anything(),
      { excludeReservationId: 55 }
    );
    expect(addRange).toHaveBeenCalled();
  });
});
