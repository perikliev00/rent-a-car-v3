jest.mock('../../../src/db/transaction', () => ({
  acquireCarAdvisoryLocks: jest.fn().mockResolvedValue([]),
  runWithTransaction: jest.fn(async (fn) => fn({ query: jest.fn() })),
}));

jest.mock('../../../src/services/sql/bookingSyncSqlService', () => ({
  addRange: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/services/sql/orderSqlService', () => ({
  createOrderFromReservation: jest.fn().mockResolvedValue({ id: 44 }),
}));

jest.mock('../../../src/services/sql/reservationStatusHistorySqlService', () => ({
  listHistoryForReservation: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../src/repositories/reservationRepository', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn().mockResolvedValue({
    reservation: { id: 12, status: 'confirmed' },
  }),
}));

jest.mock('../../../src/services/admin/order/orderConflictService', () => ({
  assertNoActiveReservationHold: jest.fn().mockResolvedValue(undefined),
  assertNoOpenPhysicalRental: jest.fn().mockResolvedValue(undefined),
}));

const { addRange } = require('../../../src/services/sql/bookingSyncSqlService');
const orderSql = require('../../../src/services/sql/orderSqlService');
const reservationRepository = require('../../../src/repositories/reservationRepository');
const { changeStatus } = require('../../../src/services/reservation/reservationStatusService');
const {
  assertNoOpenPhysicalRental,
} = require('../../../src/services/admin/order/orderConflictService');
const {
  changeReservationStatus,
} = require('../../../src/services/admin/reservationAdminService');
const { OrderFormError } = require('../../../src/services/admin/order/orderErrors');

describe('confirmManualReviewReservation open physical rental guard', () => {
  const reservation = {
    id: 12,
    carId: 7,
    pickupDate: new Date('2030-09-01T07:00:00.000Z'),
    returnDate: new Date('2030-09-05T07:00:00.000Z'),
    status: 'manual_review',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reservationRepository.findById.mockResolvedValue(reservation);
    assertNoOpenPhysicalRental.mockResolvedValue(undefined);
  });

  test('rejects confirmation when another open physical rental exists', async () => {
    assertNoOpenPhysicalRental.mockRejectedValue(
      new OrderFormError(
        'OPEN_PHYSICAL_RENTAL',
        'Selected car has an open rental (picked up / active) and cannot be booked until it is returned.'
      )
    );

    await expect(
      changeReservationStatus(
        { session: { user: { id: 1 } } },
        { reservationId: 12, status: 'confirmed', reason: 'test' }
      )
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
      message:
        'Selected car has an open rental (picked up / active) and cannot be booked until it is returned.',
    });

    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith(7, expect.anything(), {
      excludeReservationId: 12,
    });
    expect(addRange).not.toHaveBeenCalled();
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalled();
  });

  test('excludes the reservation being confirmed', async () => {
    await changeReservationStatus(
      { session: { user: { id: 1 } } },
      { reservationId: 12, status: 'confirmed', reason: 'ok' }
    );

    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith(7, expect.anything(), {
      excludeReservationId: 12,
    });
    expect(addRange).toHaveBeenCalled();
    expect(orderSql.createOrderFromReservation).toHaveBeenCalled();
  });
});
