// Call jest.mock to perform this step.
jest.mock('../../../../src/db/transaction', () => ({
  // Provide the acquire car advisory locks field value.
  acquireCarAdvisoryLocks: jest.fn().mockResolvedValue([]),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/bookingSyncSqlService', () => ({
  // Provide the purge expired field value.
  purgeExpired: jest.fn().mockResolvedValue(undefined),
  // Provide the add range field value.
  addRange: jest.fn().mockResolvedValue(undefined),
  // Provide the update range field value.
  updateRange: jest.fn().mockResolvedValue(undefined),
  // Provide the move range field value.
  moveRange: jest.fn().mockResolvedValue(undefined),
  // Provide the fetch date blocks for car field value.
  fetchDateBlocksForCar: jest.fn().mockResolvedValue([]),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/repositories/carRepository', () => ({
  // Provide the find by id for admin field value.
  findByIdForAdmin: jest.fn().mockResolvedValue({ id: 7, name: 'Yaris', price: 50 }),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/orderSqlService', () => ({
  // Provide the create admin order field value.
  createAdminOrder: jest.fn().mockResolvedValue({ id: 55 }),
  // Provide the find order by id field value.
  findOrderById: jest.fn(),
  // Provide the update order from doc field value.
  updateOrderFromDoc: jest.fn().mockResolvedValue(undefined),
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/services/admin/order/orderConflictService', () => ({
  // Provide the assert no booked overlap field value.
  assertNoBookedOverlap: jest.fn().mockResolvedValue(undefined),
  // Provide the assert no active reservation hold field value.
  assertNoActiveReservationHold: jest.fn().mockResolvedValue(undefined),
  // Provide the assert no open physical rental field value.
  assertNoOpenPhysicalRental: jest.fn().mockResolvedValue(undefined),
  // Provide the get availability conflicts field value.
  getAvailabilityConflicts: jest.fn(),
  // Provide the resolve stored date range field value.
  resolveStoredDateRange: jest.fn().mockResolvedValue({
    // Provide the stored start field value.
    storedStart: new Date('2030-06-01T07:00:00.000Z'),
    // Provide the stored end field value.
    storedEnd: new Date('2030-06-05T07:00:00.000Z'),
  }),
  // Provide the reservation conflict message field value.
  RESERVATION_CONFLICT_MESSAGE: 'hold conflict',
}));

// Call jest.mock to perform this step.
jest.mock('../../../../src/services/admin/order/orderDomainService', () => {
  // Create the actual constant.
  const actual = jest.requireActual('../../../../src/services/admin/order/orderDomainService');
  // Return the resulting value to the caller.
  return {
    // Spread actual into the surrounding structure.
    ...actual,
    // Provide the compute order pricing field value.
    computeOrderPricing: jest.fn().mockResolvedValue({
      // Provide the rental days field value.
      rentalDays: 4,
      // Provide the delivery price field value.
      deliveryPrice: 0,
      // Provide the return price field value.
      returnPrice: 0,
      // Provide the total price field value.
      totalPrice: 200,
      // Provide the deposit field value.
      deposit: 0,
      // Provide the snapshot field value.
      snapshot: null,
    }),
  };
});

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
const { acquireCarAdvisoryLocks } = require('../../../../src/db/transaction');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  purgeExpired,
  // Contribute this line to the enclosing declaration or statement.
  addRange,
  // Contribute this line to the enclosing declaration or statement.
  updateRange,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/sql/bookingSyncSqlService');
// Require the '../../../../src/services/sql/orderSqlService' module as orderSql.
const orderSql = require('../../../../src/services/sql/orderSqlService');
// Destructure object properties into local variables.
const { createOrderCore } = require('../../../../src/services/admin/order/orderCreateService');
// Destructure object properties into local variables.
const { updateOrderCore } = require('../../../../src/services/admin/order/orderUpdateService');

// Declare a test suite grouping related cases.
describe('staff booking car advisory lock', () => {
  // Create the client constant.
  const client = { query: jest.fn() };
  // Create the range constant.
  const range = {
    // Provide the start field value.
    start: new Date('2030-06-01T07:00:00.000Z'),
    // Provide the end field value.
    end: new Date('2030-06-05T07:00:00.000Z'),
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call acquireCarAdvisoryLocks.mockResolvedValue to perform this step.
    acquireCarAdvisoryLocks.mockResolvedValue([]);
    // Call purgeExpired.mockResolvedValue to perform this step.
    purgeExpired.mockResolvedValue(undefined);
    // Call addRange.mockResolvedValue to perform this step.
    addRange.mockResolvedValue(undefined);
    // Call updateRange.mockResolvedValue to perform this step.
    updateRange.mockResolvedValue(undefined);
  });

  // Define a single test case and its expectations.
  test('createOrderCore locks the car before purgeExpired', async () => {
    // Create the calls constant.
    const calls = [];
    // Call acquireCarAdvisoryLocks.mockImplementation to perform this step.
    acquireCarAdvisoryLocks.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('lock');
    });
    // Call purgeExpired.mockImplementation to perform this step.
    purgeExpired.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('purge');
    });

    // Wait until the asynchronous operation resolves.
    await createOrderCore({
      // Provide the command field value.
      command: {
        // Provide the car id field value.
        carId: 7,
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '10:00',
        // Provide the hotel name field value.
        hotelName: '',
        // Provide the contact field value.
        contact: {
          // Provide the full name field value.
          fullName: 'Admin Guest',
          // Provide the phone number field value.
          phoneNumber: '+359888123456',
          // Provide the email field value.
          email: 'admin.guest@example.com',
          // Provide the address field value.
          address: 'Main St 1',
        },
      },
      // Contribute this line to the enclosing declaration or statement.
      range,
      // Contribute this line to the enclosing declaration or statement.
      client,
    });

    // Assert that the value matches the intended expectation.
    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(client, [7]);
    // Assert that the value matches the intended expectation.
    expect(calls.slice(0, 2)).toEqual(['lock', 'purge']);
    // Assert that the value matches the intended expectation.
    expect(addRange).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('updateOrderCore locks previous and new car ids before range writes', async () => {
    // Create the prev start constant.
    const prevStart = new Date('2030-06-01T07:00:00.000Z');
    // Create the prev end constant.
    const prevEnd = new Date('2030-06-05T07:00:00.000Z');
    // Create the next start constant.
    const nextStart = new Date('2030-07-01T07:00:00.000Z');
    // Create the next end constant.
    const nextEnd = new Date('2030-07-05T07:00:00.000Z');
    // Create the calls constant.
    const calls = [];

    // Call orderSql.findOrderById.mockResolvedValue to perform this step.
    orderSql.findOrderById.mockResolvedValue({
      // Provide the id field value.
      id: 11,
      // Provide the car id field value.
      carId: 3,
      // Provide the pickup date field value.
      pickupDate: prevStart,
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return date field value.
      returnDate: prevEnd,
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
      // Provide the hotel name field value.
      hotelName: '',
      // Provide the full name field value.
      fullName: 'Admin Guest',
      // Provide the phone number field value.
      phoneNumber: '+359888123456',
      // Provide the email field value.
      email: 'admin.guest@example.com',
      // Provide the address field value.
      address: 'Main St 1',
    });

    // Call acquireCarAdvisoryLocks.mockImplementation to perform this step.
    acquireCarAdvisoryLocks.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('lock');
    });
    // Call updateRange.mockImplementation to perform this step.
    updateRange.mockImplementation(async () => {
      // Call calls.push to perform this step.
      calls.push('updateRange');
    });

    // Wait until the asynchronous operation resolves.
    await updateOrderCore({
      // Provide the order id field value.
      orderId: 11,
      // Provide the payload field value.
      payload: {
        // Provide the car id field value.
        carId: 3,
        // Provide the pickup date field value.
        pickupDate: '2030-07-01',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return date field value.
        returnDate: '2030-07-05',
        // Provide the return time field value.
        returnTime: '10:00',
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the hotel name field value.
        hotelName: '',
      },
      // Provide the contact field value.
      contact: {
        // Provide the full name field value.
        fullName: 'Admin Guest',
        // Provide the phone number field value.
        phoneNumber: '+359888123456',
        // Provide the email field value.
        email: 'admin.guest@example.com',
        // Provide the address field value.
        address: 'Main St 1',
      },
      // Provide the range field value.
      range: { start: nextStart, end: nextEnd },
      // Contribute this line to the enclosing declaration or statement.
      client,
    });

    // Assert that the value matches the intended expectation.
    expect(acquireCarAdvisoryLocks).toHaveBeenCalledWith(client, [3, '3']);
    // Assert that the value matches the intended expectation.
    expect(calls[0]).toBe('lock');
    // Assert that the value matches the intended expectation.
    expect(calls).toContain('updateRange');
    // Assert that the value matches the intended expectation.
    expect(calls.indexOf('lock')).toBeLessThan(calls.indexOf('updateRange'));
  });
});
