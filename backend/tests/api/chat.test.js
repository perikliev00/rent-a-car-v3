// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp } = require('../helpers/apiTestApp');

// Call jest.mock to perform this step.
jest.mock('../../src/repositories/carRepository');
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/bookingSyncSqlService', () => ({
  // Provide the purge expired field value.
  purgeExpired: jest.fn().mockResolvedValue(undefined),
}));

// Require the '../../src/repositories/carRepository' module as carRepository.
const carRepository = require('../../src/repositories/carRepository');

// Create the mock car constant.
const mockCar = {
  // Provide the id field value.
  id: 1,
  // Provide the name field value.
  name: 'Toyota Yaris',
  // Provide the make field value.
  make: 'Toyota',
  // Provide the model field value.
  model: 'Yaris',
  // Provide the price field value.
  price: 45,
  // Provide the transmission field value.
  transmission: 'automatic',
  // Provide the fuel type field value.
  fuelType: 'petrol',
  // Provide the seats field value.
  seats: 5,
  // Provide the category field value.
  category: 'Economy',
  // Provide the category id field value.
  categoryId: 1,
  // Provide the vin field value.
  vin: 'VIN-SECRET',
  // Provide the registration number field value.
  registrationNumber: 'REG-SECRET',
  // Provide the mileage field value.
  mileage: 12000,
  // Provide the current location field value.
  currentLocation: 'yard-secret',
  // Provide the insurance expiry field value.
  insuranceExpiry: '2030-01-01',
  // Provide the technical inspection expiry field value.
  technicalInspectionExpiry: '2030-02-01',
  // Provide the fuel level field value.
  fuelLevel: 'full',
  // Provide the status field value.
  status: 'available',
  // Provide the is deleted field value.
  isDeleted: false,
};

// Create the internal car fields constant.
const INTERNAL_CAR_FIELDS = [
  // Supply the literal value used by the enclosing expression.
  'vin',
  // Supply the literal value used by the enclosing expression.
  'registrationNumber',
  // Supply the literal value used by the enclosing expression.
  'mileage',
  // Supply the literal value used by the enclosing expression.
  'currentLocation',
  // Supply the literal value used by the enclosing expression.
  'insuranceExpiry',
  // Supply the literal value used by the enclosing expression.
  'technicalInspectionExpiry',
  // Supply the literal value used by the enclosing expression.
  'fuelLevel',
  // Supply the literal value used by the enclosing expression.
  'status',
  // Supply the literal value used by the enclosing expression.
  'isDeleted',
];

// Declare a test suite grouping related cases.
describe('/api/chat response contract', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carRepository.listAvailable.mockResolvedValue to perform this step.
    carRepository.listAvailable.mockResolvedValue([mockCar]);
    // Call carRepository.listByFilter.mockResolvedValue to perform this step.
    carRepository.listByFilter.mockResolvedValue([mockCar]);
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue(mockCar);
  });

  // Define a single test case and its expectations.
  test('GET /api/chat/cars-summary returns raw JSON without success envelope', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/chat/cars-summary').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the total cars field value.
        totalCars: 1,
        // Provide the fuel types field value.
        fuelTypes: expect.any(Array),
        // Provide the transmissions field value.
        transmissions: expect.any(Array),
        // Provide the seat options field value.
        seatOptions: expect.any(Array),
        // Provide the price range field value.
        priceRange: expect.objectContaining({ min: expect.any(Number), max: expect.any(Number) }),
        // Provide the price tiers field value.
        priceTiers: expect.objectContaining({
          // Provide the tier1 3 field value.
          tier1_3: expect.any(Object),
          // Provide the tier7 31 field value.
          tier7_31: expect.any(Object),
          // Provide the tier31 plus field value.
          tier31_plus: expect.any(Object),
        }),
      })
    );
  });

  // Define a single test case and its expectations.
  test('GET /api/chat/pricing-info returns raw pricing payload', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/chat/pricing-info').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the delivery fees field value.
        deliveryFees: expect.any(Object),
        // Provide the return fees field value.
        returnFees: expect.any(Object),
        // Provide the price tier explanation field value.
        priceTierExplanation: expect.any(Object),
      })
    );
  });

  // Define a single test case and its expectations.
  test('GET /api/chat/cars-by-filter returns raw car array', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/chat/cars-by-filter')
      // Call .query to perform this step.
      .query({ categoryId: '1', transmission: 'Automatic' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(Array.isArray(response.body)).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body[0]).toEqual(expect.objectContaining({ id: 1, name: 'Toyota Yaris' }));
    // Iterate using the loop initializer, condition, and step.
    for (const field of INTERNAL_CAR_FIELDS) {
      // Assert that the value matches the intended expectation.
      expect(response.body[0]).not.toHaveProperty(field);
    }
    // Assert that the value matches the intended expectation.
    expect(carRepository.listByFilter).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ categoryId: '1', transmission: 'Automatic' })
    );
  });

  // Define a single test case and its expectations.
  test('GET /api/v1/chat/cars-by-filter hides internal fleet fields', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the response constant.
    const response = await request(app).get('/api/v1/chat/cars-by-filter').expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body[0].name).toBe('Toyota Yaris');
    // Iterate using the loop initializer, condition, and step.
    for (const field of INTERNAL_CAR_FIELDS) {
      // Assert that the value matches the intended expectation.
      expect(response.body[0]).not.toHaveProperty(field);
    }
    // Assert that the value matches the intended expectation.
    expect(JSON.stringify(response.body)).not.toContain('SECRET');
  });

  // Define a single test case and its expectations.
  test('GET /api/chat/cars-by-filter returns validation error envelope', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/chat/cars-by-filter')
      // Call .query to perform this step.
      .query({ fuelType: 'invalid-fuel' })
      // Call .expect to perform this step.
      .expect(400);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(response.body.error).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the code field value.
        code: 'VALIDATION_ERROR',
        // Provide the message field value.
        message: expect.any(String),
      })
    );
  });

  // Define a single test case and its expectations.
  test('GET /api/chat/car-details/:carId returns raw car object', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/chat/car-details/1').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual(expect.objectContaining({ id: 1, name: 'Toyota Yaris' }));
    // Iterate using the loop initializer, condition, and step.
    for (const field of INTERNAL_CAR_FIELDS) {
      // Assert that the value matches the intended expectation.
      expect(response.body).not.toHaveProperty(field);
    }
  });

  // Define a single test case and its expectations.
  test('GET /api/chat/car-details/:carId returns not found error envelope', async () => {
    // Call carRepository.findById.mockResolvedValue to perform this step.
    carRepository.findById.mockResolvedValue(null);
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/chat/car-details/999').expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the code field value.
        code: 'NOT_FOUND',
        // Provide the message field value.
        message: 'Car not found',
      })
    );
  });

  // Define a single test case and its expectations.
  test('GET /api/chat/cars-summary returns empty summary when no cars', async () => {
    // Call carRepository.listAvailable.mockResolvedValue to perform this step.
    carRepository.listAvailable.mockResolvedValue([]);
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/chat/cars-summary').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the total cars field value.
      totalCars: 0,
      // Provide the fuel types field value.
      fuelTypes: [],
      // Provide the transmissions field value.
      transmissions: [],
      // Provide the seat options field value.
      seatOptions: [],
      // Provide the price range field value.
      priceRange: { min: 0, max: 0 },
      // Provide the price tiers field value.
      priceTiers: {
        // Provide the tier1 3 field value.
        tier1_3: { min: 0, max: 0 },
        // Provide the tier7 31 field value.
        tier7_31: { min: 0, max: 0 },
        // Provide the tier31 plus field value.
        tier31_plus: { min: 0, max: 0 },
      },
    });
  });

  // Define a single test case and its expectations.
  test('GET /api/chat/cars-by-filter returns validation error for out-of-range seatsMin', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/chat/cars-by-filter')
      // Call .query to perform this step.
      .query({ seatsMin: '99' })
      // Call .expect to perform this step.
      .expect(400);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(response.body.error).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the code field value.
        code: 'VALIDATION_ERROR',
        // Provide the message field value.
        message: 'seatsMin must be an integer between 2 and 9.',
        // Provide the details field value.
        details: expect.any(Array),
      })
    );
  });
});
