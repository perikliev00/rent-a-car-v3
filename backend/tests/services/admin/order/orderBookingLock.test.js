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
  createAdminOrder: jest.fn().mockResolvedValue({ id: 55 }),
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

jest.mock('../../../../src/services/admin/order/orderReservationLinkService', () => ({
  ensureLinkedConfirmedReservation: jest.fn().mockResolvedValue({ id: 99 }),
}));

jest.mock('../../../../src/services/admin/order/orderReservationSync', () => ({
  syncLinkedReservationAfterOrderUpdate: jest.fn().mockResolvedValue(undefined),
}));

const { acquireCarAdvisoryLocks } = require('../../../../src/db/transaction');
const {
  purgeExpired,
  addRange,
  updateRange,
} = require('../../../../src/services/sql/bookingSyncSqlService');
const orderSql = require('../../../../src/services/sql/orderSqlService');
const { createOrderCore } = require('../../../../src/services/admin/order/orderCreateService');
const { updateOrderCore } = require('../../../../src/services/admin/order/orderUpdateService');

describe('staff booking car advisory lock', () => {
  const client = { query: jest.fn() };
  const range = {
    start: new Date('2030-06-01T07:00:00.000Z'),
    end: new Date('2030-06-05T07:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    acquireCarAdvisoryLocks.mockResolvedValue([]);
    purgeExpired.mockResolvedValue(undefined);
    addRange.mockResolvedValue(undefined);
    updateRange.mockResolvedValue(undefined);
  });

  test('createOrderCore locks the car before purgeExpired', async () => {
    const calls = [];
    acquireCarAdvisoryLocks.mockImplementation(async () => {
      calls.push('lock');
    });
    purgeExpired.mockImplementation(async () => {
      calls.push('purge');
    });

    await createOrderCore({
      command: {
        carId: 7,
        pickupLocation: 'office',
        returnLocation: 'office',
        pickupTime: '10:00',
        returnTime: '10:00',
        hotelName: '',
        contact: {
          fullName: 'Admin Guest',
          phoneNumber: '+359888123456',
          email: 'admin.guest@example.com',
          address: 'Main St 1',
        },
      },
      range,
      client,
    });

    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(client, [7]);
    expect(calls.slice(0, 2)).toEqual(['lock', 'purge']);
    expect(addRange).toHaveBeenCalled();
  });

  test('updateOrderCore locks previous and new car ids before range writes', async () => {
    const prevStart = new Date('2030-06-01T07:00:00.000Z');
    const prevEnd = new Date('2030-06-05T07:00:00.000Z');
    const nextStart = new Date('2030-07-01T07:00:00.000Z');
    const nextEnd = new Date('2030-07-05T07:00:00.000Z');
    const calls = [];

    orderSql.findOrderById.mockResolvedValue({
      id: 11,
      carId: 3,
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
    });

    acquireCarAdvisoryLocks.mockImplementation(async () => {
      calls.push('lock');
    });
    updateRange.mockImplementation(async () => {
      calls.push('updateRange');
    });

    await updateOrderCore({
      orderId: 11,
      payload: {
        carId: 3,
        pickupDate: '2030-07-01',
        pickupTime: '10:00',
        returnDate: '2030-07-05',
        returnTime: '10:00',
        pickupLocation: 'office',
        returnLocation: 'office',
        hotelName: '',
      },
      contact: {
        fullName: 'Admin Guest',
        phoneNumber: '+359888123456',
        email: 'admin.guest@example.com',
        address: 'Main St 1',
      },
      range: { start: nextStart, end: nextEnd },
      client,
    });

    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(client, [3, '3']);
    expect(calls[0]).toBe('lock');
    expect(calls).toContain('updateRange');
    expect(calls.indexOf('lock')).toBeLessThan(calls.indexOf('updateRange'));
  });
});
