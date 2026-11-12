// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
// Destructure object properties into local variables.
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

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
jest.mock('../../../src/services/admin/pricingAdminService', () => ({
  // Provide the get pricing bundle field value.
  getPricingBundle: jest.fn(),
  // Provide the save delivery fees field value.
  saveDeliveryFees: jest.fn(),
  // Provide the save global fee field value.
  saveGlobalFee: jest.fn(),
  // Provide the create season field value.
  createSeason: jest.fn(),
  // Provide the update season field value.
  updateSeason: jest.fn(),
  // Provide the delete season field value.
  deleteSeason: jest.fn(),
  // Provide the save weekend rule field value.
  saveWeekendRule: jest.fn(),
  // Provide the update discount field value.
  updateDiscount: jest.fn(),
  // Provide the save deposit field value.
  saveDeposit: jest.fn(),
  // Provide the create extra field value.
  createExtra: jest.fn(),
  // Provide the update extra field value.
  updateExtra: jest.fn(),
  // Provide the delete extra field value.
  deleteExtra: jest.fn(),
  // Provide the preview pricing field value.
  previewPricing: jest.fn(),
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

// Require the '../../../src/services/admin/pricingAdminService' module as pricingAdminService.
const pricingAdminService = require('../../../src/services/admin/pricingAdminService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../src/services/admin/adminAuditService');
// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Create the mock pricing constant.
const mockPricing = {
  // Provide the seasons field value.
  seasons: [],
  // Provide the weekend rules field value.
  weekendRules: [],
  // Provide the discount rules field value.
  discountRules: [],
  // Provide the deposit rules field value.
  depositRules: [{ id: 1, name: 'Standard', defaultAmount: 200, active: true }],
  // Provide the delivery fees field value.
  deliveryFees: [{ locationId: 'burgas-airport', fee: 25 }],
  // Provide the delivery fee map field value.
  deliveryFeeMap: { 'burgas-airport': 25 },
  // Provide the global fees field value.
  globalFees: [],
  // Provide the extras field value.
  extras: [],
};

// Declare a test suite grouping related cases.
describe('Admin pricing APIs', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: ALL_PERMISSIONS,
      // Provide the role details field value.
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
    // Call pricingAdminService.getPricingBundle.mockResolvedValue to perform this step.
    pricingAdminService.getPricingBundle.mockResolvedValue(mockPricing);
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/pricing returns pricing bundle', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/pricing').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.pricing.depositRules).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(pricingAdminService.getPricingBundle).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('PUT /api/admin/pricing/delivery-fees updates fees and audits', async () => {
    // Call pricingAdminService.saveDeliveryFees.mockResolvedValue to perform this step.
    pricingAdminService.saveDeliveryFees.mockResolvedValue([
      // Contribute this line to the enclosing declaration or statement.
      { locationId: 'sofia-airport', fee: 40 },
    ]);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/pricing/delivery-fees'))
      // Call .send to perform this step.
      .send({ fees: [{ locationId: 'sofia-airport', fee: 40 }] })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.deliveryFees[0].fee).toBe(40);
    // Assert that the value matches the intended expectation.
    expect(pricingAdminService.saveDeliveryFees).toHaveBeenCalledWith([
      // Contribute this line to the enclosing declaration or statement.
      { locationId: 'sofia-airport', fee: 40 },
    ]);
    // Assert that the value matches the intended expectation.
    expect(logAdminAction).toHaveBeenCalledWith(
      // Call expect.anything to perform this step.
      expect.anything(),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ action: 'admin.updated_pricing_delivery_fees' })
    );
  });

  // Define a single test case and its expectations.
  test('PUT /api/admin/pricing/global-fees/:feeKey updates fee', async () => {
    // Call pricingAdminService.saveGlobalFee.mockResolvedValue to perform this step.
    pricingAdminService.saveGlobalFee.mockResolvedValue({
      // Provide the fee key field value.
      feeKey: 'fuel',
      // Provide the label field value.
      label: 'Fuel fee',
      // Provide the amount field value.
      amount: 15,
      // Provide the mode field value.
      mode: 'flat',
      // Provide the active field value.
      active: true,
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/pricing/global-fees/fuel'))
      // Call .send to perform this step.
      .send({ label: 'Fuel fee', amount: 15, mode: 'flat' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.globalFee.feeKey).toBe('fuel');
    // Assert that the value matches the intended expectation.
    expect(pricingAdminService.saveGlobalFee).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'fuel',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ amount: 15, label: 'Fuel fee' })
    );
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/pricing/seasons creates season', async () => {
    // Call pricingAdminService.createSeason.mockResolvedValue to perform this step.
    pricingAdminService.createSeason.mockResolvedValue({
      // Provide the id field value.
      id: 9,
      // Provide the name field value.
      name: 'Summer',
      // Provide the start month field value.
      startMonth: 6,
      // Provide the start day field value.
      startDay: 1,
      // Provide the end month field value.
      endMonth: 8,
      // Provide the end day field value.
      endDay: 31,
      // Provide the adj type field value.
      adjType: 'percent',
      // Provide the adj value field value.
      adjValue: 20,
      // Provide the active field value.
      active: true,
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/pricing/seasons'))
      // Call .send to perform this step.
      .send({
        // Provide the name field value.
        name: 'Summer',
        // Provide the start month field value.
        startMonth: 6,
        // Provide the start day field value.
        startDay: 1,
        // Provide the end month field value.
        endMonth: 8,
        // Provide the end day field value.
        endDay: 31,
        // Provide the adj type field value.
        adjType: 'percent',
        // Provide the adj value field value.
        adjValue: 20,
      })
      // Call .expect to perform this step.
      .expect(201);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.season.id).toBe(9);
  });

  // Define a single test case and its expectations.
  test('PUT /api/admin/pricing/seasons/:id returns 404 when missing', async () => {
    // Call pricingAdminService.updateSeason.mockResolvedValue to perform this step.
    pricingAdminService.updateSeason.mockResolvedValue(null);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/pricing/seasons/99'))
      // Call .send to perform this step.
      .send({
        // Provide the name field value.
        name: 'Ghost',
        // Provide the start month field value.
        startMonth: 1,
        // Provide the start day field value.
        startDay: 1,
        // Provide the end month field value.
        endMonth: 1,
        // Provide the end day field value.
        endDay: 31,
        // Provide the adj value field value.
        adjValue: 0,
      })
      // Call .expect to perform this step.
      .expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  // Define a single test case and its expectations.
  test('DELETE /api/admin/pricing/seasons/:id deletes season', async () => {
    // Call pricingAdminService.deleteSeason.mockResolvedValue to perform this step.
    pricingAdminService.deleteSeason.mockResolvedValue(true);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/admin/pricing/seasons/3')).expect(
      // Supply the literal value used by the enclosing expression.
      200
    );

    // Assert that the value matches the intended expectation.
    expect(response.body.data.deleted).toBe(true);
  });

  // Define a single test case and its expectations.
  test('PUT /api/admin/pricing/weekend saves weekend rule', async () => {
    // Call pricingAdminService.saveWeekendRule.mockResolvedValue to perform this step.
    pricingAdminService.saveWeekendRule.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the name field value.
      name: 'Weekend',
      // Provide the weekdays field value.
      weekdays: [5, 6],
      // Provide the adj type field value.
      adjType: 'percent',
      // Provide the adj value field value.
      adjValue: 10,
      // Provide the active field value.
      active: true,
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/pricing/weekend'))
      // Call .send to perform this step.
      .send({ id: 1, name: 'Weekend', weekdays: [5, 6], adjValue: 10 })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.weekendRule.adjValue).toBe(10);
  });

  // Define a single test case and its expectations.
  test('PUT /api/admin/pricing/discounts/:id updates discount', async () => {
    // Call pricingAdminService.updateDiscount.mockResolvedValue to perform this step.
    pricingAdminService.updateDiscount.mockResolvedValue({
      // Provide the id field value.
      id: 2,
      // Provide the name field value.
      name: 'Long stay',
      // Provide the threshold field value.
      threshold: 7,
      // Provide the adj type field value.
      adjType: 'percent',
      // Provide the adj value field value.
      adjValue: 15,
      // Provide the active field value.
      active: true,
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/pricing/discounts/2'))
      // Call .send to perform this step.
      .send({ adjValue: 15, active: true })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.discountRule.id).toBe(2);
  });

  // Define a single test case and its expectations.
  test('PUT /api/admin/pricing/deposit saves deposit rule', async () => {
    // Call pricingAdminService.saveDeposit.mockResolvedValue to perform this step.
    pricingAdminService.saveDeposit.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the name field value.
      name: 'Standard',
      // Provide the default amount field value.
      defaultAmount: 250,
      // Provide the active field value.
      active: true,
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/pricing/deposit'))
      // Call .send to perform this step.
      .send({ id: 1, name: 'Standard', defaultAmount: 250 })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.depositRule.defaultAmount).toBe(250);
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/pricing/extras creates extra', async () => {
    // Call pricingAdminService.createExtra.mockResolvedValue to perform this step.
    pricingAdminService.createExtra.mockResolvedValue({
      // Provide the id field value.
      id: 4,
      // Provide the code field value.
      code: 'child_seat',
      // Provide the label field value.
      label: 'Child seat',
      // Provide the mode field value.
      mode: 'flat',
      // Provide the amount field value.
      amount: 20,
      // Provide the active field value.
      active: true,
      // Provide the sort order field value.
      sortOrder: 0,
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/pricing/extras'))
      // Call .send to perform this step.
      .send({ code: 'child_seat', label: 'Child seat', amount: 20 })
      // Call .expect to perform this step.
      .expect(201);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.extra.code).toBe('child_seat');
  });

  // Define a single test case and its expectations.
  test('DELETE /api/admin/pricing/extras/:id returns 404 when missing', async () => {
    // Call pricingAdminService.deleteExtra.mockResolvedValue to perform this step.
    pricingAdminService.deleteExtra.mockResolvedValue(false);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/admin/pricing/extras/88')).expect(
      // Supply the literal value used by the enclosing expression.
      404
    );

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/pricing/preview returns quote', async () => {
    // Call pricingAdminService.previewPricing.mockResolvedValue to perform this step.
    pricingAdminService.previewPricing.mockResolvedValue({
      // Provide the ok field value.
      ok: true,
      // Provide the car field value.
      car: { id: 7, name: 'Yaris' },
      // Provide the pricing field value.
      pricing: { totalPrice: 180, deposit: 200, rentalDays: 3 },
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/pricing/preview'))
      // Call .send to perform this step.
      .send({
        // Provide the car id field value.
        carId: 7,
        // Provide the pickup date field value.
        pickupDate: '2026-08-10',
        // Provide the return date field value.
        returnDate: '2026-08-13',
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
      })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.pricing.totalPrice).toBe(180);
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/pricing/preview surfaces service errors', async () => {
    // Call pricingAdminService.previewPricing.mockResolvedValue to perform this step.
    pricingAdminService.previewPricing.mockResolvedValue({
      // Provide the ok field value.
      ok: false,
      // Provide the status field value.
      status: 400,
      // Provide the error field value.
      error: 'carId is required',
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/pricing/preview'))
      // Call .send to perform this step.
      .send({ pickupLocation: 'office', returnLocation: 'office' })
      // Call .expect to perform this step.
      .expect(400);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('PRICING_PREVIEW_FAILED');
  });

  // Define a single test case and its expectations.
  test('returns 403 when admin lacks can_manage_pricing', async () => {
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_orders'],
      // Provide the role details field value.
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/pricing').expect(403);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  // Define a single test case and its expectations.
  test('returns 401 without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the response constant.
    const response = await request(app).get('/api/admin/pricing').expect(401);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
