import { test, expect } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import { seedE2eFixtures } from '../helpers/seed';
import { cleanupE2eCarsByName, cleanupTestCar } from '../helpers/db';
import {
  alertsForCar,
  createServiceRecordViaApi,
  deleteServiceRecordViaApi,
  getCarPerformanceViaApi,
  getFleetAlertsViaApi,
  reconcileFleetAlertsViaApi,
} from '../helpers/fleet';

const CAR_NAME = `E2E Fleet Service ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-016 Service records ↔ performance', () => {
  test.setTimeout(90_000);

  let carId: number;

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupTestCar(carId);
  });

  test('service overdue alert + performance endpoint', async ({ adminPage, request }) => {
    const session = await loginAsAdmin(request);

    const created = await createServiceRecordViaApi(
      request,
      carId,
      {
        serviceType: 'oil_change',
        serviceDate: '2024-01-10',
        nextServiceDate: '2024-06-01',
        description: 'E2E overdue oil change',
        cost: 120,
      },
      session
    );
    expect([200, 201]).toContain(created.status);
    expect(created.recordId).toBeTruthy();

    await reconcileFleetAlertsViaApi(request, session);
    const alerts = await getFleetAlertsViaApi(request, session);
    expect(
      alertsForCar(alerts.alerts, carId).some((a) => a.type === 'service_overdue')
    ).toBeTruthy();

    const from = '2025-01-01';
    const to = '2025-12-31';
    const perf = await getCarPerformanceViaApi(request, carId, session, from, to);
    expect(perf.status, JSON.stringify(perf.body)).toBe(200);
    const payload = perf.body?.data ?? perf.body;
    expect(payload?.car || payload?.periodDays != null).toBeTruthy();

    await adminPage.goto(`/admin/cars/${carId}`);
    await adminPage.getByRole('button', { name: 'Performance' }).click();
    await expect(adminPage.getByText(/Performance|Revenue|Utilization|Bookings/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const deleted = await deleteServiceRecordViaApi(
      request,
      carId,
      created.recordId!,
      session
    );
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);

    await reconcileFleetAlertsViaApi(request, session);
    const cleared = await getFleetAlertsViaApi(request, session);
    expect(
      alertsForCar(cleared.alerts, carId).some((a) => a.type === 'service_overdue')
    ).toBeFalsy();
  });
});
