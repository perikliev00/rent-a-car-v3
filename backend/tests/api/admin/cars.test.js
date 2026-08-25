const request = require('supertest');
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
const { loginAsAdmin, loginAsCustomer } = require('../../helpers/apiAdminLogin');

jest.mock('../../../src/services/reservationService', () => ({}));
jest.mock('../../../src/middleware/rateLimit', () =>
  require('../../helpers/rateLimitPassthrough')()
);
jest.mock('../../../src/services/rbac/rbacService', () =>
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../../src/services/admin/carAdminService');
jest.mock('../../../src/middleware/adminCarUpload', () => {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage() });
  return {
    adminCarImageUpload: [(_req, _res, next) => next(), upload.single('image')],
    adminCarDocumentUpload: [(_req, _res, next) => next(), upload.single('file')],
    adminCarDamagePhotosUpload: [(_req, _res, next) => next(), upload.array('photos', 5)],
  };
});
jest.mock('../../../src/middleware/fileUpload/validateUploadedImage', () => ({
  validateUploadedImage: (_req, _res, next) => next(),
  validateUploadedImages: (_req, _res, next) => next(),
}));
jest.mock('../../../src/middleware/fileUpload/uploadUtils', () => ({
  removeUploadedFile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const carAdminService = require('../../../src/services/admin/carAdminService');

const mockCar = {
  id: 7,
  name: 'Toyota Yaris',
  transmission: 'Automatic',
  seats: 5,
  fuelType: 'Petrol',
  price: 45,
  availability: true,
};

const validCarBody = {
  name: 'Toyota Yaris',
  transmission: 'Automatic',
  seats: 5,
  fuelType: 'Petrol',
  priceTier_1_3: 45,
};

describe('GET /api/admin/cars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.listCars.mockResolvedValue([mockCar]);
  });

  test('returns cars list for admin', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/cars').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { cars: [mockCar] },
    });
  });
});

describe('GET /api/admin/cars/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.getCarById.mockResolvedValue(mockCar);
  });

  test('returns car by id', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/cars/7').expect(200);

    expect(response.body.data.car).toEqual(mockCar);
  });

  test('returns not found when car is missing', async () => {
    carAdminService.getCarById.mockResolvedValue(null);
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/cars/99').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/admin/cars/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.deleteCar.mockResolvedValue(undefined);
  });

  test('deletes car', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.delete('/api/admin/cars/7')).expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { deleted: true, id: 7 },
    });
    expect(carAdminService.deleteCar).toHaveBeenCalledWith('7');
  });
});

describe('POST /api/admin/cars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.createCar.mockResolvedValue({ ...mockCar, id: 8 });
  });

  test('creates car with image and returns 201', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/cars'))
      .field('name', validCarBody.name)
      .field('transmission', validCarBody.transmission)
      .field('seats', String(validCarBody.seats))
      .field('fuelType', validCarBody.fuelType)
      .field('priceTier_1_3', String(validCarBody.priceTier_1_3))
      .attach('image', Buffer.from('fake-image'), 'car.jpg')
      .expect(201);

    expect(response.body.data.car).toEqual(expect.objectContaining({ name: 'Toyota Yaris' }));
    expect(carAdminService.createCar).toHaveBeenCalled();
  });

  test('returns validation error when required fields are missing', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/cars')).send({}).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(carAdminService.createCar).not.toHaveBeenCalled();
  });
});

describe('PUT /api/admin/cars/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.updateCar.mockResolvedValue({
      car: mockCar,
      audit: { priceChanged: false, name: mockCar.name },
    });
  });

  test('updates car without image', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/cars/7'))
      .send(validCarBody)
      .expect(200);

    expect(response.body.data.car).toEqual(mockCar);
  });

  test('updates car with new image', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/cars/7'))
      .field('name', validCarBody.name)
      .field('transmission', validCarBody.transmission)
      .field('seats', String(validCarBody.seats))
      .field('fuelType', validCarBody.fuelType)
      .field('priceTier_1_3', String(validCarBody.priceTier_1_3))
      .attach('image', Buffer.from('fake-image'), 'car.jpg')
      .expect(200);

    expect(response.body.data.car).toEqual(mockCar);
  });

  test('returns not found when car does not exist', async () => {
    carAdminService.updateCar.mockRejectedValue(new Error('Car not found'));
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/cars/99'))
      .send(validCarBody)
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/admin/cars/:id/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.changeFleetStatus.mockResolvedValue({
      car: { ...mockCar, status: 'in_maintenance' },
      oldStatus: 'available',
      newStatus: 'in_maintenance',
      reason: 'service',
    });
  });

  test('changes fleet status', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/cars/7/status'))
      .send({ status: 'in_maintenance', reason: 'service' })
      .expect(200);

    expect(response.body.data.newStatus).toBe('in_maintenance');
    expect(carAdminService.changeFleetStatus).toHaveBeenCalledWith(
      '7',
      'in_maintenance',
      'service'
    );
  });

  test('rejects invalid status', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/cars/7/status'))
      .send({ status: 'flying' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/admin/cars/:id/service-records', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.listServiceRecords.mockResolvedValue([
      { id: 1, serviceType: 'oil_change', serviceDate: '2026-01-01' },
    ]);
  });

  test('lists service records', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/cars/7/service-records').expect(200);

    expect(response.body.data.records).toHaveLength(1);
  });
});

describe('GET /api/admin/cars/:id/compliance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.listCompliance.mockResolvedValue([
      {
        id: 1,
        carId: '7',
        itemType: 'civil_insurance',
        label: 'Гражданска отговорност',
        expiresAt: '2026-12-01',
        status: 'valid',
      },
    ]);
  });

  test('lists compliance items', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/cars/7/compliance').expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].itemType).toBe('civil_insurance');
    expect(carAdminService.listCompliance).toHaveBeenCalledWith('7');
  });
});

describe('POST /api/admin/cars/:id/compliance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.createCompliance.mockResolvedValue({
      id: 2,
      carId: '7',
      itemType: 'vignette',
      label: 'Винетка',
      expiresAt: '2026-12-31',
      status: 'valid',
    });
  });

  test('creates compliance item', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/cars/7/compliance'))
      .field('itemType', 'vignette')
      .field('expiresAt', '2026-12-31')
      .expect(201);

    expect(response.body.data.item.itemType).toBe('vignette');
    expect(carAdminService.createCompliance).toHaveBeenCalled();
  });

  test('returns validation error for invalid type', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/cars/7/compliance'))
      .field('itemType', 'not_a_type')
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(carAdminService.createCompliance).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/cars/fleet-alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.getFleetAlerts.mockResolvedValue({
      summary: { total: 2, critical: 1, warning: 1, info: 0 },
      alerts: [
        {
          id: 'persisted:1',
          type: 'insurance_expired',
          severity: 'critical',
          carId: '7',
          carName: 'Toyota Yaris',
          message: 'Гражданска отговорност expired on 2026-01-01',
        },
        {
          id: 'persisted:2',
          type: 'unresolved_damage',
          severity: 'warning',
          carId: '3',
          carName: 'BMW 320d',
          message: 'Unresolved damage: dent',
        },
      ],
    });
  });

  test('returns fleet alerts for admin including persisted types', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/cars/fleet-alerts').expect(200);

    expect(response.body.data.summary.total).toBe(2);
    expect(response.body.data.alerts[0].type).toBe('insurance_expired');
    expect(response.body.data.alerts[1].type).toBe('unresolved_damage');
    expect(carAdminService.getFleetAlerts).toHaveBeenCalled();
  });
});

describe('POST /api/admin/cars/fleet-alerts/reconcile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carAdminService.reconcileFleetAlerts.mockResolvedValue({
      todayStr: '2026-07-31',
      upserted: 2,
      resolved: 0,
      desired: 2,
      skipped: false,
    });
    carAdminService.getFleetAlerts.mockResolvedValue({
      summary: { total: 1, critical: 1, warning: 0, info: 0 },
      alerts: [
        {
          id: 'persisted:1',
          type: 'insurance_expired',
          severity: 'critical',
          carId: '7',
          carName: 'Yaris',
          message: 'expired',
        },
      ],
    });
  });

  test('reconciles and returns fleet alerts', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(
      agent,
      agent.post('/api/admin/cars/fleet-alerts/reconcile')
    ).expect(200);

    expect(carAdminService.reconcileFleetAlerts).toHaveBeenCalled();
    expect(response.body.data.reconcile.upserted).toBe(2);
    expect(response.body.data.alerts[0].type).toBe('insurance_expired');
  });
});

describe('GET /api/admin/cars/:id/availability', () => {
  test('returns validation error for invalid query params', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent
      .get('/api/admin/cars/7/availability')
      .query({ pickupDate: 'invalid', returnDate: '2026-07-12' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('admin cars authorization', () => {
  test('returns unauthorized without session', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/admin/cars').expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  test('returns forbidden for non-admin customer', async () => {
    const app = createApiTestApp();
    const agent = await loginAsCustomer(app);

    const response = await agent.get('/api/admin/cars').expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
