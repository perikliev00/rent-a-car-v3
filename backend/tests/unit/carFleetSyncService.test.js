// Require the '../../src/services/sql/carSqlService' module as carSql.
const carSql = require('../../src/services/sql/carSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  syncCarStatusFromReservation,
// Continue the surrounding logic with this statement.
} = require('../../src/services/carFleetSyncService');

// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/carSqlService', () => ({
  // Provide the find car status for update field value.
  findCarStatusForUpdate: jest.fn(),
  // Provide the update car status field value.
  updateCarStatus: jest.fn(),
  // Provide the count active fleet reservations field value.
  countActiveFleetReservations: jest.fn(),
}));

// Declare a test suite grouping related cases.
describe('carFleetSyncService', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('confirmed sets reserved when car is available', async () => {
    // Call carSql.findCarStatusForUpdate.mockResolvedValue to perform this step.
    carSql.findCarStatusForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: '1',
      // Provide the status field value.
      status: 'available',
      // Provide the is deleted field value.
      isDeleted: false,
    });
    // Call carSql.updateCarStatus.mockResolvedValue to perform this step.
    carSql.updateCarStatus.mockResolvedValue({ id: '1', status: 'reserved' });

    // Wait until the asynchronous operation resolves.
    await syncCarStatusFromReservation({
      // Provide the reservation field value.
      reservation: { id: '9', carId: '1' },
      // Provide the old status field value.
      oldStatus: 'paid',
      // Provide the new status field value.
      newStatus: 'confirmed',
    });

    // Assert that the value matches the intended expectation.
    expect(carSql.updateCarStatus).toHaveBeenCalledWith('1', 'reserved', null);
  });

  // Define a single test case and its expectations.
  test('picked_up forces rented', async () => {
    // Call carSql.findCarStatusForUpdate.mockResolvedValue to perform this step.
    carSql.findCarStatusForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: '1',
      // Provide the status field value.
      status: 'damaged',
      // Provide the is deleted field value.
      isDeleted: false,
    });
    // Call carSql.updateCarStatus.mockResolvedValue to perform this step.
    carSql.updateCarStatus.mockResolvedValue({ id: '1', status: 'rented' });

    // Wait until the asynchronous operation resolves.
    await syncCarStatusFromReservation({
      // Provide the reservation field value.
      reservation: { id: '9', carId: { id: '1', name: 'X' } },
      // Provide the old status field value.
      oldStatus: 'car_prepared',
      // Provide the new status field value.
      newStatus: 'picked_up',
    });

    // Assert that the value matches the intended expectation.
    expect(carSql.updateCarStatus).toHaveBeenCalledWith('1', 'rented', null);
  });

  // Define a single test case and its expectations.
  test('returned sets needs_cleaning', async () => {
    // Call carSql.findCarStatusForUpdate.mockResolvedValue to perform this step.
    carSql.findCarStatusForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: '1',
      // Provide the status field value.
      status: 'rented',
      // Provide the is deleted field value.
      isDeleted: false,
    });
    // Call carSql.updateCarStatus.mockResolvedValue to perform this step.
    carSql.updateCarStatus.mockResolvedValue({ id: '1', status: 'needs_cleaning' });

    // Wait until the asynchronous operation resolves.
    await syncCarStatusFromReservation({
      // Provide the reservation field value.
      reservation: { id: '9', carId: '1' },
      // Provide the old status field value.
      oldStatus: 'active_rental',
      // Provide the new status field value.
      newStatus: 'returned',
    });

    // Assert that the value matches the intended expectation.
    expect(carSql.updateCarStatus).toHaveBeenCalledWith('1', 'needs_cleaning', null);
  });

  // Define a single test case and its expectations.
  test('cancelled releases reserved to available when no other actives', async () => {
    // Call carSql.findCarStatusForUpdate.mockResolvedValue to perform this step.
    carSql.findCarStatusForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: '1',
      // Provide the status field value.
      status: 'reserved',
      // Provide the is deleted field value.
      isDeleted: false,
    });
    // Call carSql.countActiveFleetReservations.mockResolvedValue to perform this step.
    carSql.countActiveFleetReservations.mockResolvedValue(0);
    // Call carSql.updateCarStatus.mockResolvedValue to perform this step.
    carSql.updateCarStatus.mockResolvedValue({ id: '1', status: 'available' });

    // Wait until the asynchronous operation resolves.
    await syncCarStatusFromReservation({
      // Provide the reservation field value.
      reservation: { id: '9', carId: '1' },
      // Provide the old status field value.
      oldStatus: 'confirmed',
      // Provide the new status field value.
      newStatus: 'cancelled',
    });

    // Assert that the value matches the intended expectation.
    expect(carSql.updateCarStatus).toHaveBeenCalledWith('1', 'available', null);
  });

  // Define a single test case and its expectations.
  test('does not overwrite needs_cleaning on cancel', async () => {
    // Call carSql.findCarStatusForUpdate.mockResolvedValue to perform this step.
    carSql.findCarStatusForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: '1',
      // Provide the status field value.
      status: 'needs_cleaning',
      // Provide the is deleted field value.
      isDeleted: false,
    });

    // Wait until the asynchronous operation resolves.
    await syncCarStatusFromReservation({
      // Provide the reservation field value.
      reservation: { id: '9', carId: '1' },
      // Provide the old status field value.
      oldStatus: 'returned',
      // Provide the new status field value.
      newStatus: 'completed',
    });

    // Assert that the value matches the intended expectation.
    expect(carSql.updateCarStatus).not.toHaveBeenCalled();
  });
});
