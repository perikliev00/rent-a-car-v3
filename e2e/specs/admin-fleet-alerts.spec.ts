import { expect, test } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import { cleanupE2eCarsByName, cleanupTestCar, getCarStatus } from '../helpers/db';
import {
  alertsForCar,
  changeFleetStatusViaApi,
  createComplianceViaApi,
  deleteComplianceViaApi,
  findCarByName,
  getFleetAlertsViaApi,
  reconcileFleetAlertsViaApi,
  searchPublicCars,
} from '../helpers/fleet';
import { seedE2eFixtures } from '../helpers/seed';
import { allocateFutureRange } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("admin-fleet-status", () => {
  const CAR_NAME = `E2E Fleet Status ${Date.now()}`;

  test.describe('ADMIN-014 Fleet status ↔ availability/alerts', () => {
    test.setTimeout(90_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 55, nights: 2 });

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupTestCar(carId);
    });

    test('in_maintenance hides from search and raises fleet alert; restore clears it', async ({
      adminPage,
      request,
    }) => {
      const session = await loginAsAdmin(request);

      const setMaint = await changeFleetStatusViaApi(
        request,
        carId,
        'in_maintenance',
        session,
        'e2e maintenance'
      );
      expect(setMaint.status, JSON.stringify(setMaint.body)).toBe(200);
      expect(await getCarStatus(carId)).toBe('in_maintenance');

      const search = await searchPublicCars(request, {
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
      });
      expect(search.status).toBe(200);
      expect(findCarByName(search.cars, CAR_NAME)).toBeFalsy();

      await reconcileFleetAlertsViaApi(request, session);
      const alerts = await getFleetAlertsViaApi(request, session);
      const carAlerts = alertsForCar(alerts.alerts, carId);
      expect(carAlerts.some((a) => a.type === 'status_in_maintenance')).toBeTruthy();

      await adminPage.goto('/admin/fleet-alerts');
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 15_000 });

      const restore = await changeFleetStatusViaApi(request, carId, 'available', session);
      expect(restore.status, JSON.stringify(restore.body)).toBe(200);
      expect(await getCarStatus(carId)).toBe('available');

      await reconcileFleetAlertsViaApi(request, session);
      const after = await getFleetAlertsViaApi(request, session);
      expect(
        alertsForCar(after.alerts, carId).some((a) => a.type === 'status_in_maintenance')
      ).toBeFalsy();

      const searchOk = await searchPublicCars(request, {
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
      });
      expect(findCarByName(searchOk.cars, CAR_NAME)).toBeTruthy();
    });
  });
});

test.describe("fleet-alerts-filter", () => {
  const CAR_NAME = `E2E Fleet Filter ${Date.now()}`;

  test.describe('Fleet alerts filter + refresh (101)', () => {
    test.setTimeout(120_000);

    let carId: number;

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test('severity filter + Refresh; reconcile clears after fix', async ({ adminPage, request }) => {
      const session = await loginAsAdmin(request);

      const created = await createComplianceViaApi(
        request,
        carId,
        {
          itemType: 'civil_insurance',
          title: 'E2E Filter Insurance',
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
      const severity = carAlerts.find((a) => a.type === 'insurance_expired')?.severity || 'critical';

      await adminPage.goto('/admin/fleet-alerts');
      await expect(adminPage.getByRole('heading', { name: /fleet alerts/i })).toBeVisible({
        timeout: 15_000,
      });
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 15_000 });

      const chipLabel = severity === 'warning' ? /Warning \(/ : /Critical \(/;
      await adminPage.getByRole('button', { name: chipLabel }).click();
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible();

      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 15_000 });

      const removed = await deleteComplianceViaApi(request, carId, created.itemId!, session);
      expect(removed.status, JSON.stringify(removed.body)).toBe(200);
      await reconcileFleetAlertsViaApi(request, session);

      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      await expect
        .poll(async () => {
          const cleared = await getFleetAlertsViaApi(request, session);
          return alertsForCar(cleared.alerts, carId).some((a) => a.type === 'insurance_expired');
        }, { timeout: 15_000 })
        .toBe(false);

      await adminPage.getByRole('button', { name: chipLabel }).click();
      await expect(adminPage.getByText(CAR_NAME)).toHaveCount(0);
    });
  });
});
