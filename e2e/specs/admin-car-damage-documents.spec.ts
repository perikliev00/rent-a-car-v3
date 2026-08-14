import { test, expect } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import { seedE2eFixtures } from '../helpers/seed';
import { cleanupE2eCarsByName, cleanupTestCar, getCarStatus } from '../helpers/db';
import {
  alertsForCar,
  CAR_IMAGE_FIXTURE,
  createDamageReportViaApi,
  deleteCarDocumentViaApi,
  deleteDamageReportViaApi,
  getFleetAlertsViaApi,
  reconcileFleetAlertsViaApi,
  resolveDamageReportViaApi,
  uploadCarDocumentViaApi,
} from '../helpers/fleet';

const CAR_NAME = `E2E Fleet Damage Docs ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

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
