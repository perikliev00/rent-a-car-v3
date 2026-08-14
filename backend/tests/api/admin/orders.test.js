const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApiTestApp, initTestAgent, withCsrf } = require('../../helpers/apiTestApp');

jest.mock('../../../src/services/reservationService', () => ({}));
jest.mock('../../../src/middleware/rateLimit', () => ({
  authLimiter: (_req, _res, next) => next(),
  loginLimiter: (_req, _res, next) => next(),
  signupLimiter: (_req, _res, next) => next(),
  adminLimiter: (_req, _res, next) => next(),
  adminUploadLimiter: (_req, _res, next) => next(),
  accountUploadLimiter: (_req, _res, next) => next(),
}));
jest.mock('../../../src/services/rbac/rbacService', () =>
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('../../../src/services/admin/order');
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userSql = require('../../../src/services/sql/userSqlService');
const orderAdminService = require('../../../src/services/admin/order');

const adminUser = {
  id: 1,
  email: 'admin@example.com',
  password: 'hashed-password',
  role: 'admin',
};

const mockOrder = {
  id: '42',
  carId: { id: 7, name: 'Toyota Yaris' },
  status: 'active',
  totalPrice: 120,
};

async function loginAsAdmin(app) {
  const agent = await initTestAgent(app);
  userSql.findUserByEmail.mockResolvedValue(adminUser);
  bcrypt.compare.mockResolvedValue(true);
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({ email: 'admin@example.com', password: 'Secret123' })
    .expect(200);
  agent.csrfToken = loginRes.body.data.csrfToken;
  return agent;
}

async function loginAsCustomer(app) {
  const agent = await initTestAgent(app);
  userSql.findUserByEmail.mockResolvedValue({
    id: 2,
    email: 'user@example.com',
    password: 'hashed-password',
    role: 'customer',
  });
  bcrypt.compare.mockResolvedValue(true);
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({ email: 'user@example.com', password: 'Secret123' })
    .expect(200);
  agent.csrfToken = loginRes.body.data.csrfToken;
  return agent;
}

describe('GET /api/admin/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.getOrdersList.mockResolvedValue({
      orders: [mockOrder],
      filters: { status: '', startDate: '', endDate: '', search: '' },
    });
  });

  test('returns orders list for admin', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/orders').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.orders).toEqual([mockOrder]);
  });

  test('returns validation error for invalid list filters', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent
      .get('/api/admin/orders')
      .query({ status: 'invalid-status' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/admin/orders/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.getOrderDetails.mockResolvedValue(mockOrder);
  });

  test('returns order by id', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/orders/42').expect(200);

    expect(response.body.data.order).toEqual(mockOrder);
  });

  test('returns not found when order is missing', async () => {
    orderAdminService.getOrderDetails.mockResolvedValue(null);
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/orders/99').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

const validAdminOrderBody = {
  carId: 7,
  pickupDate: '2030-07-10',
  returnDate: '2030-07-12',
  pickupLocation: 'office',
  returnLocation: 'office',
  pickupTime: '10:00',
  returnTime: '10:00',
  fullName: 'Jane Doe',
  phoneNumber: '+359888123456',
  email: 'jane@example.com',
  address: 'Main St 1',
};

describe('POST /api/admin/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.createOrder.mockResolvedValue({ success: true, orderId: 42 });
  });

  test('creates order and returns 201', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/orders'))
      .send(validAdminOrderBody)
      .expect(201);

    expect(response.body.data).toEqual({ created: true, id: 42 });
  });

  test('returns validation error for missing required fields', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/orders')).send({}).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns validation error from service', async () => {
    orderAdminService.createOrder.mockResolvedValue({
      success: false,
      status: 422,
      viewModel: { error: 'Car selection is required.' },
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/orders'))
      .send(validAdminOrderBody)
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Car selection is required.');
  });
});

describe('DELETE /api/admin/orders/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.deleteOrder.mockResolvedValue(undefined);
  });

  test('deletes order', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.delete('/api/admin/orders/42')).expect(200);

    expect(response.body.data).toEqual({ deleted: true, id: 42 });
  });
});

describe('GET /api/admin/orders/expired', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.getExpiredOrders.mockResolvedValue({ orders: [mockOrder] });
  });

  test('returns expired orders list', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/orders/expired').expect(200);

    expect(response.body.data.orders).toEqual([mockOrder]);
  });
});

describe('GET /api/admin/orders/deleted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.getDeletedOrders.mockResolvedValue({ orders: [mockOrder] });
  });

  test('returns deleted orders with retention metadata', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/orders/deleted').expect(200);

    expect(response.body.data.orders).toEqual([mockOrder]);
    expect(response.body.data.retentionDays).toBeDefined();
    expect(response.body.data.emptyConfirmText).toBe('EMPTY DELETED ORDERS');
  });
});

describe('POST /api/admin/orders/deleted/empty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.emptyDeletedOrders.mockResolvedValue({ deletedCount: 3 });
  });

  test('empties deleted orders bin on valid confirmation', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/orders/deleted/empty'))
      .send({ confirmText: 'EMPTY DELETED ORDERS' })
      .expect(200);

    expect(response.body.data).toEqual({ deletedCount: 3 });
  });

  test('returns validation error when confirm text is missing', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/orders/deleted/empty'))
      .send({})
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/admin/orders/new', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.getCreateOrderForm.mockResolvedValue({ cars: [], locations: [] });
  });

  test('returns create order form data', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/orders/new').expect(200);

    expect(response.body.data).toEqual({ cars: [], locations: [] });
  });
});

describe('GET /api/admin/orders/:id/edit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.getOrderEditData.mockResolvedValue({ order: mockOrder, cars: [] });
  });

  test('returns order edit form data', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/orders/42/edit').expect(200);

    expect(response.body.data.order).toEqual(mockOrder);
  });

  test('returns not found when order is missing', async () => {
    orderAdminService.getOrderEditData.mockResolvedValue(null);
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/orders/99/edit').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PUT /api/admin/orders/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.updateOrder.mockResolvedValue({ success: true });
  });

  test('updates order successfully', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/orders/42'))
      .send(validAdminOrderBody)
      .expect(200);

    expect(response.body.data).toEqual({ updated: true, id: 42 });
  });

  test('returns validation error for missing fields', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/orders/42')).send({}).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns validation error from service', async () => {
    orderAdminService.updateOrder.mockResolvedValue({
      success: false,
      status: 422,
      viewModel: { error: 'Invalid booking dates.' },
    });
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/orders/42'))
      .send(validAdminOrderBody)
      .expect(422);

    expect(response.body.error.message).toBe('Invalid booking dates.');
  });

  test('returns not found when order does not exist', async () => {
    const notFoundError = new Error('Order not found');
    notFoundError.status = 404;
    orderAdminService.updateOrder.mockRejectedValue(notFoundError);
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/orders/99'))
      .send(validAdminOrderBody)
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/admin/orders/:id/restore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.restoreOrder.mockResolvedValue(undefined);
  });

  test('restores deleted order', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/orders/42/restore')).expect(200);

    expect(response.body.data).toEqual({ restored: true, id: 42 });
  });

  test('returns conflict when restore fails', async () => {
    const restoreError = new Error('Car is not available for these dates.');
    restoreError.isOrderRestoreError = true;
    orderAdminService.restoreOrder.mockRejectedValue(restoreError);
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/orders/42/restore')).expect(422);

    expect(response.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /api/admin/cars/:id/availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAdminService.getCarAvailability.mockResolvedValue({
      status: 200,
      body: { ok: true, available: true, conflicts: [] },
    });
  });

  test('returns availability in envelope', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent
      .get('/api/admin/cars/7/availability')
      .query({
        pickupDate: '2030-07-10',
        returnDate: '2030-07-12',
      })
      .expect(200);

    expect(response.body.data).toEqual({ available: true, conflicts: [] });
  });
});

describe('admin orders authorization', () => {
  test('returns unauthorized without session', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/admin/orders').expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  test('returns forbidden for non-admin customer', async () => {
    const app = createApiTestApp();
    const agent = await loginAsCustomer(app);

    const response = await agent.get('/api/admin/orders').expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
