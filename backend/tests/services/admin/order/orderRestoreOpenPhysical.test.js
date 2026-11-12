// Call jest.mock to perform this step.
jest.mock('../../../../src/db/transaction', () => ({
  // Provide the acquire car advisory locks field value.
  acquireCarAdvisoryLocks: jest.fn().mockResolvedValue([]),
  // Provide the run with optional transaction field value.
  runWithOptionalTransaction: jest.fn(async (fn) => fn({ query: jest.fn() })),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/bookingSyncSqlService', () => ({
  // Provide the purge expired field value.
  purgeExpired: jest.fn().mockResolvedValue(undefined),
  // Provide the add range field value.
  addRange: jest.fn().mockResolvedValue(undefined),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/repositories/carRepository', () => ({
  // Provide the find by id for admin field value.
  findByIdForAdmin: jest.fn().mockResolvedValue({ id: 7, name: 'Yaris', isDeleted: false }),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/repositories/reservationRepository', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/orderSqlService', () => ({
  // Provide the find order by id field value.
  findOrderById: jest.fn(),
  // Provide the update order from doc field value.
  updateOrderFromDoc: jest.fn().mockResolvedValue(undefined),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/services/admin/order/orderConflictService', () => ({
  // Provide the assert no active reservation hold field value.
  assertNoActiveReservationHold: jest.fn().mockResolvedValue(undefined),
  // Provide the assert no open physical rental field value.
  assertNoOpenPhysicalRental: jest.fn().mockResolvedValue(undefined),
  // Provide the reservation conflict message field value.
  RESERVATION_CONFLICT_MESSAGE: 'hold conflict',
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/services/admin/order/orderReservationLinkService', () => ({
  // Provide the ensure linked confirmed reservation field value.
  ensureLinkedConfirmedReservation: jest.fn().mockResolvedValue({ id: 99 }),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/services/admin/order/orderReservationSync', () => ({
  // Provide the sync linked reservation after order update field value.
  syncLinkedReservationAfterOrderUpdate: jest.fn().mockResolvedValue(undefined),
}));

// Destructure object properties into local variables.
const { addRange } = require('../../../../src/services/sql/bookingSyncSqlService');
// Require the '../../../../src/services/sql/orderSqlService' module as orderSql.
const orderSql = require('../../../../src/services/sql/orderSqlService');
// Require the '../../../../src/repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../../../src/repositories/reservationRepository');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertNoOpenPhysicalRental,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/admin/order/orderConflictService');
// Destructure object properties into local variables.
const { syncLinkedReservationAfterOrderUpdate } = require('../../../../src/services/admin/order/orderReservationSync');
// Destructure object properties into local variables.
const { ensureLinkedConfirmedReservation } = require('../../../../src/services/admin/order/orderReservationLinkService');
// Destructure object properties into local variables.
const { restoreOrder } = require('../../../../src/services/admin/order/orderRestoreService');
// Destructure object properties into local variables.
const { OrderFormError } = require('../../../../src/services/admin/order/orderErrors');

// Declare a test suite grouping related cases.
describe('restoreOrder open physical rental guard', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderSql.findOrderById.mockResolvedValue to perform this step.
    orderSql.findOrderById.mockResolvedValue({
      // Provide the id field value.
      id: 21,
      // Provide the car id field value.
      carId: 7,
      // Provide the reservation id field value.
      reservationId: 55,
      // Provide the is deleted field value.
      isDeleted: true,
      // Provide the deleted at field value.
      deletedAt: new Date(),
      // Provide the pickup date field value.
      pickupDate: new Date('2030-08-01T07:00:00.000Z'),
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return date field value.
      returnDate: new Date('2030-08-05T07:00:00.000Z'),
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the status field value.
      status: 'active',
    });
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({ id: 55, status: 'confirmed' });
    // Call assertNoOpenPhysicalRental.mockResolvedValue to perform this step.
    assertNoOpenPhysicalRental.mockResolvedValue(undefined);
  });

  // Define a single test case and its expectations.
  test('rejects restore when another open physical rental exists', async () => {
    // Call assertNoOpenPhysicalRental.mockRejectedValue to perform this step.
    assertNoOpenPhysicalRental.mockRejectedValue(
      // Continue the surrounding logic with this statement.
      new OrderFormError(
        // Supply the literal value used by the enclosing expression.
        'OPEN_PHYSICAL_RENTAL',
        // Continue the surrounding logic with this statement.
        'Selected car has an open rental (picked up / active) and cannot be booked until it is returned.'
      )
    );

    // Wait until the asynchronous operation resolves.
    await expect(restoreOrder(21)).rejects.toMatchObject({
      // Provide the is order restore error field value.
      isOrderRestoreError: true,
      // Provide the code field value.
      code: 'OPEN_PHYSICAL_RENTAL',
    });

    // Assert that the value matches the intended expectation.
    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      7,
      // Call expect.anything to perform this step.
      expect.anything(),
      // Contribute this line to the enclosing declaration or statement.
      { excludeReservationId: 55 }
    );
    // Assert that the value matches the intended expectation.
    expect(addRange).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.updateOrderFromDoc).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(syncLinkedReservationAfterOrderUpdate).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(ensureLinkedConfirmedReservation).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('excludes the restored order linked reservationId', async () => {
    // Wait until the asynchronous operation resolves.
    await restoreOrder(21);

    // Assert that the value matches the intended expectation.
    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      7,
      // Call expect.anything to perform this step.
      expect.anything(),
      // Contribute this line to the enclosing declaration or statement.
      { excludeReservationId: 55 }
    );
    // Assert that the value matches the intended expectation.
    expect(addRange).toHaveBeenCalled();
  });
});
