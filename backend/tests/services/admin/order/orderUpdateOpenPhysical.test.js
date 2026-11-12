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
jest.mock('../../../../src/services/admin/order/orderReservationSync', () => ({
  // Provide the sync linked reservation after order update field value.
  syncLinkedReservationAfterOrderUpdate: jest.fn().mockResolvedValue(undefined),
}));

// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  updateRange,
  // Contribute this line to the enclosing declaration or statement.
  moveRange,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/sql/bookingSyncSqlService');
// Require the '../../../../src/services/sql/orderSqlService' module as orderSql.
const orderSql = require('../../../../src/services/sql/orderSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertNoOpenPhysicalRental,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/admin/order/orderConflictService');
// Destructure object properties into local variables.
const { syncLinkedReservationAfterOrderUpdate } = require('../../../../src/services/admin/order/orderReservationSync');
// Destructure object properties into local variables.
const { updateOrderCore } = require('../../../../src/services/admin/order/orderUpdateService');
// Destructure object properties into local variables.
const { OrderFormError } = require('../../../../src/services/admin/order/orderErrors');

// Declare a test suite grouping related cases.
describe('updateOrderCore open physical rental guard', () => {
  // Create the client constant.
  const client = { query: jest.fn() };
  // Create the prev start constant.
  const prevStart = new Date('2030-06-01T07:00:00.000Z');
  // Create the prev end constant.
  const prevEnd = new Date('2030-06-05T07:00:00.000Z');
  // Create the next start constant.
  const nextStart = new Date('2030-07-01T07:00:00.000Z');
  // Create the next end constant.
  const nextEnd = new Date('2030-07-05T07:00:00.000Z');

  // Create the base order constant.
  const baseOrder = {
    // Provide the id field value.
    id: 11,
    // Provide the car id field value.
    carId: 3,
    // Provide the reservation id field value.
    reservationId: 88,
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
  };

  // Create the contact constant.
  const contact = {
    // Provide the full name field value.
    fullName: 'Admin Guest',
    // Provide the phone number field value.
    phoneNumber: '+359888123456',
    // Provide the email field value.
    email: 'admin.guest@example.com',
    // Provide the address field value.
    address: 'Main St 1',
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderSql.findOrderById.mockResolvedValue to perform this step.
    orderSql.findOrderById.mockResolvedValue({ ...baseOrder });
    // Call assertNoOpenPhysicalRental.mockResolvedValue to perform this step.
    assertNoOpenPhysicalRental.mockResolvedValue(undefined);
  });

  // Define the async function moveToCar7.
  async function moveToCar7() {
    // Return the resulting value to the caller.
    return updateOrderCore({
      // Provide the order id field value.
      orderId: 11,
      // Provide the payload field value.
      payload: {
        // Provide the car id field value.
        carId: 7,
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
      // Contribute this line to the enclosing declaration or statement.
      contact,
      // Provide the range field value.
      range: { start: nextStart, end: nextEnd },
      // Contribute this line to the enclosing declaration or statement.
      client,
    });
  }

  // Call test.each to perform this step.
  test.each(['picked_up', 'active_rental'])(
    // Supply the literal value used by the enclosing expression.
    'rejects moving order onto a car with another %s reservation',
    // Call async to perform this step.
    async (status) => {
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
      await expect(moveToCar7()).rejects.toMatchObject({
        // Provide the code field value.
        code: 'OPEN_PHYSICAL_RENTAL',
        // Provide the is order form error field value.
        isOrderFormError: true,
      });

      // Assert that the value matches the intended expectation.
      expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith('7', client, {
        // Provide the exclude reservation id field value.
        excludeReservationId: 88,
      });
      // Assert that the value matches the intended expectation.
      expect(moveRange).not.toHaveBeenCalled();
      // Assert that the value matches the intended expectation.
      expect(updateRange).not.toHaveBeenCalled();
      // Assert that the value matches the intended expectation.
      expect(orderSql.updateOrderFromDoc).not.toHaveBeenCalled();
      // Assert that the value matches the intended expectation.
      expect(syncLinkedReservationAfterOrderUpdate).not.toHaveBeenCalled();
      // Evaluate the unary operator expression.
      void status;
    }
  );

  // Define a single test case and its expectations.
  test('excludes the order linked reservation and allows extending the same open rental', async () => {
    // Create the extended end constant.
    const extendedEnd = new Date('2030-06-08T07:00:00.000Z');

    // Wait until the asynchronous operation resolves.
    await updateOrderCore({
      // Provide the order id field value.
      orderId: 11,
      // Provide the payload field value.
      payload: {
        // Provide the car id field value.
        carId: 3,
        // Provide the pickup date field value.
        pickupDate: '2030-06-01',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return date field value.
        returnDate: '2030-06-08',
        // Provide the return time field value.
        returnTime: '10:00',
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
        // Provide the hotel name field value.
        hotelName: '',
      },
      // Contribute this line to the enclosing declaration or statement.
      contact,
      // Provide the range field value.
      range: { start: prevStart, end: extendedEnd },
      // Contribute this line to the enclosing declaration or statement.
      client,
    });

    // Assert that the value matches the intended expectation.
    expect(assertNoOpenPhysicalRental).toHaveBeenCalledWith('3', client, {
      // Provide the exclude reservation id field value.
      excludeReservationId: 88,
    });
    // Assert that the value matches the intended expectation.
    expect(updateRange).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.updateOrderFromDoc).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(syncLinkedReservationAfterOrderUpdate).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('contact-only edit does not run open physical rental check', async () => {
    // Wait until the asynchronous operation resolves.
    await updateOrderCore({
      // Provide the order id field value.
      orderId: 11,
      // Provide the payload field value.
      payload: {
        // Provide the car id field value.
        carId: 3,
        // Provide the pickup date field value.
        pickupDate: '2030-06-01',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return date field value.
        returnDate: '2030-06-05',
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
        // Spread contact into the surrounding structure.
        ...contact,
        // Provide the full name field value.
        fullName: 'Updated Guest',
      },
      // Provide the range field value.
      range: { start: prevStart, end: prevEnd },
      // Contribute this line to the enclosing declaration or statement.
      client,
    });

    // Assert that the value matches the intended expectation.
    expect(assertNoOpenPhysicalRental).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(moveRange).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(updateRange).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(orderSql.updateOrderFromDoc).toHaveBeenCalled();
  });
});
