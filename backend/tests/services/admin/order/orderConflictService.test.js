// Call jest.mock to perform this step.
jest.mock('../../../../src/repositories/reservationRepository', () => ({
  // Provide the find booked date overlap field value.
  findBookedDateOverlap: jest.fn(),
  // Provide the find overlapping hold field value.
  findOverlappingHold: jest.fn(),
  // Provide the find open physical rental field value.
  findOpenPhysicalRental: jest.fn(),
}));

// Require the '../../../../src/repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../../../src/repositories/reservationRepository');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertNoBookedOverlap,
  // Contribute this line to the enclosing declaration or statement.
  assertNoActiveReservationHold,
  // Contribute this line to the enclosing declaration or statement.
  assertNoOpenPhysicalRental,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/admin/order/orderConflictService');
// Destructure object properties into local variables.
const { OrderFormError } = require('../../../../src/services/admin/order/orderErrors');

// Declare a test suite grouping related cases.
describe('orderConflictService', () => {
  // Create the start constant.
  const start = new Date('2026-07-10');
  // Create the end constant.
  const end = new Date('2026-07-12');

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('assertNoBookedOverlap throws when overlap exists', async () => {
    // Call reservationRepository.findBookedDateOverlap.mockResolvedValue to perform this step.
    reservationRepository.findBookedDateOverlap.mockResolvedValue({ id: 1 });

    // Wait until the asynchronous operation resolves.
    await expect(assertNoBookedOverlap(7, start, end)).rejects.toBeInstanceOf(OrderFormError);
  });

  // Define a single test case and its expectations.
  test('assertNoActiveReservationHold throws when hold exists', async () => {
    // Call reservationRepository.findOverlappingHold.mockResolvedValue to perform this step.
    reservationRepository.findOverlappingHold.mockResolvedValue({ id: 'hold-1' });

    // Wait until the asynchronous operation resolves.
    await expect(assertNoActiveReservationHold(7, start, end)).rejects.toMatchObject({
      // Provide the code field value.
      code: 'RESERVATION_CONFLICT',
    });
  });

  // Define a single test case and its expectations.
  test('assertNoOpenPhysicalRental throws when car is still out', async () => {
    // Call reservationRepository.findOpenPhysicalRental.mockResolvedValue to perform this step.
    reservationRepository.findOpenPhysicalRental.mockResolvedValue({ id: 'r1', status: 'picked_up' });

    // Wait until the asynchronous operation resolves.
    await expect(assertNoOpenPhysicalRental(7)).rejects.toMatchObject({
      // Provide the code field value.
      code: 'OPEN_PHYSICAL_RENTAL',
    });
  });

  // Define a single test case and its expectations.
  test('assertNoOpenPhysicalRental forwards excludeReservationId', async () => {
    // Call reservationRepository.findOpenPhysicalRental.mockResolvedValue to perform this step.
    reservationRepository.findOpenPhysicalRental.mockResolvedValue(null);

    // Wait until the asynchronous operation resolves.
    await assertNoOpenPhysicalRental(7, null, { excludeReservationId: 42 });

    // Assert that the value matches the intended expectation.
    expect(reservationRepository.findOpenPhysicalRental).toHaveBeenCalledWith(7, null, {
      // Provide the exclude reservation id field value.
      excludeReservationId: 42,
    });
  });
});
