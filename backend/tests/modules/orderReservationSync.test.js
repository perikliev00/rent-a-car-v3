// Call jest.mock to perform this step.
jest.mock('../../src/repositories/carRepository', () => ({
  // Provide the find by id for admin field value.
  findByIdForAdmin: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/orderSqlService', () => ({
  // Provide the find order by reservation id field value.
  findOrderByReservationId: jest.fn(),
  // Provide the update order from doc field value.
  updateOrderFromDoc: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/admin/order/orderDomainService', () => ({
  // Provide the compute order pricing field value.
  computeOrderPricing: jest.fn(),
  // Provide the apply order expiry status field value.
  applyOrderExpiryStatus: jest.fn((order) => order),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/admin/order/orderMapper', () => ({
  // Provide the apply pricing to order field value.
  applyPricingToOrder: jest.fn((order, pricing) => {
    // Update order.rentalDays with the right-hand side value.
    order.rentalDays = pricing.rentalDays;
    // Update order.totalPrice with the right-hand side value.
    order.totalPrice = pricing.totalPrice;
    // Return the resulting value to the caller.
    return order;
  }),
}));

// Require the '../../src/repositories/carRepository' module as carRepository.
const carRepository = require('../../src/repositories/carRepository');
// Require the '../../src/services/sql/orderSqlService' module as orderSql.
const orderSql = require('../../src/services/sql/orderSqlService');
// Destructure object properties into local variables.
const { computeOrderPricing } = require('../../src/services/admin/order/orderDomainService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  syncLinkedOrderAfterReservationMove,
  // Contribute this line to the enclosing declaration or statement.
  softDeleteOrderForReservation,
// Continue the surrounding logic with this statement.
} = require('../../src/services/admin/order/orderReservationSync');

// Declare a test suite grouping related cases.
describe('orderReservationSync', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carRepository.findByIdForAdmin.mockResolvedValue to perform this step.
    carRepository.findByIdForAdmin.mockResolvedValue({ id: '3', name: 'BMW' });
    // Call computeOrderPricing.mockResolvedValue to perform this step.
    computeOrderPricing.mockResolvedValue({
      // Provide the rental days field value.
      rentalDays: 4,
      // Provide the delivery price field value.
      deliveryPrice: 0,
      // Provide the return price field value.
      returnPrice: 0,
      // Provide the total price field value.
      totalPrice: 400,
      // Provide the deposit field value.
      deposit: 100,
      // Provide the snapshot field value.
      snapshot: { selectedExtras: [] },
    });
  });

  // Define a single test case and its expectations.
  test('syncLinkedOrderAfterReservationMove updates linked order dates/car/rentalDays', async () => {
    // Create the order constant.
    const order = {
      // Provide the id field value.
      id: '10',
      // Provide the car id field value.
      carId: '2',
      // Provide the pickup date field value.
      pickupDate: new Date('2026-08-01T10:00:00Z'),
      // Provide the return date field value.
      returnDate: new Date('2026-08-03T10:00:00Z'),
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
      // Provide the is deleted field value.
      isDeleted: false,
    };
    // Call orderSql.findOrderByReservationId.mockResolvedValue to perform this step.
    orderSql.findOrderByReservationId.mockResolvedValue(order);
    // Call orderSql.updateOrderFromDoc.mockResolvedValue to perform this step.
    orderSql.updateOrderFromDoc.mockResolvedValue(order);

    // Create the start constant.
    const start = new Date('2026-08-10T10:00:00Z');
    // Create the end constant.
    const end = new Date('2026-08-14T10:00:00Z');

    // Create the result constant.
    const result = await syncLinkedOrderAfterReservationMove({
      // Provide the reservation id field value.
      reservationId: '5',
      // Provide the car id field value.
      carId: 3,
      // Contribute this line to the enclosing declaration or statement.
      start,
      // Contribute this line to the enclosing declaration or statement.
      end,
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'airport',
      // Provide the selected extras field value.
      selectedExtras: [],
      // Provide the hotel delivery field value.
      hotelDelivery: false,
    });

    // Assert that the value matches the intended expectation.
    expect(result.orderSynced).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.pricing.rentalDays).toBe(4);
    // Assert that the value matches the intended expectation.
    expect(order.carId).toBe('3');
    // Assert that the value matches the intended expectation.
    expect(order.pickupDate).toBe(start);
    // Assert that the value matches the intended expectation.
    expect(order.returnDate).toBe(end);
    // Assert that the value matches the intended expectation.
    expect(orderSql.updateOrderFromDoc).toHaveBeenCalledWith(order, null);
  });

  // Define a single test case and its expectations.
  test('syncLinkedOrderAfterReservationMove works without order', async () => {
    // Call orderSql.findOrderByReservationId.mockResolvedValue to perform this step.
    orderSql.findOrderByReservationId.mockResolvedValue(null);
    // Create the result constant.
    const result = await syncLinkedOrderAfterReservationMove({
      // Provide the reservation id field value.
      reservationId: '5',
      // Provide the car id field value.
      carId: 3,
      // Provide the start field value.
      start: new Date('2026-08-10T10:00:00Z'),
      // Provide the end field value.
      end: new Date('2026-08-14T10:00:00Z'),
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
    });
    // Assert that the value matches the intended expectation.
    expect(result.orderSynced).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(orderSql.updateOrderFromDoc).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('softDeleteOrderForReservation marks order deleted', async () => {
    // Create the order constant.
    const order = { id: '10', isDeleted: false };
    // Call orderSql.findOrderByReservationId.mockResolvedValue to perform this step.
    orderSql.findOrderByReservationId.mockResolvedValue(order);
    // Call orderSql.updateOrderFromDoc.mockResolvedValue to perform this step.
    orderSql.updateOrderFromDoc.mockResolvedValue(order);

    // Create the result constant.
    const result = await softDeleteOrderForReservation('5');
    // Assert that the value matches the intended expectation.
    expect(result.isDeleted).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.deletedAt).toBeInstanceOf(Date);
    // Assert that the value matches the intended expectation.
    expect(orderSql.updateOrderFromDoc).toHaveBeenCalled();
  });
});
