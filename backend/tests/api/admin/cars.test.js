// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin, loginAsCustomer } = require('../../helpers/apiAdminLogin');

// Call jest.mock to perform this step.
jest.mock('../../../src/services/reservationService', () => ({}));
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../../helpers/rateLimitPassthrough')
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/rbac/rbacService', () =>
  // Call require to perform this step.
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/userSqlService', () => ({
  // Provide the find user by email field value.
  findUserByEmail: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/account/accountClaimService', () => ({
  // Provide the claim reservations for user field value.
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/carAdminService');
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/adminCarUpload', () => {
  // Require the 'multer' module as multer.
  const multer = require('multer');
  // Create the upload constant.
  const upload = multer({ storage: multer.memoryStorage() });
  // Return the resulting value to the caller.
  return {
    // Provide the admin car image upload field value.
    adminCarImageUpload: [(_req, _res, next) => next(), upload.single('image')],
    // Provide the admin car document upload field value.
    adminCarDocumentUpload: [(_req, _res, next) => next(), upload.single('file')],
    // Provide the admin car damage photos upload field value.
    adminCarDamagePhotosUpload: [(_req, _res, next) => next(), upload.array('photos', 5)],
  };
});
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/fileUpload/validateUploadedImage', () => ({
  // Provide the validate uploaded image field value.
  validateUploadedImage: (_req, _res, next) => next(),
  // Provide the validate uploaded images field value.
  validateUploadedImages: (_req, _res, next) => next(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/fileUpload/uploadUtils', () => ({
  // Provide the remove uploaded file field value.
  removeUploadedFile: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/services/admin/carAdminService' module as carAdminService.
const carAdminService = require('../../../src/services/admin/carAdminService');

// Create the mock car constant.
const mockCar = {
  // Provide the id field value.
  id: 7,
  // Provide the name field value.
  name: 'Toyota Yaris',
  // Provide the transmission field value.
  transmission: 'Automatic',
  // Provide the seats field value.
  seats: 5,
  // Provide the fuel type field value.
  fuelType: 'Petrol',
  // Provide the price field value.
  price: 45,
  // Provide the availability field value.
  availability: true,
};

// Create the valid car body constant.
const validCarBody = {
  // Provide the name field value.
  name: 'Toyota Yaris',
  // Provide the transmission field value.
  transmission: 'Automatic',
  // Provide the seats field value.
  seats: 5,
  // Provide the fuel type field value.
  fuelType: 'Petrol',
  // Provide the price tier 1 3 field value.
  priceTier_1_3: 45,
};

// Declare a test suite grouping related cases.
describe('GET /api/admin/cars', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.listCars.mockResolvedValue to perform this step.
    carAdminService.listCars.mockResolvedValue([mockCar]);
  });

  // Define a single test case and its expectations.
  test('returns cars list for admin', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/cars').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { cars: [mockCar] },
    });
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/cars/:id', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.getCarById.mockResolvedValue to perform this step.
    carAdminService.getCarById.mockResolvedValue(mockCar);
  });

  // Define a single test case and its expectations.
  test('returns car by id', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/cars/7').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.car).toEqual(mockCar);
  });

  // Define a single test case and its expectations.
  test('returns not found when car is missing', async () => {
    // Call carAdminService.getCarById.mockResolvedValue to perform this step.
    carAdminService.getCarById.mockResolvedValue(null);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/cars/99').expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

// Declare a test suite grouping related cases.
describe('DELETE /api/admin/cars/:id', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.deleteCar.mockResolvedValue to perform this step.
    carAdminService.deleteCar.mockResolvedValue(undefined);
  });

  // Define a single test case and its expectations.
  test('deletes car', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/admin/cars/7')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { deleted: true, id: 7 },
    });
    // Assert that the value matches the intended expectation.
    expect(carAdminService.deleteCar).toHaveBeenCalledWith('7');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/admin/cars', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.createCar.mockResolvedValue to perform this step.
    carAdminService.createCar.mockResolvedValue({ ...mockCar, id: 8 });
  });

  // Define a single test case and its expectations.
  test('creates car with image and returns 201', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/cars'))
      // Call .field to perform this step.
      .field('name', validCarBody.name)
      // Call .field to perform this step.
      .field('transmission', validCarBody.transmission)
      // Call .field to perform this step.
      .field('seats', String(validCarBody.seats))
      // Call .field to perform this step.
      .field('fuelType', validCarBody.fuelType)
      // Call .field to perform this step.
      .field('priceTier_1_3', String(validCarBody.priceTier_1_3))
      // Call .attach to perform this step.
      .attach('image', Buffer.from('fake-image'), 'car.jpg')
      // Call .expect to perform this step.
      .expect(201);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.car).toEqual(expect.objectContaining({ name: 'Toyota Yaris' }));
    // Assert that the value matches the intended expectation.
    expect(carAdminService.createCar).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns validation error when required fields are missing', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/cars')).send({}).expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(carAdminService.createCar).not.toHaveBeenCalled();
  });
});

// Declare a test suite grouping related cases.
describe('PUT /api/admin/cars/:id', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.updateCar.mockResolvedValue to perform this step.
    carAdminService.updateCar.mockResolvedValue({
      // Provide the car field value.
      car: mockCar,
      // Provide the audit field value.
      audit: { priceChanged: false, name: mockCar.name },
    });
  });

  // Define a single test case and its expectations.
  test('updates car without image', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/cars/7'))
      // Call .send to perform this step.
      .send(validCarBody)
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.car).toEqual(mockCar);
  });

  // Define a single test case and its expectations.
  test('updates car with new image', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/cars/7'))
      // Call .field to perform this step.
      .field('name', validCarBody.name)
      // Call .field to perform this step.
      .field('transmission', validCarBody.transmission)
      // Call .field to perform this step.
      .field('seats', String(validCarBody.seats))
      // Call .field to perform this step.
      .field('fuelType', validCarBody.fuelType)
      // Call .field to perform this step.
      .field('priceTier_1_3', String(validCarBody.priceTier_1_3))
      // Call .attach to perform this step.
      .attach('image', Buffer.from('fake-image'), 'car.jpg')
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.car).toEqual(mockCar);
  });

  // Define a single test case and its expectations.
  test('returns not found when car does not exist', async () => {
    // Call carAdminService.updateCar.mockRejectedValue to perform this step.
    carAdminService.updateCar.mockRejectedValue(new Error('Car not found'));
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/cars/99'))
      // Call .send to perform this step.
      .send(validCarBody)
      // Call .expect to perform this step.
      .expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/admin/cars/:id/status', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.changeFleetStatus.mockResolvedValue to perform this step.
    carAdminService.changeFleetStatus.mockResolvedValue({
      // Provide the car field value.
      car: { ...mockCar, status: 'in_maintenance' },
      // Provide the old status field value.
      oldStatus: 'available',
      // Provide the new status field value.
      newStatus: 'in_maintenance',
      // Provide the reason field value.
      reason: 'service',
    });
  });

  // Define a single test case and its expectations.
  test('changes fleet status', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/cars/7/status'))
      // Call .send to perform this step.
      .send({ status: 'in_maintenance', reason: 'service' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.newStatus).toBe('in_maintenance');
    // Assert that the value matches the intended expectation.
    expect(carAdminService.changeFleetStatus).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      '7',
      // Supply the literal value used by the enclosing expression.
      'in_maintenance',
      // Supply the literal value used by the enclosing expression.
      'service'
    );
  });

  // Define a single test case and its expectations.
  test('rejects invalid status', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/cars/7/status'))
      // Call .send to perform this step.
      .send({ status: 'flying' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/cars/:id/service-records', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.listServiceRecords.mockResolvedValue to perform this step.
    carAdminService.listServiceRecords.mockResolvedValue([
      // Contribute this line to the enclosing declaration or statement.
      { id: 1, serviceType: 'oil_change', serviceDate: '2026-01-01' },
    ]);
  });

  // Define a single test case and its expectations.
  test('lists service records', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/cars/7/service-records').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.records).toHaveLength(1);
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/cars/:id/compliance', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.listCompliance.mockResolvedValue to perform this step.
    carAdminService.listCompliance.mockResolvedValue([
      {
        // Provide the id field value.
        id: 1,
        // Provide the car id field value.
        carId: '7',
        // Provide the item type field value.
        itemType: 'civil_insurance',
        // Provide the label field value.
        label: 'Гражданска отговорност',
        // Provide the expires at field value.
        expiresAt: '2026-12-01',
        // Provide the status field value.
        status: 'valid',
      },
    ]);
  });

  // Define a single test case and its expectations.
  test('lists compliance items', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/cars/7/compliance').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.items).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.items[0].itemType).toBe('civil_insurance');
    // Assert that the value matches the intended expectation.
    expect(carAdminService.listCompliance).toHaveBeenCalledWith('7');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/admin/cars/:id/compliance', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.createCompliance.mockResolvedValue to perform this step.
    carAdminService.createCompliance.mockResolvedValue({
      // Provide the id field value.
      id: 2,
      // Provide the car id field value.
      carId: '7',
      // Provide the item type field value.
      itemType: 'vignette',
      // Provide the label field value.
      label: 'Винетка',
      // Provide the expires at field value.
      expiresAt: '2026-12-31',
      // Provide the status field value.
      status: 'valid',
    });
  });

  // Define a single test case and its expectations.
  test('creates compliance item', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/cars/7/compliance'))
      // Call .field to perform this step.
      .field('itemType', 'vignette')
      // Call .field to perform this step.
      .field('expiresAt', '2026-12-31')
      // Call .expect to perform this step.
      .expect(201);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.item.itemType).toBe('vignette');
    // Assert that the value matches the intended expectation.
    expect(carAdminService.createCompliance).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns validation error for invalid type', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/cars/7/compliance'))
      // Call .field to perform this step.
      .field('itemType', 'not_a_type')
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(carAdminService.createCompliance).not.toHaveBeenCalled();
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/cars/fleet-alerts', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.getFleetAlerts.mockResolvedValue to perform this step.
    carAdminService.getFleetAlerts.mockResolvedValue({
      // Provide the summary field value.
      summary: { total: 2, critical: 1, warning: 1, info: 0 },
      // Provide the alerts field value.
      alerts: [
        {
          // Provide the id field value.
          id: 'persisted:1',
          // Provide the type field value.
          type: 'insurance_expired',
          // Provide the severity field value.
          severity: 'critical',
          // Provide the car id field value.
          carId: '7',
          // Provide the car name field value.
          carName: 'Toyota Yaris',
          // Provide the message field value.
          message: 'Гражданска отговорност expired on 2026-01-01',
        },
        {
          // Provide the id field value.
          id: 'persisted:2',
          // Provide the type field value.
          type: 'unresolved_damage',
          // Provide the severity field value.
          severity: 'warning',
          // Provide the car id field value.
          carId: '3',
          // Provide the car name field value.
          carName: 'BMW 320d',
          // Provide the message field value.
          message: 'Unresolved damage: dent',
        },
      ],
    });
  });

  // Define a single test case and its expectations.
  test('returns fleet alerts for admin including persisted types', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/cars/fleet-alerts').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.summary.total).toBe(2);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.alerts[0].type).toBe('insurance_expired');
    // Assert that the value matches the intended expectation.
    expect(response.body.data.alerts[1].type).toBe('unresolved_damage');
    // Assert that the value matches the intended expectation.
    expect(carAdminService.getFleetAlerts).toHaveBeenCalled();
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/admin/cars/fleet-alerts/reconcile', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carAdminService.reconcileFleetAlerts.mockResolvedValue to perform this step.
    carAdminService.reconcileFleetAlerts.mockResolvedValue({
      // Provide the today str field value.
      todayStr: '2026-07-31',
      // Provide the upserted field value.
      upserted: 2,
      // Provide the resolved field value.
      resolved: 0,
      // Provide the desired field value.
      desired: 2,
      // Provide the skipped field value.
      skipped: false,
    });
    // Call carAdminService.getFleetAlerts.mockResolvedValue to perform this step.
    carAdminService.getFleetAlerts.mockResolvedValue({
      // Provide the summary field value.
      summary: { total: 1, critical: 1, warning: 0, info: 0 },
      // Provide the alerts field value.
      alerts: [
        {
          // Provide the id field value.
          id: 'persisted:1',
          // Provide the type field value.
          type: 'insurance_expired',
          // Provide the severity field value.
          severity: 'critical',
          // Provide the car id field value.
          carId: '7',
          // Provide the car name field value.
          carName: 'Yaris',
          // Provide the message field value.
          message: 'expired',
        },
      ],
    });
  });

  // Define a single test case and its expectations.
  test('reconciles and returns fleet alerts', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.post to perform this step.
      agent.post('/api/admin/cars/fleet-alerts/reconcile')
    // Continue the surrounding logic with this statement.
    ).expect(200);

    // Assert that the value matches the intended expectation.
    expect(carAdminService.reconcileFleetAlerts).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(response.body.data.reconcile.upserted).toBe(2);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.alerts[0].type).toBe('insurance_expired');
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/cars/:id/availability', () => {
  // Define a single test case and its expectations.
  test('returns validation error for invalid query params', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent
      // Call .get to perform this step.
      .get('/api/admin/cars/7/availability')
      // Call .query to perform this step.
      .query({ pickupDate: 'invalid', returnDate: '2026-07-12' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// Declare a test suite grouping related cases.
describe('admin cars authorization', () => {
  // Define a single test case and its expectations.
  test('returns unauthorized without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/admin/cars').expect(401);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  // Define a single test case and its expectations.
  test('returns forbidden for non-admin customer', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsCustomer(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/cars').expect(403);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
