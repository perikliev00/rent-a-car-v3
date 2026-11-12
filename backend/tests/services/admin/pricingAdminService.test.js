jest.mock('../../../src/services/sql/pricingConfigSqlService', () => ({
  loadPricingConfig: jest.fn(),
  upsertDeliveryFees: jest.fn(),
  upsertGlobalFee: jest.fn(),
  createSeason: jest.fn(),
  updateSeason: jest.fn(),
  deleteSeason: jest.fn(),
  upsertWeekendRule: jest.fn(),
  updateDiscountRule: jest.fn(),
  upsertDepositRule: jest.fn(),
  createExtra: jest.fn(),
  updateExtra: jest.fn(),
  deleteExtra: jest.fn(),
}));
jest.mock('../../../src/repositories/carRepository', () => ({
  findById: jest.fn(),
}));
jest.mock('../../../src/utils/bookingValidation', () => ({
  validateBookingDates: jest.fn(),
}));
jest.mock('../../../src/utils/pricing/calculateRentalPrice', () => ({
  computePrice: jest.fn(),
}));

const pricingAdminService = require('../../../src/services/admin/pricingAdminService');
const carRepository = require('../../../src/repositories/carRepository');
const { validateBookingDates } = require('../../../src/utils/bookingValidation');
const { computePrice } = require('../../../src/utils/pricing/calculateRentalPrice');
const pricingSql = require('../../../src/services/sql/pricingConfigSqlService');

describe('pricingAdminService.previewPricing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects missing carId', async () => {
    const result = await pricingAdminService.previewPricing({
      pickupLocation: 'office',
      returnLocation: 'office',
    });
    expect(result).toEqual({ ok: false, status: 400, error: 'carId is required' });
  });

  test('rejects invalid locations', async () => {
    const result = await pricingAdminService.previewPricing({
      carId: 1,
      pickupLocation: 'nowhere',
      returnLocation: 'office',
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid pickup or return location',
    });
  });

  test('rejects missing car', async () => {
    carRepository.findById.mockResolvedValue(null);
    const result = await pricingAdminService.previewPricing({
      carId: 99,
      pickupLocation: 'office',
      returnLocation: 'office',
      pickupDate: '2026-08-10',
      returnDate: '2026-08-12',
    });
    expect(result).toEqual({ ok: false, status: 404, error: 'Car not found' });
  });

  test('rejects invalid booking dates', async () => {
    carRepository.findById.mockResolvedValue({ id: 1, name: 'Yaris' });
    validateBookingDates.mockReturnValue({
      isValid: false,
      errors: ['Return must be after pickup'],
      startDate: null,
      endDate: null,
    });

    const result = await pricingAdminService.previewPricing({
      carId: 1,
      pickupLocation: 'office',
      returnLocation: 'office',
      pickupDate: '2026-08-12',
      returnDate: '2026-08-10',
    });

    expect(result).toEqual({
      ok: false,
      status: 422,
      error: 'Return must be after pickup',
    });
  });

  test('returns pricing for valid input', async () => {
    const startDate = new Date('2026-08-10T10:00:00Z');
    const endDate = new Date('2026-08-13T10:00:00Z');
    carRepository.findById.mockResolvedValue({ id: 7, name: 'Yaris', dayPrice: 50 });
    validateBookingDates.mockReturnValue({
      isValid: true,
      errors: [],
      startDate,
      endDate,
    });
    pricingSql.loadPricingConfig.mockResolvedValue({ extras: [] });
    computePrice.mockReturnValue({ totalPrice: 180, deposit: 200, rentalDays: 3 });

    const result = await pricingAdminService.previewPricing({
      carId: 7,
      pickupLocation: 'office',
      returnLocation: 'office',
      pickupDate: '2026-08-10',
      returnDate: '2026-08-13',
      extras: ['child_seat'],
      hotelDelivery: true,
    });

    expect(result.ok).toBe(true);
    expect(result.car).toEqual({ id: 7, name: 'Yaris' });
    expect(result.pricing.totalPrice).toBe(180);
    expect(computePrice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      startDate,
      endDate,
      'office',
      'office',
      expect.objectContaining({
        extras: ['child_seat'],
        hotelDelivery: true,
      }),
      { extras: [] }
    );
  });
});
