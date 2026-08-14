import { test, expect } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import {
  CAR_IMAGE_FIXTURE,
  createCarViaUi,
  deleteCarViaApi,
  findCarByName,
  getPublicCars,
  updateCarViaApi,
} from '../helpers/fleet';
import { cleanupE2eCarsByName, cleanupTestCar } from '../helpers/db';

const CAR_NAME = `E2E Fleet CRUD ${Date.now()}`;
const RENAMED = `${CAR_NAME} Renamed`;

test.describe.configure({ mode: 'serial' });

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
