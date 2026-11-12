const carSql = require('../../src/services/sql/carSqlService');
const {
  syncCarStatusFromReservation,
} = require('../../src/services/carFleetSyncService');

jest.mock('../../src/services/sql/carSqlService', () => ({
  findCarStatusForUpdate: jest.fn(),
  updateCarStatus: jest.fn(),
  countActiveFleetReservations: jest.fn(),
}));

describe('carFleetSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('confirmed sets reserved when car is available', async () => {
    carSql.findCarStatusForUpdate.mockResolvedValue({
      id: '1',
      status: 'available',
      isDeleted: false,
    });
    carSql.updateCarStatus.mockResolvedValue({ id: '1', status: 'reserved' });

    await syncCarStatusFromReservation({
      reservation: { id: '9', carId: '1' },
      oldStatus: 'paid',
      newStatus: 'confirmed',
    });

    expect(carSql.updateCarStatus).toHaveBeenCalledWith('1', 'reserved', null);
  });

  test('picked_up forces rented', async () => {
    carSql.findCarStatusForUpdate.mockResolvedValue({
      id: '1',
      status: 'damaged',
      isDeleted: false,
    });
    carSql.updateCarStatus.mockResolvedValue({ id: '1', status: 'rented' });

    await syncCarStatusFromReservation({
      reservation: { id: '9', carId: { id: '1', name: 'X' } },
      oldStatus: 'car_prepared',
      newStatus: 'picked_up',
    });

    expect(carSql.updateCarStatus).toHaveBeenCalledWith('1', 'rented', null);
  });

  test('returned sets needs_cleaning', async () => {
    carSql.findCarStatusForUpdate.mockResolvedValue({
      id: '1',
      status: 'rented',
      isDeleted: false,
    });
    carSql.updateCarStatus.mockResolvedValue({ id: '1', status: 'needs_cleaning' });

    await syncCarStatusFromReservation({
      reservation: { id: '9', carId: '1' },
      oldStatus: 'active_rental',
      newStatus: 'returned',
    });

    expect(carSql.updateCarStatus).toHaveBeenCalledWith('1', 'needs_cleaning', null);
  });

  test('cancelled releases reserved to available when no other actives', async () => {
    carSql.findCarStatusForUpdate.mockResolvedValue({
      id: '1',
      status: 'reserved',
      isDeleted: false,
    });
    carSql.countActiveFleetReservations.mockResolvedValue(0);
    carSql.updateCarStatus.mockResolvedValue({ id: '1', status: 'available' });

    await syncCarStatusFromReservation({
      reservation: { id: '9', carId: '1' },
      oldStatus: 'confirmed',
      newStatus: 'cancelled',
    });

    expect(carSql.updateCarStatus).toHaveBeenCalledWith('1', 'available', null);
  });

  test('does not overwrite needs_cleaning on cancel', async () => {
    carSql.findCarStatusForUpdate.mockResolvedValue({
      id: '1',
      status: 'needs_cleaning',
      isDeleted: false,
    });

    await syncCarStatusFromReservation({
      reservation: { id: '9', carId: '1' },
      oldStatus: 'returned',
      newStatus: 'completed',
    });

    expect(carSql.updateCarStatus).not.toHaveBeenCalled();
  });
});
