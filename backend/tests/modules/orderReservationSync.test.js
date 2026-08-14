jest.mock('../../src/repositories/carRepository', () => ({
  findByIdForAdmin: jest.fn(),
}));
jest.mock('../../src/services/sql/orderSqlService', () => ({
  findOrderByReservationId: jest.fn(),
  updateOrderFromDoc: jest.fn(),
}));
jest.mock('../../src/services/admin/order/orderDomainService', () => ({
  computeOrderPricing: jest.fn(),
  applyOrderExpiryStatus: jest.fn((order) => order),
}));
jest.mock('../../src/services/admin/order/orderMapper', () => ({
  applyPricingToOrder: jest.fn((order, pricing) => {
    order.rentalDays = pricing.rentalDays;
    order.totalPrice = pricing.totalPrice;
    return order;
  }),
}));

const carRepository = require('../../src/repositories/carRepository');
const orderSql = require('../../src/services/sql/orderSqlService');
const { computeOrderPricing } = require('../../src/services/admin/order/orderDomainService');
const {
  syncLinkedOrderAfterReservationMove,
  softDeleteOrderForReservation,
} = require('../../src/services/admin/order/orderReservationSync');

describe('orderReservationSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carRepository.findByIdForAdmin.mockResolvedValue({ id: '3', name: 'BMW' });
    computeOrderPricing.mockResolvedValue({
      rentalDays: 4,
      deliveryPrice: 0,
      returnPrice: 0,
      totalPrice: 400,
      deposit: 100,
      snapshot: { selectedExtras: [] },
    });
  });

  test('syncLinkedOrderAfterReservationMove updates linked order dates/car/rentalDays', async () => {
    const order = {
      id: '10',
      carId: '2',
      pickupDate: new Date('2026-08-01T10:00:00Z'),
      returnDate: new Date('2026-08-03T10:00:00Z'),
      pickupTime: '10:00',
      returnTime: '10:00',
      pickupLocation: 'office',
      returnLocation: 'office',
      isDeleted: false,
    };
    orderSql.findOrderByReservationId.mockResolvedValue(order);
    orderSql.updateOrderFromDoc.mockResolvedValue(order);

    const start = new Date('2026-08-10T10:00:00Z');
    const end = new Date('2026-08-14T10:00:00Z');

    const result = await syncLinkedOrderAfterReservationMove({
      reservationId: '5',
      carId: 3,
      start,
      end,
      pickupTime: '10:00',
      returnTime: '10:00',
      pickupLocation: 'office',
      returnLocation: 'airport',
      selectedExtras: [],
      hotelDelivery: false,
    });

    expect(result.orderSynced).toBe(true);
    expect(result.pricing.rentalDays).toBe(4);
    expect(order.carId).toBe('3');
    expect(order.pickupDate).toBe(start);
    expect(order.returnDate).toBe(end);
    expect(orderSql.updateOrderFromDoc).toHaveBeenCalledWith(order, null);
  });

  test('syncLinkedOrderAfterReservationMove works without order', async () => {
    orderSql.findOrderByReservationId.mockResolvedValue(null);
    const result = await syncLinkedOrderAfterReservationMove({
      reservationId: '5',
      carId: 3,
      start: new Date('2026-08-10T10:00:00Z'),
      end: new Date('2026-08-14T10:00:00Z'),
      pickupLocation: 'office',
      returnLocation: 'office',
    });
    expect(result.orderSynced).toBe(false);
    expect(orderSql.updateOrderFromDoc).not.toHaveBeenCalled();
  });

  test('softDeleteOrderForReservation marks order deleted', async () => {
    const order = { id: '10', isDeleted: false };
    orderSql.findOrderByReservationId.mockResolvedValue(order);
    orderSql.updateOrderFromDoc.mockResolvedValue(order);

    const result = await softDeleteOrderForReservation('5');
    expect(result.isDeleted).toBe(true);
    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(orderSql.updateOrderFromDoc).toHaveBeenCalled();
  });
});
