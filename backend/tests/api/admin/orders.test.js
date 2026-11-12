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
jest.mock('../../../src/services/admin/order', () => ({
  // Provide the get orders list field value.
  getOrdersList: jest.fn(),
  // Provide the get expired orders field value.
  getExpiredOrders: jest.fn(),
  // Provide the get deleted orders field value.
  getDeletedOrders: jest.fn(),
  // Provide the empty deleted orders field value.
  emptyDeletedOrders: jest.fn(),
  // Provide the get create order form field value.
  getCreateOrderForm: jest.fn(),
  // Provide the get car availability field value.
  getCarAvailability: jest.fn(),
  // Provide the create order field value.
  createOrder: jest.fn(),
  // Provide the get order details field value.
  getOrderDetails: jest.fn(),
  // Provide the get order edit data field value.
  getOrderEditData: jest.fn(),
  // Provide the update order field value.
  updateOrder: jest.fn(),
  // Provide the delete order field value.
  deleteOrder: jest.fn(),
  // Provide the restore order field value.
  restoreOrder: jest.fn(),
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

// Require the '../../../src/services/admin/order' module as orderAdminService.
const orderAdminService = require('../../../src/services/admin/order');

// Create the mock order constant.
const mockOrder = {
  // Provide the id field value.
  id: '42',
  // Provide the car id field value.
  carId: { id: 7, name: 'Toyota Yaris' },
  // Provide the status field value.
  status: 'active',
  // Provide the total price field value.
  totalPrice: 120,
};

// Declare a test suite grouping related cases.
describe('GET /api/admin/orders', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.getOrdersList.mockResolvedValue to perform this step.
    orderAdminService.getOrdersList.mockResolvedValue({
      // Provide the orders field value.
      orders: [mockOrder],
      // Provide the filters field value.
      filters: { status: '', startDate: '', endDate: '', search: '' },
    });
  });

  // Define a single test case and its expectations.
  test('returns orders list for admin', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/orders').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.orders).toEqual([mockOrder]);
  });

  // Define a single test case and its expectations.
  test('returns validation error for invalid list filters', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent
      // Call .get to perform this step.
      .get('/api/admin/orders')
      // Call .query to perform this step.
      .query({ status: 'invalid-status' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/orders/:id', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.getOrderDetails.mockResolvedValue to perform this step.
    orderAdminService.getOrderDetails.mockResolvedValue(mockOrder);
  });

  // Define a single test case and its expectations.
  test('returns order by id', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/orders/42').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.order).toEqual(mockOrder);
  });

  // Define a single test case and its expectations.
  test('returns not found when order is missing', async () => {
    // Call orderAdminService.getOrderDetails.mockResolvedValue to perform this step.
    orderAdminService.getOrderDetails.mockResolvedValue(null);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/orders/99').expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

// Create the valid admin order body constant.
const validAdminOrderBody = {
  // Provide the car id field value.
  carId: 7,
  // Provide the pickup date field value.
  pickupDate: '2030-07-10',
  // Provide the return date field value.
  returnDate: '2030-07-12',
  // Provide the pickup location field value.
  pickupLocation: 'office',
  // Provide the return location field value.
  returnLocation: 'office',
  // Provide the pickup time field value.
  pickupTime: '10:00',
  // Provide the return time field value.
  returnTime: '10:00',
  // Provide the full name field value.
  fullName: 'Jane Doe',
  // Provide the phone number field value.
  phoneNumber: '+359888123456',
  // Provide the email field value.
  email: 'jane@example.com',
  // Provide the address field value.
  address: 'Main St 1',
};

// Declare a test suite grouping related cases.
describe('POST /api/admin/orders', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.createOrder.mockResolvedValue to perform this step.
    orderAdminService.createOrder.mockResolvedValue({ success: true, orderId: 42 });
  });

  // Define a single test case and its expectations.
  test('creates order and returns 201', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/orders'))
      // Call .send to perform this step.
      .send(validAdminOrderBody)
      // Call .expect to perform this step.
      .expect(201);

    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual({ created: true, id: 42 });
  });

  // Define a single test case and its expectations.
  test('returns validation error for missing required fields', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/orders')).send({}).expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Define a single test case and its expectations.
  test('returns validation error from service', async () => {
    // Call orderAdminService.createOrder.mockResolvedValue to perform this step.
    orderAdminService.createOrder.mockResolvedValue({
      // Provide the success field value.
      success: false,
      // Provide the status field value.
      status: 422,
      // Provide the view model field value.
      viewModel: { error: 'Car selection is required.' },
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/orders'))
      // Call .send to perform this step.
      .send(validAdminOrderBody)
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(response.body.error.message).toBe('Car selection is required.');
  });
});

// Declare a test suite grouping related cases.
describe('DELETE /api/admin/orders/:id', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.deleteOrder.mockResolvedValue to perform this step.
    orderAdminService.deleteOrder.mockResolvedValue(undefined);
  });

  // Define a single test case and its expectations.
  test('deletes order', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/admin/orders/42')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual({ deleted: true, id: 42 });
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/orders/expired', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.getExpiredOrders.mockResolvedValue to perform this step.
    orderAdminService.getExpiredOrders.mockResolvedValue({ orders: [mockOrder] });
  });

  // Define a single test case and its expectations.
  test('returns expired orders list', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/orders/expired').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.orders).toEqual([mockOrder]);
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/orders/deleted', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.getDeletedOrders.mockResolvedValue to perform this step.
    orderAdminService.getDeletedOrders.mockResolvedValue({ orders: [mockOrder] });
  });

  // Define a single test case and its expectations.
  test('returns deleted orders with retention metadata', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/orders/deleted').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.orders).toEqual([mockOrder]);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.retentionDays).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(response.body.data.emptyConfirmText).toBe('EMPTY DELETED ORDERS');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/admin/orders/deleted/empty', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.emptyDeletedOrders.mockResolvedValue to perform this step.
    orderAdminService.emptyDeletedOrders.mockResolvedValue({ deletedCount: 3 });
  });

  // Define a single test case and its expectations.
  test('empties deleted orders bin on valid confirmation', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/orders/deleted/empty'))
      // Call .send to perform this step.
      .send({ confirmText: 'EMPTY DELETED ORDERS' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual({ deletedCount: 3 });
  });

  // Define a single test case and its expectations.
  test('returns validation error when confirm text is missing', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/orders/deleted/empty'))
      // Call .send to perform this step.
      .send({})
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/orders/new', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.getCreateOrderForm.mockResolvedValue to perform this step.
    orderAdminService.getCreateOrderForm.mockResolvedValue({ cars: [], locations: [] });
  });

  // Define a single test case and its expectations.
  test('returns create order form data', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/orders/new').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual({ cars: [], locations: [] });
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/orders/:id/edit', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.getOrderEditData.mockResolvedValue to perform this step.
    orderAdminService.getOrderEditData.mockResolvedValue({ order: mockOrder, cars: [] });
  });

  // Define a single test case and its expectations.
  test('returns order edit form data', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/orders/42/edit').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.order).toEqual(mockOrder);
  });

  // Define a single test case and its expectations.
  test('returns not found when order is missing', async () => {
    // Call orderAdminService.getOrderEditData.mockResolvedValue to perform this step.
    orderAdminService.getOrderEditData.mockResolvedValue(null);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/orders/99/edit').expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

// Declare a test suite grouping related cases.
describe('PUT /api/admin/orders/:id', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.updateOrder.mockResolvedValue to perform this step.
    orderAdminService.updateOrder.mockResolvedValue({ success: true });
  });

  // Define a single test case and its expectations.
  test('updates order successfully', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/orders/42'))
      // Call .send to perform this step.
      .send(validAdminOrderBody)
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual({ updated: true, id: 42 });
  });

  // Define a single test case and its expectations.
  test('returns validation error for missing fields', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/orders/42')).send({}).expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Define a single test case and its expectations.
  test('returns validation error from service', async () => {
    // Call orderAdminService.updateOrder.mockResolvedValue to perform this step.
    orderAdminService.updateOrder.mockResolvedValue({
      // Provide the success field value.
      success: false,
      // Provide the status field value.
      status: 422,
      // Provide the view model field value.
      viewModel: { error: 'Invalid booking dates.' },
    });
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/orders/42'))
      // Call .send to perform this step.
      .send(validAdminOrderBody)
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.message).toBe('Invalid booking dates.');
  });

  // Define a single test case and its expectations.
  test('returns not found when order does not exist', async () => {
    // Create the not found error constant.
    const notFoundError = new Error('Order not found');
    // Update notFoundError.status with the right-hand side value.
    notFoundError.status = 404;
    // Call orderAdminService.updateOrder.mockRejectedValue to perform this step.
    orderAdminService.updateOrder.mockRejectedValue(notFoundError);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/orders/99'))
      // Call .send to perform this step.
      .send(validAdminOrderBody)
      // Call .expect to perform this step.
      .expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/admin/orders/:id/restore', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.restoreOrder.mockResolvedValue to perform this step.
    orderAdminService.restoreOrder.mockResolvedValue(undefined);
  });

  // Define a single test case and its expectations.
  test('restores deleted order', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/orders/42/restore')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual({ restored: true, id: 42 });
  });

  // Define a single test case and its expectations.
  test('returns conflict when restore fails', async () => {
    // Create the restore error constant.
    const restoreError = new Error('Car is not available for these dates.');
    // Update restoreError.isOrderRestoreError with the right-hand side value.
    restoreError.isOrderRestoreError = true;
    // Call orderAdminService.restoreOrder.mockRejectedValue to perform this step.
    orderAdminService.restoreOrder.mockRejectedValue(restoreError);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/orders/42/restore')).expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('CONFLICT');
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/cars/:id/availability', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderAdminService.getCarAvailability.mockResolvedValue to perform this step.
    orderAdminService.getCarAvailability.mockResolvedValue({
      // Provide the status field value.
      status: 200,
      // Provide the body field value.
      body: { ok: true, available: true, conflicts: [] },
    });
  });

  // Define a single test case and its expectations.
  test('returns availability in envelope', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent
      // Call .get to perform this step.
      .get('/api/admin/cars/7/availability')
      // Call .query to perform this step.
      .query({
        // Provide the pickup date field value.
        pickupDate: '2030-07-10',
        // Provide the return date field value.
        returnDate: '2030-07-12',
      })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual({ available: true, conflicts: [] });
  });
});

// Declare a test suite grouping related cases.
describe('admin orders authorization', () => {
  // Define a single test case and its expectations.
  test('returns unauthorized without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/admin/orders').expect(401);

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
    const response = await agent.get('/api/admin/orders').expect(403);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
