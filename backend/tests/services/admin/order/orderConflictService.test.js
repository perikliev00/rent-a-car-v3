jest.mock('../../../../src/repositories/reservationRepository', () => ({
  findBookedDateOverlap: jest.fn(),
  findOverlappingHold: jest.fn(),
}));

const reservationRepository = require('../../../../src/repositories/reservationRepository');
const {
  assertNoBookedOverlap,
  assertNoActiveReservationHold,
} = require('../../../../src/services/admin/order/orderConflictService');
const { OrderFormError } = require('../../../../src/services/admin/order/orderErrors');

describe('orderConflictService', () => {
  const start = new Date('2026-07-10');
  const end = new Date('2026-07-12');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('assertNoBookedOverlap throws when overlap exists', async () => {
    reservationRepository.findBookedDateOverlap.mockResolvedValue({ id: 1 });

    await expect(assertNoBookedOverlap(7, start, end)).rejects.toBeInstanceOf(OrderFormError);
  });

  test('assertNoActiveReservationHold throws when hold exists', async () => {
    reservationRepository.findOverlappingHold.mockResolvedValue({ id: 'hold-1' });

    await expect(assertNoActiveReservationHold(7, start, end)).rejects.toMatchObject({
      code: 'RESERVATION_CONFLICT',
    });
  });
});
