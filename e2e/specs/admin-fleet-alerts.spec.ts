// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/csrf'.
import { loginAsAdmin } from '../helpers/csrf';
// Import named exports from '../helpers/db'.
import { cleanupE2eCarsByName, cleanupTestCar, getCarStatus } from '../helpers/db';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  alertsForCar,
  // Contribute this line to the enclosing declaration or statement.
  changeFleetStatusViaApi,
  // Contribute this line to the enclosing declaration or statement.
  createComplianceViaApi,
  // Contribute this line to the enclosing declaration or statement.
  deleteComplianceViaApi,
  // Contribute this line to the enclosing declaration or statement.
  findCarByName,
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlertsViaApi,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlertsViaApi,
  // Contribute this line to the enclosing declaration or statement.
  searchPublicCars,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/fleet';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { allocateFutureRange } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("admin-fleet-status", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Fleet Status ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-014 Fleet status ↔ availability/alerts', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Create the range constant.
    const range = allocateFutureRange({ fromDaysAhead: 55, nights: 2 });

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Define a single test case and its expectations.
    test('in_maintenance hides from search and raises fleet alert; restore clears it', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the session constant.
      const session = await loginAsAdmin(request);

      // Create the set maint constant.
      const setMaint = await changeFleetStatusViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Supply the literal value used by the enclosing expression.
        'in_maintenance',
        // Contribute this line to the enclosing declaration or statement.
        session,
        // Supply the literal value used by the enclosing expression.
        'e2e maintenance'
      );
      // Assert that the value matches the intended expectation.
      expect(setMaint.status, JSON.stringify(setMaint.body)).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(await getCarStatus(carId)).toBe('in_maintenance');

      // Create the search constant.
      const search = await searchPublicCars(request, {
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
      });
      // Assert that the value matches the intended expectation.
      expect(search.status).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(findCarByName(search.cars, CAR_NAME)).toBeFalsy();

      // Wait until the asynchronous operation resolves.
      await reconcileFleetAlertsViaApi(request, session);
      // Create the alerts constant.
      const alerts = await getFleetAlertsViaApi(request, session);
      // Create the car alerts constant.
      const carAlerts = alertsForCar(alerts.alerts, carId);
      // Assert that the value matches the intended expectation.
      expect(carAlerts.some((a) => a.type === 'status_in_maintenance')).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/fleet-alerts');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 15_000 });

      // Create the restore constant.
      const restore = await changeFleetStatusViaApi(request, carId, 'available', session);
      // Assert that the value matches the intended expectation.
      expect(restore.status, JSON.stringify(restore.body)).toBe(200);
      // Assert that the value matches the intended expectation.
      expect(await getCarStatus(carId)).toBe('available');

      // Wait until the asynchronous operation resolves.
      await reconcileFleetAlertsViaApi(request, session);
      // Create the after constant.
      const after = await getFleetAlertsViaApi(request, session);
      // Assert that the value matches the intended expectation.
      expect(
        // Call alertsForCar to perform this step.
        alertsForCar(after.alerts, carId).some((a) => a.type === 'status_in_maintenance')
      // Continue the surrounding logic with this statement.
      ).toBeFalsy();

      // Create the search ok constant.
      const searchOk = await searchPublicCars(request, {
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
      });
      // Assert that the value matches the intended expectation.
      expect(findCarByName(searchOk.cars, CAR_NAME)).toBeTruthy();
    });
  });
});

// Call test.describe to perform this step.
test.describe("fleet-alerts-filter", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Fleet Filter ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('Fleet alerts filter + refresh (101)', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId).catch(() => undefined);
    });

    // Define a single test case and its expectations.
    test('severity filter + Refresh; reconcile clears after fix', async ({ adminPage, request }) => {
      // Create the session constant.
      const session = await loginAsAdmin(request);

      // Create the created constant.
      const created = await createComplianceViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        {
          // Provide the item type field value.
          itemType: 'civil_insurance',
          // Provide the title field value.
          title: 'E2E Filter Insurance',
          // Provide the expires at field value.
          expiresAt: '2020-01-15',
          // Provide the issued at field value.
          issuedAt: '2019-01-15',
        },
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect([200, 201]).toContain(created.status);
      // Assert that the value matches the intended expectation.
      expect(created.itemId).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await reconcileFleetAlertsViaApi(request, session);
      // Create the with alert constant.
      const withAlert = await getFleetAlertsViaApi(request, session);
      // Create the car alerts constant.
      const carAlerts = alertsForCar(withAlert.alerts, carId);
      // Assert that the value matches the intended expectation.
      expect(carAlerts.some((a) => a.type === 'insurance_expired')).toBeTruthy();
      // Create the severity constant.
      const severity = carAlerts.find((a) => a.type === 'insurance_expired')?.severity || 'critical';

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/fleet-alerts');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByRole('heading', { name: /fleet alerts/i })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 15_000 });

      // Create the chip label constant.
      const chipLabel = severity === 'warning' ? /Warning \(/ : /Critical \(/;
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: chipLabel }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible();

      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 15_000 });

      // Create the removed constant.
      const removed = await deleteComplianceViaApi(request, carId, created.itemId!, session);
      // Assert that the value matches the intended expectation.
      expect(removed.status, JSON.stringify(removed.body)).toBe(200);
      // Wait until the asynchronous operation resolves.
      await reconcileFleetAlertsViaApi(request, session);

      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Refresh' }).click();
      // Wait until the asynchronous operation resolves.
      await expect
        // Call .poll to perform this step.
        .poll(async () => {
          // Create the cleared constant.
          const cleared = await getFleetAlertsViaApi(request, session);
          // Return the resulting value to the caller.
          return alertsForCar(cleared.alerts, carId).some((a) => a.type === 'insurance_expired');
        // Continue the surrounding logic with this statement.
        }, { timeout: 15_000 })
        // Call .toBe to perform this step.
        .toBe(false);

      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: chipLabel }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(CAR_NAME)).toHaveCount(0);
    });
  });
});
