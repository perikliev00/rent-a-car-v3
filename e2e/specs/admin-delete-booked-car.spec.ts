import { test, expect } from '../fixtures/base';
import { loginAsAdmin } from '../helpers/csrf';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
} from '../helpers/db';
import { allocateFutureRange, E2E_GUEST, uniqueEmail } from '../helpers/test-env';
import { deleteCarViaApi, findCarByName, getPublicCars } from '../helpers/fleet';

const CAR_NAME = `E2E Fleet Delete Booked ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-013 Cannot delete booked car', () => {
  test.setTimeout(90_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 50, nights: 3 });

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId);
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('DELETE returns 409 while confirmed booking exists; succeeds after cleanup', async ({
    request,
  }) => {
    await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      guest: { ...E2E_GUEST, email: uniqueEmail('booked-car'), fullName: 'Booked Car Guest' },
    });

    const session = await loginAsAdmin(request);
    const blocked = await deleteCarViaApi(request, carId, session);
    expect(blocked.status).toBe(409);
    expect(blocked.body?.error?.code || blocked.body?.code).toBe('CONFLICT');

    const stillListed = await getPublicCars(request);
    expect(findCarByName(stillListed.cars, CAR_NAME)).toBeTruthy();

    await cleanupReservationsForCar(carId);

    const allowed = await deleteCarViaApi(request, carId, session);
    expect(allowed.status, JSON.stringify(allowed.body)).toBe(200);

    const afterDelete = await getPublicCars(request);
    expect(findCarByName(afterDelete.cars, CAR_NAME)).toBeFalsy();
  });
});
