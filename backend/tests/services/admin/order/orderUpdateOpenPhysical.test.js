jest.mock('../../../../src/db/transaction', () => ({
  acquireCarAdvisoryLocks: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../../src/services/sql/bookingSyncSqlService', () => ({
  purgeExpired: jest.fn().mockResolvedValue(undefined),
  addRange: jest.fn().mockResolvedValue(undefined),
  updateRange: jest.fn().mockResolvedValue(undefined),
  moveRange: jest.fn().mockResolvedValue(undefined),
  fetchDateBlocksForCar: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../../src/repositories/carRepository', () => ({
  findByIdForAdmin: jest.fn().mockResolvedValue({ id: 7, name: 'Yaris', price: 50 }),
}));

jest.mock('../../../../src/services/sql/orderSqlService', () => ({
  findOrderById: jest.fn(),
  updateOrderFromDoc: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../src/services/admin/order/orderConflictService', () => ({
  assertNoBookedOverlap: jest.fn().mockResolvedValue(undefined),
  assertNoActiveReservationHold: jest.fn().mockResolvedValue(undefined),
  assertNoOpenPhysicalRental: jest.fn().mockResolvedValue(undefined),
  getAvailabilityConflicts: jest.fn(),
  resolveStoredDateRange: jest.fn().mockResolvedValue({
    storedStart: new Date('2030-06-01T07:00:00.000Z'),
    storedEnd: new Date('2030-06-05T07:00:00.000Z'),
  }),
  RESERVATION_CONFLICT_MESSAGE: 'hold conflict',
}));

jest.mock('../../../../src/services/admin/order/orderDomainService', () => {
  const actual = jest.requireActual('../../../../src/services/admin/order/orderDomainService');
  return {
    ...actual,
    computeOrderPricing: jest.fn().mockResolvedValue({
      rentalDays: 4,
      deliveryPrice: 0,
      returnPrice: 0,
      totalPrice: 200,
      deposit: 0,
      snapshot: null,
    }),
  };
});

jest.mock('../../../../src/services/admin/order/orderReservationSync', () => ({
  syncLinkedReservationAfterOrderUpdate: jest.fn().mockResolvedValue(undefined),
}));

const {
  updateRange,
  moveRange,
} = require('../../../../src/services/sql/bookingSyncSqlService');
const orderSql = require('../../../../src/services/sql/orderSqlService');
const {
  assertNoOpenPhysicalRental,
} = require('../../../../src/services/admin/order/orderConflictService');
const { syncLinkedReservationAfterOrderUpdate } = require('../../../../src/services/admin/order/orderReservationSync');
const { updateOrderCore } = require('../../../../src/services/admin/order/orderUpdateService');
const { OrderFormError } = require('../../../../src/services/admin/order/orderErrors');

describe('updateOrderCore open physical rental guard', () => {
  const client = { query: jest.fn() };
  const prevStart = new Date('2030-06-01T07:00:00.000Z');
  const prevEnd = new Date('2030-06-05T07:00:00.000Z');
  const nextStart = new Date('2030-07-01T07:00:00.000Z');
  const nextEnd = new Date('2030-07-05T07:00:00.000Z');

  const baseOrder = {
    id: 11,
    carId: 3,
    reservationId: 88,
    pickupDate: prevStart,
    pickupTime: '10:00',
    returnDate: prevEnd,
    returnTime: '10:00',
    pickupLocation: 'office',
    returnLocation: 'office',
    hotelName: '',
    fullName: 'Admin Guest',
    phoneNumber: '+359888123456',
    email: 'admin.guest@example.com',
    address: 'Main St 1',
  };

  const contact = {
    fullName: 'Admin Guest',
    phoneNumber: '+359888123456',
    email: 'admin.guest@example.com',
    address: 'Main St 1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    orderSql.findOrderById.mockResolvedValue({ ...baseOrder });
    assertNoOpenPhysicalRental.mockResolvedValue(undefined);
  });

  async function moveToCar7() {
    return updateOrderCore({
      orderId: 11,
      payload: {
        carId: 7,
        pickupDate: '2030-07-01',
        pickupTime: '10:00',
        returnDate: '2030-07-05',
        returnTime: '10:00',
        pickupLocation: 'office',
        returnLocation: 'office',
        hotelName: '',
      },
      contact,
      range: { start: nextStart, end: nextEnd },
      client,
    });
  }

  test.each(['picked_up', 'active_rental'])(
    'rejects moving order onto a car with another %s reservation',
    async (status) => {
      assertNoOpenPhysicalRental.mockRejectedValue(
        new OrderFormError(
          'OPEN_PHYSICAL_RENTAL',
          'Selected car has an open rental (picked up / active) and cannot be booked until it is returned.'
        )
      );

      await expect(moveToCar7()).rejects.toMatchObject({
        code: 'OPEN_PHYSICAL_RENTAL',
        isOrderFormError: true,
      });

      expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith('7', client, {
        excludeReservationId: 88,
      });
      expect(moveRange).not.toHaveBeenCalled();
      expect(updateRange).not.toHaveBeenCalled();
      expect(orderSql.updateOrderFromDoc).not.toHaveBeenCalled();
      expect(syncLinkedReservationAfterOrderUpdate).not.toHaveBeenCalled();
      void status;
    }
  );

  test('excludes the order linked reservation and allows extending the same open rental', async () => {
    const extendedEnd = new Date('2030-06-08T07:00:00.000Z');

    await updateOrderCore({
      orderId: 11,
      payload: {
        carId: 3,
        pickupDate: '2030-06-01',
        pickupTime: '10:00',
        returnDate: '2030-06-08',
        returnTime: '10:00',
        pickupLocation: 'office',
        returnLocation: 'office',
        hotelName: '',
      },
      contact,
      range: { start: prevStart, end: extendedEnd },
      client,
    });

    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith('3', client, {
      excludeReservationId: 88,
    });
    expect(updateRange).toHaveBeenCalled();
    expect(orderSql.updateOrderFromDoc).toHaveBeenCalled();
    expect(syncLinkedReservationAfterOrderUpdate).toHaveBeenCalled();
  });

  test('contact-only edit does not run open physical rental check', async () => {
    await updateOrderCore({
      orderId: 11,
      payload: {
        carId: 3,
        pickupDate: '2030-06-01',
        pickupTime: '10:00',
        returnDate: '2030-06-05',
        returnTime: '10:00',
        pickupLocation: 'office',
        returnLocation: 'office',
        hotelName: '',
      },
      contact: {
        ...contact,
        fullName: 'Updated Guest',
      },
      range: { start: prevStart, end: prevEnd },
      client,
    });

    expect(assertNoOpenPhysicalRental).not.toHaveBeenCalled();
    expect(moveRange).not.toHaveBeenCalled();
    expect(updateRange).not.toHaveBeenCalled();
    expect(orderSql.updateOrderFromDoc).toHaveBeenCalled();
  });
});
