// Call jest.mock to perform this step.
jest.mock('../../../src/db/transaction', () => ({
  // Provide the acquire car advisory locks field value.
  acquireCarAdvisoryLocks: jest.fn().mockResolvedValue([]),
  // Provide the run with transaction field value.
  runWithTransaction: jest.fn(async (fn) => fn({ query: jest.fn() })),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/bookingSyncSqlService', () => ({
  // Provide the add range field value.
  addRange: jest.fn().mockResolvedValue(undefined),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/orderSqlService', () => ({
  // Provide the create order from reservation field value.
  createOrderFromReservation: jest.fn().mockResolvedValue({ id: 44 }),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/reservationStatusHistorySqlService', () => ({
  // Provide the list history for reservation field value.
  listHistoryForReservation: jest.fn().mockResolvedValue([]),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/repositories/reservationRepository', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn().mockResolvedValue({
    // Provide the reservation field value.
    reservation: { id: 12, status: 'confirmed' },
  }),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/order/orderConflictService', () => ({
  // Provide the assert no active reservation hold field value.
  assertNoActiveReservationHold: jest.fn().mockResolvedValue(undefined),
  // Provide the assert no open physical rental field value.
  assertNoOpenPhysicalRental: jest.fn().mockResolvedValue(undefined),
}));

// Destructure object properties into local variables.
const { addRange } = require('../../../src/services/sql/bookingSyncSqlService');
// Require the '../../../src/services/sql/orderSqlService' module as orderSql.
const orderSql = require('../../../src/services/sql/orderSqlService');
// Require the '../../../src/repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../../src/repositories/reservationRepository');
// Destructure object properties into local variables.
const { changeStatus } = require('../../../src/services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertNoOpenPhysicalRental,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/admin/order/orderConflictService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  changeReservationStatus,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/admin/reservationAdminService');
// Destructure object properties into local variables.
const { OrderFormError } = require('../../../src/services/admin/order/orderErrors');

// Declare a test suite grouping related cases.
describe('confirmManualReviewReservation open physical rental guard', () => {
  // Create the reservation constant.
  const reservation = {
    // Provide the id field value.
    id: 12,
    // Provide the car id field value.
    carId: 7,
    // Provide the pickup date field value.
    pickupDate: new Date('2030-09-01T07:00:00.000Z'),
    // Provide the return date field value.
    returnDate: new Date('2030-09-05T07:00:00.000Z'),
    // Provide the status field value.
    status: 'manual_review',
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue(reservation);
    // Call assertNoOpenPhysicalRental.mockResolvedValue to perform this step.
    assertNoOpenPhysicalRental.mockResolvedValue(undefined);
  });

  // Define a single test case and its expectations.
  test('rejects confirmation when another open physical rental exists', async () => {
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
    await expect(
      // Call changeReservationStatus to perform this step.
      changeReservationStatus(
        // Contribute this line to the enclosing declaration or statement.
        { session: { user: { id: 1 } } },
        // Contribute this line to the enclosing declaration or statement.
        { reservationId: 12, status: 'confirmed', reason: 'test' }
      )
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({
      // Provide the code field value.
      code: 'VALIDATION_ERROR',
      // Provide the status field value.
      status: 422,
      // Provide the message field value.
      message:
        // Continue the surrounding logic with this statement.
        'Selected car has an open rental (picked up / active) and cannot be booked until it is returned.',
    });

    // Assert that the value matches the intended expectation.
    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith(7, expect.anything(), {
      // Provide the exclude reservation id field value.
      excludeReservationId: 12,
    });
    // Assert that the value matches the intended expectation.
    expect(addRange).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('excludes the reservation being confirmed', async () => {
    // Wait until the asynchronous operation resolves.
    await changeReservationStatus(
      // Contribute this line to the enclosing declaration or statement.
      { session: { user: { id: 1 } } },
      // Contribute this line to the enclosing declaration or statement.
      { reservationId: 12, status: 'confirmed', reason: 'ok' }
    );

    // Assert that the value matches the intended expectation.
    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith(7, expect.anything(), {
      // Provide the exclude reservation id field value.
      excludeReservationId: 12,
    });
    // Assert that the value matches the intended expectation.
    expect(addRange).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.createOrderFromReservation).toHaveBeenCalled();
  });
});
