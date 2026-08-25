const request = require('supertest');
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

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
jest.mock('../../../src/services/admin/pricingAdminService', () => ({
  getPricingBundle: jest.fn(),
  saveDeliveryFees: jest.fn(),
  saveGlobalFee: jest.fn(),
  createSeason: jest.fn(),
  updateSeason: jest.fn(),
  deleteSeason: jest.fn(),
  saveWeekendRule: jest.fn(),
  updateDiscount: jest.fn(),
  saveDeposit: jest.fn(),
  createExtra: jest.fn(),
  updateExtra: jest.fn(),
  deleteExtra: jest.fn(),
  previewPricing: jest.fn(),
}));
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const pricingAdminService = require('../../../src/services/admin/pricingAdminService');
const { logAdminAction } = require('../../../src/services/admin/adminAuditService');
const rbacService = require('../../../src/services/rbac/rbacService');

const mockPricing = {
  seasons: [],
  weekendRules: [],
  discountRules: [],
  depositRules: [{ id: 1, name: 'Standard', defaultAmount: 200, active: true }],
  deliveryFees: [{ locationId: 'burgas-airport', fee: 25 }],
  deliveryFeeMap: { 'burgas-airport': 25 },
  globalFees: [],
  extras: [],
};

describe('Admin pricing APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['owner'],
      permissions: ALL_PERMISSIONS,
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
    pricingAdminService.getPricingBundle.mockResolvedValue(mockPricing);
  });

  test('GET /api/admin/pricing returns pricing bundle', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/pricing').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pricing.depositRules).toHaveLength(1);
    expect(pricingAdminService.getPricingBundle).toHaveBeenCalled();
  });

  test('PUT /api/admin/pricing/delivery-fees updates fees and audits', async () => {
    pricingAdminService.saveDeliveryFees.mockResolvedValue([
      { locationId: 'sofia-airport', fee: 40 },
    ]);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/pricing/delivery-fees'))
      .send({ fees: [{ locationId: 'sofia-airport', fee: 40 }] })
      .expect(200);

    expect(response.body.data.deliveryFees[0].fee).toBe(40);
    expect(pricingAdminService.saveDeliveryFees).toHaveBeenCalledWith([
      { locationId: 'sofia-airport', fee: 40 },
    ]);
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'admin.updated_pricing_delivery_fees' })
    );
  });

  test('PUT /api/admin/pricing/global-fees/:feeKey updates fee', async () => {
    pricingAdminService.saveGlobalFee.mockResolvedValue({
      feeKey: 'fuel',
      label: 'Fuel fee',
      amount: 15,
      mode: 'flat',
      active: true,
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/pricing/global-fees/fuel'))
      .send({ label: 'Fuel fee', amount: 15, mode: 'flat' })
      .expect(200);

    expect(response.body.data.globalFee.feeKey).toBe('fuel');
    expect(pricingAdminService.saveGlobalFee).toHaveBeenCalledWith(
      'fuel',
      expect.objectContaining({ amount: 15, label: 'Fuel fee' })
    );
  });

  test('POST /api/admin/pricing/seasons creates season', async () => {
    pricingAdminService.createSeason.mockResolvedValue({
      id: 9,
      name: 'Summer',
      startMonth: 6,
      startDay: 1,
      endMonth: 8,
      endDay: 31,
      adjType: 'percent',
      adjValue: 20,
      active: true,
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/pricing/seasons'))
      .send({
        name: 'Summer',
        startMonth: 6,
        startDay: 1,
        endMonth: 8,
        endDay: 31,
        adjType: 'percent',
        adjValue: 20,
      })
      .expect(201);

    expect(response.body.data.season.id).toBe(9);
  });

  test('PUT /api/admin/pricing/seasons/:id returns 404 when missing', async () => {
    pricingAdminService.updateSeason.mockResolvedValue(null);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/pricing/seasons/99'))
      .send({
        name: 'Ghost',
        startMonth: 1,
        startDay: 1,
        endMonth: 1,
        endDay: 31,
        adjValue: 0,
      })
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('DELETE /api/admin/pricing/seasons/:id deletes season', async () => {
    pricingAdminService.deleteSeason.mockResolvedValue(true);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.delete('/api/admin/pricing/seasons/3')).expect(
      200
    );

    expect(response.body.data.deleted).toBe(true);
  });

  test('PUT /api/admin/pricing/weekend saves weekend rule', async () => {
    pricingAdminService.saveWeekendRule.mockResolvedValue({
      id: 1,
      name: 'Weekend',
      weekdays: [5, 6],
      adjType: 'percent',
      adjValue: 10,
      active: true,
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/pricing/weekend'))
      .send({ id: 1, name: 'Weekend', weekdays: [5, 6], adjValue: 10 })
      .expect(200);

    expect(response.body.data.weekendRule.adjValue).toBe(10);
  });

  test('PUT /api/admin/pricing/discounts/:id updates discount', async () => {
    pricingAdminService.updateDiscount.mockResolvedValue({
      id: 2,
      name: 'Long stay',
      threshold: 7,
      adjType: 'percent',
      adjValue: 15,
      active: true,
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/pricing/discounts/2'))
      .send({ adjValue: 15, active: true })
      .expect(200);

    expect(response.body.data.discountRule.id).toBe(2);
  });

  test('PUT /api/admin/pricing/deposit saves deposit rule', async () => {
    pricingAdminService.saveDeposit.mockResolvedValue({
      id: 1,
      name: 'Standard',
      defaultAmount: 250,
      active: true,
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.put('/api/admin/pricing/deposit'))
      .send({ id: 1, name: 'Standard', defaultAmount: 250 })
      .expect(200);

    expect(response.body.data.depositRule.defaultAmount).toBe(250);
  });

  test('POST /api/admin/pricing/extras creates extra', async () => {
    pricingAdminService.createExtra.mockResolvedValue({
      id: 4,
      code: 'child_seat',
      label: 'Child seat',
      mode: 'flat',
      amount: 20,
      active: true,
      sortOrder: 0,
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/pricing/extras'))
      .send({ code: 'child_seat', label: 'Child seat', amount: 20 })
      .expect(201);

    expect(response.body.data.extra.code).toBe('child_seat');
  });

  test('DELETE /api/admin/pricing/extras/:id returns 404 when missing', async () => {
    pricingAdminService.deleteExtra.mockResolvedValue(false);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.delete('/api/admin/pricing/extras/88')).expect(
      404
    );

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('POST /api/admin/pricing/preview returns quote', async () => {
    pricingAdminService.previewPricing.mockResolvedValue({
      ok: true,
      car: { id: 7, name: 'Yaris' },
      pricing: { totalPrice: 180, deposit: 200, rentalDays: 3 },
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/pricing/preview'))
      .send({
        carId: 7,
        pickupDate: '2026-08-10',
        returnDate: '2026-08-13',
        pickupLocation: 'office',
        returnLocation: 'office',
      })
      .expect(200);

    expect(response.body.data.pricing.totalPrice).toBe(180);
  });

  test('POST /api/admin/pricing/preview surfaces service errors', async () => {
    pricingAdminService.previewPricing.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'carId is required',
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/pricing/preview'))
      .send({ pickupLocation: 'office', returnLocation: 'office' })
      .expect(400);

    expect(response.body.error.code).toBe('PRICING_PREVIEW_FAILED');
  });

  test('returns 403 when admin lacks can_manage_pricing', async () => {
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['driver'],
      permissions: ['can_view_orders'],
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/pricing').expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  test('returns 401 without session', async () => {
    const app = createApiTestApp();
    const response = await request(app).get('/api/admin/pricing').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
