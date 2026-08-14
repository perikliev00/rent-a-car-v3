import { test, expect } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import { seedE2eFixtures } from '../helpers/seed';
import { cleanupE2eCarsByName, cleanupTestCar, getCarStatus } from '../helpers/db';
import { allocateFutureRange } from '../helpers/test-env';
import {
  alertsForCar,
  changeFleetStatusViaApi,
  findCarByName,
  getFleetAlertsViaApi,
  reconcileFleetAlertsViaApi,
  searchPublicCars,
} from '../helpers/fleet';

const CAR_NAME = `E2E Fleet Status ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

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
