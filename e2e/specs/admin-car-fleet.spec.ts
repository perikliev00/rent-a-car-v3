import { expect, test } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import { cleanupE2eCarsByName, cleanupTestCar, getCarStatus } from '../helpers/db';
import {
  CAR_IMAGE_FIXTURE,
  alertsForCar,
  createCarViaUi,
  createComplianceViaApi,
  createDamageReportViaApi,
  createServiceRecordViaApi,
  deleteCarDocumentViaApi,
  deleteCarViaApi,
  deleteComplianceViaApi,
  deleteDamageReportViaApi,
  deleteServiceRecordViaApi,
  findCarByName,
  getCarPerformanceViaApi,
  getFleetAlertsViaApi,
  getPublicCars,
  reconcileFleetAlertsViaApi,
  resolveDamageReportViaApi,
  updateCarViaApi,
  uploadCarDocumentViaApi,
} from '../helpers/fleet';
import { seedE2eFixtures } from '../helpers/seed';

test.describe.configure({ mode: 'serial' });

test.describe("admin-car-crud", () => {
  const CAR_NAME = `E2E Fleet CRUD ${Date.now()}`;
  const RENAMED = `${CAR_NAME} Renamed`;

  test.describe('ADMIN-012 Car CRUD + image ↔ public catalog', () => {
    test.setTimeout(120_000);

    let carId: number;

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      await cleanupE2eCarsByName(RENAMED);
    });

    test.afterAll(async () => {
      if (carId) await cleanupTestCar(carId);
      await cleanupE2eCarsByName(CAR_NAME);
      await cleanupE2eCarsByName(RENAMED);
    });

    test('create/update/delete syncs admin list and public catalog', async ({
      adminPage,
      request,
    }) => {
      await createCarViaUi(adminPage, { name: CAR_NAME }, CAR_IMAGE_FIXTURE);
      await expect(adminPage.getByText(CAR_NAME).first()).toBeVisible({ timeout: 20_000 });

      const publicAfterCreate = await getPublicCars(request);
      expect(publicAfterCreate.status).toBe(200);
      const createdPublic = findCarByName(publicAfterCreate.cars, CAR_NAME);
      expect(createdPublic).toBeTruthy();
      expect(String(createdPublic.image || '')).toMatch(/\/images\//);
      carId = Number(createdPublic.id);
      expect(carId).toBeGreaterThan(0);

      const session = await loginAsAdmin(request);
      const updated = await updateCarViaApi(
        request,
        carId,
        {
          name: RENAMED,
          transmission: 'Automatic',
          fuelType: 'Petrol',
          seats: '5',
          priceTier_1_3: '60',
        },
        session,
        CAR_IMAGE_FIXTURE
      );
      expect(updated.status, JSON.stringify(updated.body)).toBe(200);

      await adminPage.goto('/admin/cars');
      await expect(adminPage.getByText(RENAMED).first()).toBeVisible({ timeout: 15_000 });

      const publicAfterUpdate = await getPublicCars(request);
      expect(findCarByName(publicAfterUpdate.cars, RENAMED)).toBeTruthy();
      expect(findCarByName(publicAfterUpdate.cars, CAR_NAME)).toBeFalsy();

      const deleted = await deleteCarViaApi(request, carId, session);
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);

      const publicAfterDelete = await getPublicCars(request);
      expect(findCarByName(publicAfterDelete.cars, RENAMED)).toBeFalsy();

      await adminPage.goto('/admin/cars');
      await expect(adminPage.getByText(RENAMED)).toHaveCount(0);
    });
  });
});

test.describe("admin-car-compliance", () => {
  const CAR_NAME = `E2E Fleet Compliance ${Date.now()}`;

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
});

test.describe("admin-car-damage-documents", () => {
  const CAR_NAME = `E2E Fleet Damage Docs ${Date.now()}`;

  test.describe('ADMIN-017 Damage/docs lifecycle', () => {
    test.setTimeout(90_000);

    let carId: number;

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupTestCar(carId);
    });

    test('damage create/resolve + document upload/delete', async ({ adminPage, request }) => {
      const session = await loginAsAdmin(request);

      const damage = await createDamageReportViaApi(
        request,
        carId,
        { description: 'E2E front bumper scratch', repairCost: '250' },
        session,
        CAR_IMAGE_FIXTURE
      );
      expect([200, 201]).toContain(damage.status);
      expect(damage.reportId).toBeTruthy();

      // Product sets status to damaged when not reserved/rented.
      expect(await getCarStatus(carId)).toBe('damaged');

      await reconcileFleetAlertsViaApi(request, session);
      const withDamage = await getFleetAlertsViaApi(request, session);
      const carAlerts = alertsForCar(withDamage.alerts, carId);
      expect(
        carAlerts.some((a) => a.type === 'unresolved_damage' || a.type === 'status_damaged')
      ).toBeTruthy();

      const resolved = await resolveDamageReportViaApi(
        request,
        carId,
        damage.reportId!,
        session
      );
      expect(resolved.status, JSON.stringify(resolved.body)).toBe(200);
      const report = resolved.body?.data?.report ?? resolved.body?.report;
      expect(report?.status || report?.resolvedAt).toBeTruthy();

      // Do not assert auto-revert of car status — product keeps damaged unless changed separately.
      expect(await getCarStatus(carId)).toBe('damaged');

      await reconcileFleetAlertsViaApi(request, session);
      const afterResolve = await getFleetAlertsViaApi(request, session);
      expect(
        alertsForCar(afterResolve.alerts, carId).some((a) => a.type === 'unresolved_damage')
      ).toBeFalsy();

      const doc = await uploadCarDocumentViaApi(request, carId, session, {
        name: 'E2E registration scan',
        filePath: CAR_IMAGE_FIXTURE,
      });
      expect([200, 201]).toContain(doc.status);
      expect(doc.docId).toBeTruthy();

      await adminPage.goto(`/admin/cars/${carId}`);
      await adminPage.getByRole('button', { name: 'Documents' }).click();
      await expect(adminPage.getByText(/E2E registration scan/i).first()).toBeVisible({
        timeout: 15_000,
      });

      const deletedDoc = await deleteCarDocumentViaApi(request, carId, doc.docId!, session);
      expect(deletedDoc.status, JSON.stringify(deletedDoc.body)).toBe(200);

      const deletedDamage = await deleteDamageReportViaApi(
        request,
        carId,
        damage.reportId!,
        session
      );
      expect(deletedDamage.status, JSON.stringify(deletedDamage.body)).toBe(200);
    });
  });
});

test.describe("admin-car-service-performance", () => {
  const CAR_NAME = `E2E Fleet Service ${Date.now()}`;

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
});
