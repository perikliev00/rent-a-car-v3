const request = require('supertest');
const { createApiTestApp } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

jest.mock('../../../src/middleware/rateLimit', () =>
  require('../../helpers/rateLimitPassthrough')
);
jest.mock('../../../src/services/rbac/rbacService', () =>
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('../../../src/modules/analytics/analytics.service', () => ({
  getOverview: jest.fn(),
  getRevenueByCar: jest.fn(),
  getRevenueByLocation: jest.fn(),
  getUtilization: jest.fn(),
  getCarsPerformance: jest.fn(),
  getCarPerformance: jest.fn(),
  exportCsv: jest.fn(),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const analyticsService = require('../../../src/modules/analytics/analytics.service');
const rbacService = require('../../../src/services/rbac/rbacService');

describe('Admin analytics APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['owner'],
      permissions: ALL_PERMISSIONS,
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  test('GET /api/admin/analytics/overview returns KPIs', async () => {
    analyticsService.getOverview.mockResolvedValue({
      from: '2026-07-01',
      to: '2026-07-31',
      periodDays: 31,
      kpis: { monthlyRevenue: 1000, weeklyBookings: 5 },
      revenueSeries: [],
      bookingsSeries: [],
      mostRentedCars: [],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const res = await agent
      .get('/api/admin/analytics/overview?from=2026-07-01&to=2026-07-31')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.kpis.monthlyRevenue).toBe(1000);
    expect(analyticsService.getOverview).toHaveBeenCalled();
  });

  test('GET /api/admin/analytics/overview rejects missing dates', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    await agent.get('/api/admin/analytics/overview').expect(422);
  });

  test('GET /api/admin/analytics/cars/:carId returns performance', async () => {
    analyticsService.getCarPerformance.mockResolvedValue({
      from: '2026-07-01',
      to: '2026-07-31',
      periodDays: 31,
      car: { carId: '1', revenue: 500, profitability: 400 },
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const res = await agent
      .get('/api/admin/analytics/cars/1?from=2026-07-01&to=2026-07-31')
      .expect(200);

    expect(res.body.data.car.revenue).toBe(500);
  });

  test('forbids analytics without finance permissions', async () => {
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['driver'],
      permissions: ['can_view_reservations_ops'],
      roleDetails: [{ id: '2', slug: 'driver', name: 'Driver' }],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    await agent
      .get('/api/admin/analytics/overview?from=2026-07-01&to=2026-07-31')
      .expect(403);
  });
});
