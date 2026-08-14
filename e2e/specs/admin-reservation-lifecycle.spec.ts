import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  assertReservationStatus,
  assertStatusHistoryContains,
  assertStatusHistorySequence,
  getCarStatus,
} from '../helpers/db';
import { uniqueEmail, allocateFutureRange, E2E_GUEST } from '../helpers/test-env';
import { applyOpsStatus, changeOpsStatusViaApi } from '../helpers/admin-reservations';

const CAR_NAME = `E2E Admin Lifecycle ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-004 Valid lifecycle → history + fleet', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 3, nights: 3 });
  const guestEmail = uniqueEmail('lifecycle');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('ops Apply walks confirmed→completed and updates history + fleet', async ({
    adminPage,
    request,
  }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Lifecycle Guest' },
    });
    const reservationId = seeded.reservationId;

    // Future confirmed rows are not in Today's widgets — use API-backed Apply helper.
    for (const status of ['car_prepared', 'picked_up', 'active_rental', 'returned'] as const) {
      await applyOpsStatus(adminPage, reservationId, status, { request });
      await assertReservationStatus(reservationId, status);
      await assertStatusHistoryContains(reservationId, status);

      if (status === 'picked_up' || status === 'active_rental') {
        expect(await getCarStatus(carId)).toBe('rented');
      }
      if (status === 'returned') {
        expect(await getCarStatus(carId)).toBe('needs_cleaning');
      }
    }

    const completed = await changeOpsStatusViaApi(request, reservationId, 'completed');
    expect(completed.ok).toBeTruthy();
    await assertReservationStatus(reservationId, 'completed');

    await assertStatusHistorySequence(reservationId, [
      'confirmed',
      'car_prepared',
      'picked_up',
      'active_rental',
      'returned',
      'completed',
    ]);

    await adminPage.goto(`/admin/reservations?id=${reservationId}`);
    await expect(adminPage.getByRole('heading', { name: 'Status History' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByText('completed').first()).toBeVisible();
  });
});
