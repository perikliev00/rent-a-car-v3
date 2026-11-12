// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/pricingConfigSqlService', () => ({
  // Provide the load pricing config field value.
  loadPricingConfig: jest.fn(),
  // Provide the upsert delivery fees field value.
  upsertDeliveryFees: jest.fn(),
  // Provide the upsert global fee field value.
  upsertGlobalFee: jest.fn(),
  // Provide the create season field value.
  createSeason: jest.fn(),
  // Provide the update season field value.
  updateSeason: jest.fn(),
  // Provide the delete season field value.
  deleteSeason: jest.fn(),
  // Provide the upsert weekend rule field value.
  upsertWeekendRule: jest.fn(),
  // Provide the update discount rule field value.
  updateDiscountRule: jest.fn(),
  // Provide the upsert deposit rule field value.
  upsertDepositRule: jest.fn(),
  // Provide the create extra field value.
  createExtra: jest.fn(),
  // Provide the update extra field value.
  updateExtra: jest.fn(),
  // Provide the delete extra field value.
  deleteExtra: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/repositories/carRepository', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/utils/bookingValidation', () => ({
  // Provide the validate booking dates field value.
  validateBookingDates: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/utils/pricing/calculateRentalPrice', () => ({
  // Provide the compute price field value.
  computePrice: jest.fn(),
}));

// Require the '../../../src/services/admin/pricingAdminService' module as pricingAdminService.
const pricingAdminService = require('../../../src/services/admin/pricingAdminService');
// Require the '../../../src/repositories/carRepository' module as carRepository.
const carRepository = require('../../../src/repositories/carRepository');
// Destructure object properties into local variables.
const { validateBookingDates } = require('../../../src/utils/bookingValidation');
// Destructure object properties into local variables.
const { computePrice } = require('../../../src/utils/pricing/calculateRentalPrice');
// Require the '../../../src/services/sql/pricingConfigSqlService' module as pricingSql.
const pricingSql = require('../../../src/services/sql/pricingConfigSqlService');

// Declare a test suite grouping related cases.
describe('pricingAdminService.previewPricing', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('rejects missing carId', async () => {
    // Create the result constant.
    const result = await pricingAdminService.previewPricing({
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
    });
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ ok: false, status: 400, error: 'carId is required' });
  });

  // Define a single test case and its expectations.
  test('rejects invalid locations', async () => {
    // Create the result constant.
    const result = await pricingAdminService.previewPricing({
      // Provide the car id field value.
      carId: 1,
      // Provide the pickup location field value.
      pickupLocation: 'nowhere',
      // Provide the return location field value.
      returnLocation: 'office',
    });
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({
      // Provide the ok field value.
      ok: false,
      // Provide the status field value.
      status: 400,
      // Provide the error field value.
      error: 'Invalid pickup or return location',
    });
  });

  // Define a single test case and its expectations.
  test('rejects missing car', async () => {
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue(null);
    // Create the result constant.
    const result = await pricingAdminService.previewPricing({
      // Provide the car id field value.
      carId: 99,
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
      // Provide the pickup date field value.
      pickupDate: '2026-08-10',
      // Provide the return date field value.
      returnDate: '2026-08-12',
    });
    // Assert that the value matches the intended expectation.
    expect(result).toEqual({ ok: false, status: 404, error: 'Car not found' });
  });

  // Define a single test case and its expectations.
  test('rejects invalid booking dates', async () => {
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue({ id: 1, name: 'Yaris' });
    // Call validateBookingDates.mockReturnValue to perform this step.
    validateBookingDates.mockReturnValue({
      // Provide the is valid field value.
      isValid: false,
      // Provide the errors field value.
      errors: ['Return must be after pickup'],
      // Provide the start date field value.
      startDate: null,
      // Provide the end date field value.
      endDate: null,
    });

    // Create the result constant.
    const result = await pricingAdminService.previewPricing({
      // Provide the car id field value.
      carId: 1,
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
      // Provide the pickup date field value.
      pickupDate: '2026-08-12',
      // Provide the return date field value.
      returnDate: '2026-08-10',
    });

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({
      // Provide the ok field value.
      ok: false,
      // Provide the status field value.
      status: 422,
      // Provide the error field value.
      error: 'Return must be after pickup',
    });
  });

  // Define a single test case and its expectations.
  test('returns pricing for valid input', async () => {
    // Create the start date constant.
    const startDate = new Date('2026-08-10T10:00:00Z');
    // Create the end date constant.
    const endDate = new Date('2026-08-13T10:00:00Z');
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue({ id: 7, name: 'Yaris', dayPrice: 50 });
    // Call validateBookingDates.mockReturnValue to perform this step.
    validateBookingDates.mockReturnValue({
      // Provide the is valid field value.
      isValid: true,
      // Provide the errors field value.
      errors: [],
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
    });
    // Call pricingSql.loadPricingConfig.mockResolvedValue to perform this step.
    pricingSql.loadPricingConfig.mockResolvedValue({ extras: [] });
    // Call computePrice.mockReturnValue to perform this step.
    computePrice.mockReturnValue({ totalPrice: 180, deposit: 200, rentalDays: 3 });

    // Create the result constant.
    const result = await pricingAdminService.previewPricing({
      // Provide the car id field value.
      carId: 7,
      // Provide the pickup location field value.
      pickupLocation: 'office',
      // Provide the return location field value.
      returnLocation: 'office',
      // Provide the pickup date field value.
      pickupDate: '2026-08-10',
      // Provide the return date field value.
      returnDate: '2026-08-13',
      // Provide the extras field value.
      extras: ['child_seat'],
      // Provide the hotel delivery field value.
      hotelDelivery: true,
    });

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(result.car).toEqual({ id: 7, name: 'Yaris' });
    // Assert that the value matches the intended expectation.
    expect(result.pricing.totalPrice).toBe(180);
    // Assert that the value matches the intended expectation.
    expect(computePrice).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ id: 7 }),
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Supply the literal value used by the enclosing expression.
      'office',
      // Supply the literal value used by the enclosing expression.
      'office',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the extras field value.
        extras: ['child_seat'],
        // Provide the hotel delivery field value.
        hotelDelivery: true,
      }),
      // Contribute this line to the enclosing declaration or statement.
      { extras: [] }
    );
  });
});
