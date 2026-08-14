import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  assertStatusHistoryContains,
  countDateBlocksForCar,
  getReservationById,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';
import { searchPublicCars } from '../helpers/fleet';
import { loginAsAdmin } from '../helpers/csrf';
import { insertTestStaff, loginAsStaff, cleanupTestStaff } from '../helpers/rbac';

const CAR_NAME = `E2E Refund Ops ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Ops refunded frees car + RBAC (82)', () => {
  test.setTimeout(120_000);

  let carId: number;
  let reservationId: number;
  const range = allocateFutureRange({ fromDaysAhead: 160, nights: 2 });
  const guestEmail = uniqueEmail('refund-ops');
  let receptionistEmail = '';

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    if (receptionistEmail) {
      await cleanupTestStaff(receptionistEmail).catch(() => undefined);
    }
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('owner refunds manual_review → block gone; receptionist denied', async ({ request }) => {
    await cleanupReservationsForCar(carId);

    const seeded = await seedLinkedBooking({
      carId,
      status: 'manual_review',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      withOrder: false,
      withBlock: true,
      guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Refund Ops Guest' },
    });
    reservationId = seeded.reservationId;
    expect(await countDateBlocksForCar(carId)).toBe(1);

    const receptionist = await insertTestStaff({ roleSlug: 'receptionist' });
    receptionistEmail = receptionist.email;
    const receptionSession = await loginAsStaff(request, receptionist);
    const denied = await changeOpsStatusViaApi(
      request,
      reservationId,
      'refunded',
      receptionSession
    );
    expect(denied.status).toBe(403);
    await assertReservationStatus(reservationId, 'manual_review');
    expect(await countDateBlocksForCar(carId)).toBe(1);

    const owner = await loginAsAdmin(request);
    const allowed = await changeOpsStatusViaApi(request, reservationId, 'refunded', owner);
    expect(allowed.ok, JSON.stringify(allowed.body)).toBeTruthy();

    await assertReservationStatus(reservationId, 'refunded');
    await assertStatusHistoryContains(reservationId, 'refunded');
    expect(await countDateBlocksForCar(carId)).toBe(0);

    const search = await searchPublicCars(request, {
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
    });
    expect(search.status).toBe(200);
    expect(search.cars.some((c: { id: number }) => Number(c.id) === carId)).toBe(true);

    const row = await getReservationById(reservationId);
    expect(row.status).toBe('refunded');
  });
});
