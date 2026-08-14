import { test, expect } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import { seedE2eFixtures } from '../helpers/seed';
import { cleanupE2eCarsByName, cleanupTestCar } from '../helpers/db';
import {
  alertsForCar,
  createComplianceViaApi,
  deleteComplianceViaApi,
  getFleetAlertsViaApi,
  reconcileFleetAlertsViaApi,
} from '../helpers/fleet';

const CAR_NAME = `E2E Fleet Compliance ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-015 Compliance lifecycle ↔ alerts', () => {
  test.setTimeout(90_000);

  let carId: number;

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupTestCar(carId);
  });

  test('expired compliance creates alert; delete clears it', async ({ adminPage, request }) => {
    const session = await loginAsAdmin(request);

    const created = await createComplianceViaApi(
      request,
      carId,
      {
        itemType: 'civil_insurance',
        title: 'E2E Civil Insurance',
        expiresAt: '2020-01-15',
        issuedAt: '2019-01-15',
      },
      session
    );
    expect([200, 201]).toContain(created.status);
    expect(created.itemId).toBeTruthy();

    await reconcileFleetAlertsViaApi(request, session);
    const withAlert = await getFleetAlertsViaApi(request, session);
    const carAlerts = alertsForCar(withAlert.alerts, carId);
    expect(carAlerts.some((a) => a.type === 'insurance_expired')).toBeTruthy();

    await adminPage.goto('/admin/fleet-alerts');
    await expect(adminPage.getByText(/insurance|expired/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const removed = await deleteComplianceViaApi(request, carId, created.itemId!, session);
    expect(removed.status, JSON.stringify(removed.body)).toBe(200);

    await reconcileFleetAlertsViaApi(request, session);
    const cleared = await getFleetAlertsViaApi(request, session);
    expect(
      alertsForCar(cleared.alerts, carId).some((a) => a.type === 'insurance_expired')
    ).toBeFalsy();
  });
});
