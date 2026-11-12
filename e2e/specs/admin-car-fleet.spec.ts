// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/csrf'.
import { loginAsAdmin } from '../helpers/csrf';
// Import named exports from '../helpers/db'.
import { cleanupE2eCarsByName, cleanupTestCar, getCarStatus } from '../helpers/db';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  CAR_IMAGE_FIXTURE,
  // Contribute this line to the enclosing declaration or statement.
  alertsForCar,
  // Contribute this line to the enclosing declaration or statement.
  createCarViaUi,
  // Contribute this line to the enclosing declaration or statement.
  createComplianceViaApi,
  // Contribute this line to the enclosing declaration or statement.
  createDamageReportViaApi,
  // Contribute this line to the enclosing declaration or statement.
  createServiceRecordViaApi,
  // Contribute this line to the enclosing declaration or statement.
  deleteCarDocumentViaApi,
  // Contribute this line to the enclosing declaration or statement.
  deleteCarViaApi,
  // Contribute this line to the enclosing declaration or statement.
  deleteComplianceViaApi,
  // Contribute this line to the enclosing declaration or statement.
  deleteDamageReportViaApi,
  // Contribute this line to the enclosing declaration or statement.
  deleteServiceRecordViaApi,
  // Contribute this line to the enclosing declaration or statement.
  findCarByName,
  // Contribute this line to the enclosing declaration or statement.
  getCarPerformanceViaApi,
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlertsViaApi,
  // Contribute this line to the enclosing declaration or statement.
  getPublicCars,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlertsViaApi,
  // Contribute this line to the enclosing declaration or statement.
  resolveDamageReportViaApi,
  // Contribute this line to the enclosing declaration or statement.
  updateCarViaApi,
  // Contribute this line to the enclosing declaration or statement.
  uploadCarDocumentViaApi,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/fleet';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures } from '../helpers/seed';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("admin-car-crud", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Fleet CRUD ${Date.now()}`;
  // Create the renamed constant.
  const RENAMED = `${CAR_NAME} Renamed`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-012 Car CRUD + image ↔ public catalog', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(RENAMED);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Evaluate the condition and enter the branch when it is true.
      if (carId) await cleanupTestCar(carId);
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(RENAMED);
    });

    // Define a single test case and its expectations.
    test('create/update/delete syncs admin list and public catalog', async ({
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
      // Contribute this line to the enclosing declaration or statement.
      request,
    // Continue the surrounding logic with this statement.
    }) => {
      // Wait until the asynchronous operation resolves.
      await createCarViaUi(adminPage, { name: CAR_NAME }, CAR_IMAGE_FIXTURE);
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 20_000 });

      // Create the public after create constant.
      const publicAfterCreate = await getPublicCars(request);
      // Assert that the value matches the intended expectation.
      expect(publicAfterCreate.status).toBe(200);
      // Create the created public constant.
      const createdPublic = findCarByName(publicAfterCreate.cars, CAR_NAME);
      // Assert that the value matches the intended expectation.
      expect(createdPublic).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(String(createdPublic.image || '')).toMatch(/\/images\//);
      // Update carId with the right-hand side value.
      carId = Number(createdPublic.id);
      // Assert that the value matches the intended expectation.
      expect(carId).toBeGreaterThan(0);

      // Create the session constant.
      const session = await loginAsAdmin(request);
      // Create the updated constant.
      const updated = await updateCarViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        {
          // Provide the name field value.
          name: RENAMED,
          // Provide the transmission field value.
          transmission: 'Automatic',
          // Provide the fuel type field value.
          fuelType: 'Petrol',
          // Provide the seats field value.
          seats: '5',
          // Provide the price tier 1 3 field value.
          priceTier_1_3: '60',
        },
        // Contribute this line to the enclosing declaration or statement.
        session,
        // Reference the identifier used by the enclosing expression.
        CAR_IMAGE_FIXTURE
      );
      // Assert that the value matches the intended expectation.
      expect(updated.status, JSON.stringify(updated.body)).toBe(200);

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/cars');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(RENAMED).first()).toBeVisible({ timeout: 15_000 });

      // Create the public after update constant.
      const publicAfterUpdate = await getPublicCars(request);
      // Assert that the value matches the intended expectation.
      expect(findCarByName(publicAfterUpdate.cars, RENAMED)).toBeTruthy();
      // Assert that the value matches the intended expectation.
      expect(findCarByName(publicAfterUpdate.cars, CAR_NAME)).toBeFalsy();

      // Create the deleted constant.
      const deleted = await deleteCarViaApi(request, carId, session);
      // Assert that the value matches the intended expectation.
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);

      // Create the public after delete constant.
      const publicAfterDelete = await getPublicCars(request);
      // Assert that the value matches the intended expectation.
      expect(findCarByName(publicAfterDelete.cars, RENAMED)).toBeFalsy();

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/cars');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(RENAMED)).toHaveCount(0);
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-car-compliance", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Fleet Compliance ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-015 Compliance lifecycle ↔ alerts', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

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
      await cleanupTestCar(carId);
    });

    // Define a single test case and its expectations.
    test('expired compliance creates alert; delete clears it', async ({ adminPage, request }) => {
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
          title: 'E2E Civil Insurance',
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

      // Wait until the asynchronous operation resolves.
      await adminPage.goto('/admin/fleet-alerts');
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(/insurance|expired/i).first()).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the removed constant.
      const removed = await deleteComplianceViaApi(request, carId, created.itemId!, session);
      // Assert that the value matches the intended expectation.
      expect(removed.status, JSON.stringify(removed.body)).toBe(200);

      // Wait until the asynchronous operation resolves.
      await reconcileFleetAlertsViaApi(request, session);
      // Create the cleared constant.
      const cleared = await getFleetAlertsViaApi(request, session);
      // Assert that the value matches the intended expectation.
      expect(
        // Call alertsForCar to perform this step.
        alertsForCar(cleared.alerts, carId).some((a) => a.type === 'insurance_expired')
      // Continue the surrounding logic with this statement.
      ).toBeFalsy();
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-car-damage-documents", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Fleet Damage Docs ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-017 Damage/docs lifecycle', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

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
      await cleanupTestCar(carId);
    });

    // Define a single test case and its expectations.
    test('damage create/resolve + document upload/delete', async ({ adminPage, request }) => {
      // Create the session constant.
      const session = await loginAsAdmin(request);

      // Create the damage constant.
      const damage = await createDamageReportViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        { description: 'E2E front bumper scratch', repairCost: '250' },
        // Contribute this line to the enclosing declaration or statement.
        session,
        // Reference the identifier used by the enclosing expression.
        CAR_IMAGE_FIXTURE
      );
      // Assert that the value matches the intended expectation.
      expect([200, 201]).toContain(damage.status);
      // Assert that the value matches the intended expectation.
      expect(damage.reportId).toBeTruthy();

      // Product sets status to damaged when not reserved/rented.
      expect(await getCarStatus(carId)).toBe('damaged');

      // Wait until the asynchronous operation resolves.
      await reconcileFleetAlertsViaApi(request, session);
      // Create the with damage constant.
      const withDamage = await getFleetAlertsViaApi(request, session);
      // Create the car alerts constant.
      const carAlerts = alertsForCar(withDamage.alerts, carId);
      // Assert that the value matches the intended expectation.
      expect(
        // Call carAlerts.some to perform this step.
        carAlerts.some((a) => a.type === 'unresolved_damage' || a.type === 'status_damaged')
      // Continue the surrounding logic with this statement.
      ).toBeTruthy();

      // Create the resolved constant.
      const resolved = await resolveDamageReportViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        damage.reportId!,
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect(resolved.status, JSON.stringify(resolved.body)).toBe(200);
      // Create the report constant.
      const report = resolved.body?.data?.report ?? resolved.body?.report;
      // Assert that the value matches the intended expectation.
      expect(report?.status || report?.resolvedAt).toBeTruthy();

      // Do not assert auto-revert of car status — product keeps damaged unless changed separately.
      expect(await getCarStatus(carId)).toBe('damaged');

      // Wait until the asynchronous operation resolves.
      await reconcileFleetAlertsViaApi(request, session);
      // Create the after resolve constant.
      const afterResolve = await getFleetAlertsViaApi(request, session);
      // Assert that the value matches the intended expectation.
      expect(
        // Call alertsForCar to perform this step.
        alertsForCar(afterResolve.alerts, carId).some((a) => a.type === 'unresolved_damage')
      // Continue the surrounding logic with this statement.
      ).toBeFalsy();

      // Create the doc constant.
      const doc = await uploadCarDocumentViaApi(request, carId, session, {
        // Provide the name field value.
        name: 'E2E registration scan',
        // Provide the file path field value.
        filePath: CAR_IMAGE_FIXTURE,
      });
      // Assert that the value matches the intended expectation.
      expect([200, 201]).toContain(doc.status);
      // Assert that the value matches the intended expectation.
      expect(doc.docId).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await adminPage.goto(`/admin/cars/${carId}`);
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Documents' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(/E2E registration scan/i).first()).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the deleted doc constant.
      const deletedDoc = await deleteCarDocumentViaApi(request, carId, doc.docId!, session);
      // Assert that the value matches the intended expectation.
      expect(deletedDoc.status, JSON.stringify(deletedDoc.body)).toBe(200);

      // Create the deleted damage constant.
      const deletedDamage = await deleteDamageReportViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        damage.reportId!,
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect(deletedDamage.status, JSON.stringify(deletedDamage.body)).toBe(200);
    });
  });
});

// Call test.describe to perform this step.
test.describe("admin-car-service-performance", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Fleet Service ${Date.now()}`;

  // Call test.describe to perform this step.
  test.describe('ADMIN-016 Service records ↔ performance', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(90_000);

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
      await cleanupTestCar(carId);
    });

    // Define a single test case and its expectations.
    test('service overdue alert + performance endpoint', async ({ adminPage, request }) => {
      // Create the session constant.
      const session = await loginAsAdmin(request);

      // Create the created constant.
      const created = await createServiceRecordViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        {
          // Provide the service type field value.
          serviceType: 'oil_change',
          // Provide the service date field value.
          serviceDate: '2024-01-10',
          // Provide the next service date field value.
          nextServiceDate: '2024-06-01',
          // Provide the description field value.
          description: 'E2E overdue oil change',
          // Provide the cost field value.
          cost: 120,
        },
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect([200, 201]).toContain(created.status);
      // Assert that the value matches the intended expectation.
      expect(created.recordId).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await reconcileFleetAlertsViaApi(request, session);
      // Create the alerts constant.
      const alerts = await getFleetAlertsViaApi(request, session);
      // Assert that the value matches the intended expectation.
      expect(
        // Call alertsForCar to perform this step.
        alertsForCar(alerts.alerts, carId).some((a) => a.type === 'service_overdue')
      // Continue the surrounding logic with this statement.
      ).toBeTruthy();

      // Create the from constant.
      const from = '2025-01-01';
      // Create the to constant.
      const to = '2025-12-31';
      // Create the perf constant.
      const perf = await getCarPerformanceViaApi(request, carId, session, from, to);
      // Assert that the value matches the intended expectation.
      expect(perf.status, JSON.stringify(perf.body)).toBe(200);
      // Create the payload constant.
      const payload = perf.body?.data ?? perf.body;
      // Assert that the value matches the intended expectation.
      expect(payload?.car || payload?.periodDays != null).toBeTruthy();

      // Wait until the asynchronous operation resolves.
      await adminPage.goto(`/admin/cars/${carId}`);
      // Wait until the asynchronous operation resolves.
      await adminPage.getByRole('button', { name: 'Performance' }).click();
      // Wait until the asynchronous operation resolves.
      await expect(adminPage.getByText(/Performance|Revenue|Utilization|Bookings/i).first()).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Create the deleted constant.
      const deleted = await deleteServiceRecordViaApi(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        created.recordId!,
        // Reference the identifier used by the enclosing expression.
        session
      );
      // Assert that the value matches the intended expectation.
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);

      // Wait until the asynchronous operation resolves.
      await reconcileFleetAlertsViaApi(request, session);
      // Create the cleared constant.
      const cleared = await getFleetAlertsViaApi(request, session);
      // Assert that the value matches the intended expectation.
      expect(
        // Call alertsForCar to perform this step.
        alertsForCar(cleared.alerts, carId).some((a) => a.type === 'service_overdue')
      // Continue the surrounding logic with this statement.
      ).toBeFalsy();
    });
  });
});
